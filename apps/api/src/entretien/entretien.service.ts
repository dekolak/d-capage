import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nomMachine } from '../catalogue/catalogue.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatImage, StockageService } from '../stockage/stockage.service';
import { WebhooksService } from '../webhooks/webhooks.service';

const JOUR = 24 * 3600 * 1000;
export const UNITES = ['JOURS', 'SEMAINES', 'MOIS'] as const;
export const PHOTOS = ['non', 'facultative', 'obligatoire'] as const;
export type Etat = 'ok' | 'bientot' | 'retard';

export interface TacheDto {
  titre?: string; description?: string | null; frequence?: number; unite?: string; bientotJours?: number;
  procedureId?: string | null; photo?: string; photoConsigne?: string | null; technicien?: boolean;
}
export interface FaitDto { tacheId?: string | null; date?: string; titre?: string | null; note?: string | null; source?: string }

/** Date + fréquence (les mois en calendrier : 15 janvier + 3 mois = 15 avril). */
export function ajouter(d: Date, n: number, unite: string): Date {
  const r = new Date(d);
  if (unite === 'MOIS') r.setMonth(r.getMonth() + n);
  else r.setTime(r.getTime() + n * (unite === 'SEMAINES' ? 7 : 1) * JOUR);
  return r;
}

/** État d'une tâche : prochaine échéance = dernière fois faite (sinon mise en service) + fréquence. */
export function echeance(
  t: { frequence: number; unite: string; bientotJours: number },
  derniere: Date | null,
  depart: Date,
  maintenant = new Date(),
): { prochaine: Date; etat: Etat; jours: number } {
  const prochaine = ajouter(derniere ?? depart, t.frequence, t.unite);
  const jours = Math.ceil((prochaine.getTime() - maintenant.getTime()) / JOUR);
  // « bientôt » : au plus un quart de la période (une tâche hebdomadaire n'est pas « bientôt » en permanence)
  const periode = t.frequence * (t.unite === 'MOIS' ? 30 : t.unite === 'SEMAINES' ? 7 : 1);
  const bientot = Math.min(t.bientotJours, Math.floor(periode / 4));
  return { prochaine, jours, etat: jours < 0 ? 'retard' : jours <= bientot ? 'bientot' : 'ok' };
}

const MACHINE = {
  user: { select: { id: true, identifiant: true, nom: true, numeroOdoo: true, actif: true } },
  variante: { include: { modele: { include: { fabricant: true, plans: { include: { taches: { orderBy: { ordre: 'asc' }, include: { procedure: { select: { id: true, titre: true, publiee: true } } } } } } } } } },
  entretiens: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], include: { user: { select: { nom: true, identifiant: true } } } },
} satisfies Prisma.UserMachineInclude;
type Machine = Prisma.UserMachineGetPayload<{ include: typeof MACHINE }>;

/**
 * Carnet d'entretien : plans (tâches périodiques) attachés aux modèles de machines, carnet de chaque machine de client
 * (échéances qui glissent selon la date où c'est vraiment fait), notes libres et photos du client, interventions de l'admin,
 * liste des échéances pour n8n (rappels par email, SMS, WhatsApp).
 */
@Injectable()
export class EntretienService {
  constructor(private prisma: PrismaService, private stockage: StockageService, private webhooks: WebhooksService) {}

  // ---------- plans (admin) ----------
  listerPlans() {
    return this.prisma.planEntretien.findMany({
      orderBy: { nom: 'asc' },
      include: {
        modeles: { select: { id: true, nom: true, fabricant: { select: { nom: true } } } },
        taches: { orderBy: { ordre: 'asc' }, include: { procedure: { select: { id: true, titre: true, publiee: true } } } },
      },
    });
  }

  async creerPlan(d: { nom: string; description?: string | null }) {
    const p = await this.prisma.planEntretien.create({ data: { nom: d.nom.trim(), description: d.description?.trim() || null } });
    return p;
  }

  async modifierPlan(id: string, d: { nom?: string; description?: string | null; modeleIds?: string[] }) {
    await this.plan(id);
    if (d.modeleIds && (await this.prisma.modele.count({ where: { id: { in: d.modeleIds } } })) !== d.modeleIds.length) throw new BadRequestException('Modèle introuvable');
    await this.prisma.planEntretien.update({
      where: { id },
      data: {
        ...(d.nom ? { nom: d.nom.trim() } : {}),
        ...(d.description !== undefined ? { description: d.description?.trim() || null } : {}),
        ...(d.modeleIds ? { modeles: { set: d.modeleIds.map((x) => ({ id: x })) } } : {}),
      },
    });
    return this.listerPlans();
  }

  async supprimerPlan(id: string) {
    await this.plan(id);
    await this.prisma.planEntretien.delete({ where: { id } });
    return this.listerPlans();
  }

  private async verifierTache(d: TacheDto) {
    if (d.unite !== undefined && !UNITES.includes(d.unite as never)) throw new BadRequestException('Unité inconnue');
    if (d.photo !== undefined && !PHOTOS.includes(d.photo as never)) throw new BadRequestException('Photo : non, facultative ou obligatoire');
    if (d.procedureId && !(await this.prisma.procedure.findUnique({ where: { id: d.procedureId }, select: { id: true } }))) throw new BadRequestException('Pas-à-pas introuvable');
    const v = (x: string | null | undefined) => (x === undefined ? undefined : x?.trim() || null);
    return {
      ...(d.titre !== undefined ? { titre: d.titre.trim() } : {}),
      description: v(d.description), frequence: d.frequence, unite: d.unite, bientotJours: d.bientotJours,
      procedureId: d.procedureId === undefined ? undefined : d.procedureId || null,
      photo: d.photo, photoConsigne: v(d.photoConsigne), technicien: d.technicien,
    };
  }

  async ajouterTache(planId: string, d: TacheDto & { titre: string }) {
    await this.plan(planId);
    const ordre = ((await this.prisma.tacheEntretien.aggregate({ where: { planId }, _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    await this.prisma.tacheEntretien.create({ data: { planId, ordre, ...(await this.verifierTache(d)), titre: d.titre.trim() } });
    return this.listerPlans();
  }

  async modifierTache(id: string, d: TacheDto) {
    await this.tache(id);
    await this.prisma.tacheEntretien.update({ where: { id }, data: await this.verifierTache(d) });
    return this.listerPlans();
  }

  async deplacerTache(id: string, sens: -1 | 1) {
    const t = await this.tache(id);
    const l = await this.prisma.tacheEntretien.findMany({ where: { planId: t.planId }, orderBy: { ordre: 'asc' } });
    const i = l.findIndex((x) => x.id === id);
    const j = i + sens;
    if (j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]];
    await this.prisma.$transaction(l.map((x, n) => this.prisma.tacheEntretien.update({ where: { id: x.id }, data: { ordre: n } })));
    return this.listerPlans();
  }

  /** Supprimer une tâche : l'historique de ses lignes reste dans les carnets (sans lien vers la tâche). */
  async supprimerTache(id: string) {
    await this.tache(id);
    await this.prisma.tacheEntretien.delete({ where: { id } });
    return this.listerPlans();
  }

  // ---------- carnet d'une machine ----------
  private vue(m: Machine, maintenant = new Date()) {
    const depart = m.miseEnService ?? m.createdAt;
    const taches = m.variante.modele.plans.flatMap((p) =>
      p.taches.map((t) => {
        const faits = m.entretiens.filter((e) => e.tacheId === t.id);
        const derniere = faits[0]?.date ?? null;
        return {
          id: t.id, plan: p.nom, titre: t.titre, description: t.description, frequence: t.frequence, unite: t.unite,
          photo: t.photo, photoConsigne: t.photoConsigne, technicien: t.technicien,
          procedure: t.procedure, derniere, ...echeance(t, derniere, depart, maintenant),
        };
      }),
    );
    const ordre: Record<Etat, number> = { retard: 0, bientot: 1, ok: 2 };
    return {
      id: m.id, nom: nomMachine(m.variante), surnom: m.surnom, numeroSerie: m.numeroSerie, miseEnService: m.miseEnService,
      modeleId: m.variante.modeleId, espaces: m.variante.modele.espaces,
      client: m.user,
      taches: taches.sort((a, b) => ordre[a.etat] - ordre[b.etat] || a.prochaine.getTime() - b.prochaine.getTime()),
      etat: (taches.some((t) => t.etat === 'retard') ? 'retard' : taches.some((t) => t.etat === 'bientot') ? 'bientot' : 'ok') as Etat,
      historique: m.entretiens.map((e) => ({
        id: e.id, tacheId: e.tacheId, tache: taches.find((t) => t.id === e.tacheId)?.titre ?? null, titre: e.titre, note: e.note,
        date: e.date, source: e.source, parAdmin: e.parAdmin, auteur: e.user.nom || e.user.identifiant,
        photo: e.photoCle ? `/carnet/photos/${e.id}` : null,
      })),
    };
  }

  private async machine(id: string) {
    const m = await this.prisma.userMachine.findUnique({ where: { id }, include: MACHINE });
    if (!m) throw new NotFoundException('Machine introuvable');
    return m;
  }

  /** Carnets du client (machines visibles dans l'espace ouvert). */
  async mesCarnets(userId: string, espace: string) {
    const l = await this.prisma.userMachine.findMany({ where: { userId, variante: { modele: { espaces: { has: espace } } } }, include: MACHINE, orderBy: { createdAt: 'asc' } });
    return l.map((m) => this.vue(m));
  }

  async carnet(id: string, userId?: string) {
    const m = await this.machine(id);
    if (userId && m.userId !== userId) throw new NotFoundException('Machine introuvable');
    return this.vue(m);
  }

  /**
   * Noter une tâche faite (ou une note libre sans tâche). Client : seulement sur ses machines, pas les tâches « technicien »,
   * photo obligatoire si la tâche le demande. La prochaine échéance repart de cette date.
   */
  async noter(machineId: string, auteur: { id: string; admin: boolean }, d: FaitDto, photo?: Express.Multer.File) {
    const m = await this.machine(machineId);
    if (!auteur.admin && m.userId !== auteur.id) throw new NotFoundException('Machine introuvable');
    const tache = d.tacheId ? m.variante.modele.plans.flatMap((p) => p.taches).find((t) => t.id === d.tacheId) : null;
    if (d.tacheId && !tache) throw new BadRequestException('Cette tâche ne concerne pas cette machine');
    if (tache?.technicien && !auteur.admin) throw new ForbiddenException('Tâche réservée à un technicien');
    if (!tache && !d.titre?.trim() && !d.note?.trim()) throw new BadRequestException('Écrivez une note');
    if (tache?.photo === 'obligatoire' && !photo && !auteur.admin) throw new BadRequestException('Une photo est demandée pour cette tâche');
    const date = d.date ? new Date(`${d.date}T12:00:00Z`) : new Date();
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + JOUR || date.getUTCFullYear() < 2000) throw new BadRequestException('Date invalide');
    let photoCle: string | null = null;
    if (photo) {
      const fmt = formatImage(photo.buffer);
      if (!fmt) throw new BadRequestException('Image PNG, JPEG ou WebP attendue');
      photoCle = `carnet/${m.id}/${Date.now()}.${fmt}`;
      await this.stockage.ecrire(photoCle, photo.buffer);
    }
    const source = auteur.admin ? 'admin' : d.source === 'pasapas' ? 'pasapas' : 'client';
    const f = await this.prisma.entretienFait.create({
      data: {
        userMachineId: m.id, tacheId: tache?.id ?? null, userId: auteur.id, parAdmin: auteur.admin, date, source,
        titre: d.titre?.trim() || null, note: d.note?.trim() || null, photoCle,
      },
    });
    const vue = await this.carnet(m.id);
    if (tache) {
      const t = vue.taches.find((x) => x.id === tache.id)!;
      this.webhooks.emettre('entretien.fait', {
        entretien: { id: f.id, tache: tache.titre, date, source, note: f.note, photo: !!photoCle, prochaine: t.prochaine },
        machine: { id: m.id, nom: vue.nom, numeroSerie: m.numeroSerie }, client: m.user,
      });
    }
    return vue;
  }

  /** Retirer une ligne : le client ses propres lignes, l'admin toutes. */
  async retirer(faitId: string, auteur: { id: string; admin: boolean }) {
    const f = await this.prisma.entretienFait.findUnique({ where: { id: faitId }, include: { machine: { select: { userId: true } } } });
    if (!f || (!auteur.admin && (f.machine.userId !== auteur.id || f.userId !== auteur.id))) throw new NotFoundException('Ligne introuvable');
    await this.prisma.entretienFait.delete({ where: { id: faitId } });
    if (f.photoCle) await this.stockage.supprimer(f.photoCle);
    return this.carnet(f.userMachineId);
  }

  async lirePhoto(faitId: string, moi: { id: string; admin: boolean }) {
    const f = await this.prisma.entretienFait.findUnique({ where: { id: faitId }, include: { machine: { select: { userId: true } } } });
    if (!f?.photoCle || (!moi.admin && f.machine.userId !== moi.id)) throw new NotFoundException();
    const flux = this.stockage.lire(f.photoCle);
    if (!flux) throw new NotFoundException();
    return { flux, ext: f.photoCle.split('.').pop()! };
  }

  // ---------- suivi (admin, n8n) ----------
  /**
   * Toutes les machines qui ont un plan d'entretien, avec leurs tâches et leur état, filtrables :
   * état (retard / bientot / ok), modèle, client (nom, identifiant, n° Odoo, n° de série).
   */
  async suivi(f: { etat?: string[]; modeleId?: string; q?: string }) {
    const l = await this.prisma.userMachine.findMany({
      where: {
        user: { actif: true },
        variante: { modele: { plans: { some: {} }, ...(f.modeleId ? { id: f.modeleId } : {}) } },
      },
      include: MACHINE,
    });
    const q = f.q?.trim().toLowerCase();
    return l
      .map((m) => this.vue(m))
      .filter((m) => !q || [m.client.nom, m.client.identifiant, m.client.numeroOdoo, m.numeroSerie, m.nom, m.surnom].some((x) => x?.toLowerCase().includes(q)))
      .filter((m) => !f.etat?.length || m.taches.some((t) => f.etat!.includes(t.etat)))
      .map(({ historique: _h, ...m }) => m)
      .sort((a, b) => ({ retard: 0, bientot: 1, ok: 2 })[a.etat] - ({ retard: 0, bientot: 1, ok: 2 })[b.etat]);
  }

  /**
   * Échéances à rappeler (pour n8n : email, SMS, WhatsApp) : une ligne par tâche en retard ou bientôt due,
   * avec le client (n° Odoo pour retrouver ses coordonnées), la machine et le lien direct vers le carnet / le pas-à-pas.
   */
  async echeances(etats: string[] = ['retard', 'bientot']) {
    const base = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '');
    const machines = await this.suivi({ etat: etats });
    return machines.flatMap((m) =>
      m.taches
        .filter((t) => etats.includes(t.etat) && !t.technicien)
        .map((t) => ({
          client: m.client,
          machine: { id: m.id, nom: m.nom, surnom: m.surnom, numeroSerie: m.numeroSerie, espaces: m.espaces },
          tache: { id: t.id, titre: t.titre, etat: t.etat, prochaine: t.prochaine, jours: t.jours, derniere: t.derniere, frequence: `${t.frequence} ${t.unite.toLowerCase()}` },
          liens: {
            carnet: `${base}/carnet/${m.id}`,
            ...(t.procedure?.publiee ? { pasAPas: `${base}/procedures/${t.procedure.id}` } : {}),
          },
        })),
    );
  }

  private async plan(id: string) {
    const p = await this.prisma.planEntretien.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Plan introuvable');
    return p;
  }

  private async tache(id: string) {
    const t = await this.prisma.tacheEntretien.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Tâche introuvable');
    return t;
  }
}
