import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GuidesService } from '../guides/guides.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatImage, StockageService } from '../stockage/stockage.service';
import { SUITES } from './chemin';
import { assurerCategorie } from '../categories/assurer';

export interface LienDto { guide?: string | null; ecran?: string | null; pastille?: string | null }
export interface ControleDto { controle?: boolean; solutionId?: string | null }
export interface ChoixDto {
  libelle?: string; signification?: string | null; suite?: string; etapeCibleId?: string | null;
  conclusion?: string | null; solutionId?: string | null; procedureCibleId?: string | null;
}

const avecEtapes = {
  etapes: { orderBy: { ordre: 'asc' }, include: { choix: { orderBy: { ordre: 'asc' } }, photos: { orderBy: { ordre: 'asc' } } } },
} satisfies Prisma.ProcedureInclude;
/** Photos par étape, au plus. */
export const MAX_PHOTOS = 8;
type ProcedureComplete = Prisma.ProcedureGetPayload<{ include: typeof avecEtapes }>;

/** Procédures Kiavik : lecture pour les clients (publiées), édition pour l'admin. */
@Injectable()
export class ProceduresService {
  constructor(private prisma: PrismaService, private stockage: StockageService, private guides: GuidesService) {}

  /** Vue d'une procédure. Pour le client : sans description, prompt, notes ni significations (réservés à l'admin et à l'IA). */
  private vue(p: ProcedureComplete, admin = true) {
    return {
      id: p.id, titre: p.titre, categorie: p.categorie, resume: p.resume, publiee: p.publiee, ordre: p.ordre, updatedAt: p.updatedAt,
      suivanteId: p.suivanteId,
      ...(admin ? { description: p.description, prompt: p.prompt, resumeIa: p.resumeIa, resumeIaLe: p.resumeIaLe } : {}),
      etapes: p.etapes.map(({ photos, procedureId: _p, note, choix, ...e }) => ({
        ...e,
        ...(admin ? { note } : {}),
        // adresse fixe par photo (une photo n'est jamais modifiée, seulement ajoutée ou supprimée)
        photos: photos.map((ph) => ({ id: ph.id, url: `/procedures/photos/${ph.id}` })),
        photo: photos[0] ? `/procedures/photos/${photos[0].id}` : null,
        choix: choix.map(({ etapeId: _e, signification, ...c }) => ({ ...c, ...(admin ? { signification } : {}) })),
      })),
    };
  }

  /** Après une modification par l'admin : date de mise à jour (pour savoir si le résumé IA est à refaire), puis la procédure. */
  private async modifiee(id: string) {
    await this.prisma.procedure.update({ where: { id }, data: { updatedAt: new Date() } });
    return this.lire(id, true);
  }

  /** Liste (sans le texte des étapes, avec les liens vers les pastilles pour l'affichage dans les guides). */
  async lister(admin: boolean) {
    const l = await this.prisma.procedure.findMany({
      where: admin ? {} : { publiee: true },
      orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
      include: { etapes: { orderBy: { ordre: 'asc' }, select: { texte: true, guide: true, ecran: true, pastille: true, _count: { select: { choix: true } } } } },
    });
    return l.map(({ etapes, cle: _c, module: _m, createdAt: _d, description, prompt: _pr, resumeIa: _r, resumeIaLe: _rl, ...p }) => ({
      ...p,
      ...(admin ? { description } : {}),
      /** Contient des questions (diagnostic). */
      diagnostic: etapes.some((e) => e._count.choix > 0),
      nbEtapes: etapes.length,
      // texte des étapes : pour la recherche
      textes: etapes.map((e) => e.texte),
      liens: etapes.filter((e) => e.guide && e.ecran).map((e) => ({ guide: e.guide!, ecran: e.ecran!, pastille: e.pastille })),
    }));
  }

  async lire(id: string, admin: boolean) {
    const p = await this.prisma.procedure.findUnique({ where: { id }, include: avecEtapes });
    if (!p || (!admin && !p.publiee)) throw new NotFoundException('Procédure introuvable');
    return this.vue(p, admin);
  }

  // ---------- admin ----------
  async creer(d: { titre: string; categorie?: string; resume?: string | null; description?: string | null }) {
    await assurerCategorie(this.prisma, d.categorie ?? 'Impression');
    const ordre = ((await this.prisma.procedure.aggregate({ _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    const p = await this.prisma.procedure.create({ data: { ...d, ordre }, include: avecEtapes });
    return this.vue(p);
  }

  /**
   * Copie complète d'une procédure (brouillon) : étapes, questions, réponses, détours, sauts et photos.
   * Les étapes sont recréées ligne par ligne : la route principale, puis les détours dont la réponse est déjà copiée.
   */
  async dupliquer(id: string) {
    const p = await this.prisma.procedure.findUnique({ where: { id }, include: avecEtapes });
    if (!p) throw new NotFoundException('Procédure introuvable');
    const ordre = ((await this.prisma.procedure.aggregate({ _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    const copie = await this.prisma.procedure.create({
      data: {
        titre: `${p.titre} (copie)`.slice(0, 120), categorie: p.categorie, resume: p.resume, description: p.description, prompt: p.prompt,
        publiee: false, ordre, suivanteId: p.suivanteId,
      },
    });
    const idEtape = new Map<string, string>();
    const idChoix = new Map<string, string>();
    const sauts: { choix: string; cible: string }[] = [];
    let restantes = [...p.etapes];
    while (restantes.length) {
      const pretes = restantes.filter((e) => !e.brancheId || idChoix.has(e.brancheId));
      if (!pretes.length) break;
      for (const e of pretes) {
        const n = await this.prisma.etapeProcedure.create({
          data: {
            procedureId: copie.id, brancheId: e.brancheId ? idChoix.get(e.brancheId)! : null, ordre: e.ordre, texte: e.texte,
            avertissement: e.avertissement, note: e.note, guide: e.guide, ecran: e.ecran, pastille: e.pastille, controle: e.controle, solutionId: e.solutionId,
          },
        });
        idEtape.set(e.id, n.id);
        for (const ph of e.photos) {
          const cle = `procedures/${copie.id}/${n.id}-${Date.now()}-${ph.ordre}.${ph.cle.split('.').pop()}`;
          if (await this.stockage.copier(ph.cle, cle)) await this.prisma.photoEtape.create({ data: { etapeId: n.id, ordre: ph.ordre, cle } });
        }
        for (const c of e.choix) {
          const nc = await this.prisma.choixEtape.create({
            data: {
              etapeId: n.id, ordre: c.ordre, libelle: c.libelle, signification: c.signification, suite: c.suite, conclusion: c.conclusion,
              solutionId: c.solutionId, procedureCibleId: c.procedureCibleId,
            },
          });
          idChoix.set(c.id, nc.id);
          if (c.etapeCibleId) sauts.push({ choix: nc.id, cible: c.etapeCibleId });
        }
      }
      restantes = restantes.filter((e) => !pretes.includes(e));
    }
    for (const s of sauts) await this.prisma.choixEtape.update({ where: { id: s.choix }, data: { etapeCibleId: idEtape.get(s.cible) ?? null } });
    return this.lire(copie.id, true);
  }

  async modifier(id: string, d: Omit<Prisma.ProcedureUncheckedUpdateInput, 'suivanteId'> & { suivanteId?: string | null }) {
    await this.existe(id);
    if (d.suivanteId) {
      if (d.suivanteId === id) throw new BadRequestException('Une procédure ne peut pas se proposer elle-même');
      await this.existe(d.suivanteId);
    }
    if (typeof d.categorie === 'string') await assurerCategorie(this.prisma, d.categorie);
    await this.prisma.procedure.update({ where: { id }, data: d });
    return this.lire(id, true);
  }

  async supprimer(id: string) {
    const p = await this.prisma.procedure.findUnique({ where: { id }, include: { etapes: { include: { photos: true } } } });
    if (!p) throw new NotFoundException();
    for (const e of p.etapes) for (const ph of e.photos) await this.stockage.supprimer(ph.cle);
    await this.prisma.procedure.delete({ where: { id } });
    return { ok: true };
  }

  private verifierLien(l: LienDto) {
    if (l.guide === undefined && l.ecran === undefined && l.pastille === undefined) return {};
    if (!l.guide || !l.ecran) return { guide: null, ecran: null, pastille: null };
    if (!this.guides.lienValide(l.guide, l.ecran, l.pastille)) throw new BadRequestException('Bouton du guide introuvable');
    return { guide: l.guide, ecran: l.ecran, pastille: l.pastille || null };
  }

  /** Contrôle Oui / Non et astuce proposée si Non (l'astuce doit exister). */
  private async verifierControle(d: ControleDto) {
    const r: { controle?: boolean; solutionId?: string | null } = {};
    if (d.controle !== undefined) r.controle = d.controle;
    if (d.solutionId !== undefined) {
      if (d.solutionId && !(await this.prisma.solution.findUnique({ where: { id: d.solutionId }, select: { id: true } })))
        throw new BadRequestException('Astuce introuvable');
      r.solutionId = d.solutionId || null;
    }
    return r;
  }

  async ajouterEtape(
    id: string,
    d: { texte: string; avertissement?: string | null; note?: string | null; position?: number; brancheId?: string | null } & LienDto & ControleDto,
  ) {
    await this.existe(id);
    const brancheId = d.brancheId || null;
    if (brancheId) {
      const c = await this.prisma.choixEtape.findUnique({ where: { id: brancheId }, select: { etape: { select: { procedureId: true } } } });
      if (c?.etape.procedureId !== id) throw new BadRequestException('Réponse introuvable');
    }
    // la place se compte dans la ligne de l'étape : route principale ou détour d'une réponse
    const liste = await this.prisma.etapeProcedure.findMany({ where: { procedureId: id, brancheId }, orderBy: { ordre: 'asc' }, select: { id: true } });
    const place = Math.min(d.position ?? liste.length, liste.length);
    const lien = this.verifierLien(d);
    const controle = await this.verifierControle(d);
    await this.prisma.$transaction([
      // on décale les étapes suivantes, puis on insère
      ...liste.slice(place).map((x, k) => this.prisma.etapeProcedure.update({ where: { id: x.id }, data: { ordre: place + k + 1 } })),
      ...liste.slice(0, place).map((x, k) => this.prisma.etapeProcedure.update({ where: { id: x.id }, data: { ordre: k } })),
      this.prisma.etapeProcedure.create({
        data: { procedureId: id, brancheId, ordre: place, texte: d.texte, avertissement: d.avertissement || null, note: d.note || null, ...lien, ...controle },
      }),
    ]);
    return this.modifiee(id);
  }

  async modifierEtape(etapeId: string, d: { texte?: string; avertissement?: string | null; note?: string | null } & LienDto & ControleDto) {
    const e = await this.etape(etapeId);
    const controle = await this.verifierControle(d);
    await this.prisma.etapeProcedure.update({
      where: { id: etapeId },
      data: {
        ...(d.texte !== undefined ? { texte: d.texte } : {}),
        ...(d.avertissement !== undefined ? { avertissement: d.avertissement || null } : {}),
        ...(d.note !== undefined ? { note: d.note || null } : {}),
        ...this.verifierLien(d),
        ...controle,
      },
    });
    return this.modifiee(e.procedureId);
  }

  /** Monter (-1) ou descendre (+1) une étape. */
  async deplacerEtape(etapeId: string, sens: -1 | 1) {
    const e = await this.etape(etapeId);
    const liste = await this.prisma.etapeProcedure.findMany({ where: { procedureId: e.procedureId, brancheId: e.brancheId }, orderBy: { ordre: 'asc' } });
    const i = liste.findIndex((x) => x.id === etapeId);
    const j = i + sens;
    if (j >= 0 && j < liste.length) {
      [liste[i], liste[j]] = [liste[j], liste[i]];
      await this.prisma.$transaction(liste.map((x, n) => this.prisma.etapeProcedure.update({ where: { id: x.id }, data: { ordre: n } })));
    }
    return this.modifiee(e.procedureId);
  }

  /** Photos d'étapes et de tous leurs détours (supprimés en cascade avec elles). */
  private async photosSous(etapeIds: string[]): Promise<string[]> {
    if (!etapeIds.length) return [];
    const etapes = await this.prisma.etapeProcedure.findMany({
      where: { id: { in: etapeIds } },
      select: { photos: { select: { cle: true } }, choix: { select: { detour: { select: { id: true } } } } },
    });
    const enfants = etapes.flatMap((e) => e.choix.flatMap((c) => c.detour.map((x) => x.id)));
    return [...etapes.flatMap((e) => e.photos.map((ph) => ph.cle)), ...(await this.photosSous(enfants))];
  }

  async supprimerEtape(etapeId: string) {
    const e = await this.etape(etapeId);
    const photos = await this.photosSous([etapeId]);
    await this.prisma.etapeProcedure.delete({ where: { id: etapeId } });
    for (const cle of photos) await this.stockage.supprimer(cle);
    return this.modifiee(e.procedureId);
  }

  /** Ajoute une photo à la fin des photos de l'étape. */
  async photo(etapeId: string, f?: Express.Multer.File) {
    const e = await this.etape(etapeId);
    if (!f) throw new BadRequestException('Photo manquante');
    const fmt = formatImage(f.buffer);
    if (!fmt) throw new BadRequestException('Image PNG, JPEG ou WebP attendue');
    const nb = await this.prisma.photoEtape.count({ where: { etapeId } });
    if (nb >= MAX_PHOTOS) throw new BadRequestException(`${MAX_PHOTOS} photos au plus par étape`);
    const ordre = ((await this.prisma.photoEtape.aggregate({ where: { etapeId }, _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    const cle = `procedures/${e.procedureId}/${etapeId}-${Date.now()}.${fmt}`;
    await this.stockage.ecrire(cle, f.buffer);
    await this.prisma.photoEtape.create({ data: { etapeId, ordre, cle } });
    return this.modifiee(e.procedureId);
  }

  /** Retire toutes les photos de l'étape. */
  async retirerPhotos(etapeId: string) {
    const e = await this.etape(etapeId);
    const photos = await this.prisma.photoEtape.findMany({ where: { etapeId } });
    await this.prisma.photoEtape.deleteMany({ where: { etapeId } });
    for (const ph of photos) await this.stockage.supprimer(ph.cle);
    return this.modifiee(e.procedureId);
  }

  async retirerPhoto(photoId: string) {
    const ph = await this.photoParId(photoId);
    await this.prisma.photoEtape.delete({ where: { id: photoId } });
    await this.stockage.supprimer(ph.cle);
    return this.modifiee(ph.etape.procedureId);
  }

  /** Avancer (-1) ou reculer (+1) une photo dans l'ordre de l'étape. */
  async deplacerPhoto(photoId: string, sens: -1 | 1) {
    const ph = await this.photoParId(photoId);
    const liste = await this.prisma.photoEtape.findMany({ where: { etapeId: ph.etapeId }, orderBy: { ordre: 'asc' } });
    const i = liste.findIndex((x) => x.id === photoId);
    const j = i + sens;
    if (j >= 0 && j < liste.length) {
      [liste[i], liste[j]] = [liste[j], liste[i]];
      await this.prisma.$transaction(liste.map((x, n) => this.prisma.photoEtape.update({ where: { id: x.id }, data: { ordre: n } })));
    }
    return this.modifiee(ph.etape.procedureId);
  }

  private async photoParId(id: string) {
    const ph = await this.prisma.photoEtape.findUnique({ where: { id }, include: { etape: { select: { procedureId: true } } } });
    if (!ph) throw new NotFoundException('Photo introuvable');
    return ph;
  }

  // ---------- questions : réponses possibles ----------
  /** Ajoute une réponse à une étape, qui devient une question (et n'est plus une simple étape de contrôle). */
  async ajouterChoix(etapeId: string, libelle: string) {
    const e = await this.etape(etapeId);
    const ordre = ((await this.prisma.choixEtape.aggregate({ where: { etapeId }, _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    await this.prisma.$transaction([
      this.prisma.choixEtape.create({ data: { etapeId, ordre, libelle } }),
      this.prisma.etapeProcedure.update({ where: { id: etapeId }, data: { controle: false, solutionId: null } }),
    ]);
    return this.modifiee(e.procedureId);
  }

  async modifierChoix(id: string, d: ChoixDto) {
    const c = await this.choix(id);
    const procedureId = c.etape.procedureId;
    if (d.suite !== undefined && !SUITES.includes(d.suite as never)) throw new BadRequestException('Suite inconnue');
    if (d.etapeCibleId) {
      const cible = await this.prisma.etapeProcedure.findUnique({ where: { id: d.etapeCibleId }, select: { procedureId: true, brancheId: true } });
      if (cible?.procedureId !== procedureId || cible.brancheId) throw new BadRequestException('Étape de la route principale attendue');
    }
    if (d.solutionId && !(await this.prisma.solution.findUnique({ where: { id: d.solutionId }, select: { id: true } }))) throw new BadRequestException('Astuce introuvable');
    if (d.procedureCibleId && !(await this.prisma.procedure.findUnique({ where: { id: d.procedureCibleId }, select: { id: true } })))
      throw new BadRequestException('Procédure introuvable');
    const vide = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
    await this.prisma.choixEtape.update({
      where: { id },
      data: {
        libelle: d.libelle?.trim() || undefined,
        signification: vide(d.signification),
        suite: d.suite,
        etapeCibleId: d.etapeCibleId === undefined ? undefined : d.etapeCibleId || null,
        conclusion: vide(d.conclusion),
        solutionId: d.solutionId === undefined ? undefined : d.solutionId || null,
        procedureCibleId: d.procedureCibleId === undefined ? undefined : d.procedureCibleId || null,
      },
    });
    return this.modifiee(procedureId);
  }

  async deplacerChoix(id: string, sens: -1 | 1) {
    const c = await this.choix(id);
    const liste = await this.prisma.choixEtape.findMany({ where: { etapeId: c.etapeId }, orderBy: { ordre: 'asc' } });
    const i = liste.findIndex((x) => x.id === id);
    const j = i + sens;
    if (j >= 0 && j < liste.length) {
      [liste[i], liste[j]] = [liste[j], liste[i]];
      await this.prisma.$transaction(liste.map((x, n) => this.prisma.choixEtape.update({ where: { id: x.id }, data: { ordre: n } })));
    }
    return this.modifiee(c.etape.procedureId);
  }

  /** Supprime une réponse et les étapes de son détour. */
  async supprimerChoix(id: string) {
    const c = await this.choix(id);
    const detour = await this.prisma.etapeProcedure.findMany({ where: { brancheId: id }, select: { id: true } });
    const photos = await this.photosSous(detour.map((x) => x.id));
    await this.prisma.choixEtape.delete({ where: { id } });
    for (const cle of photos) await this.stockage.supprimer(cle);
    return this.modifiee(c.etape.procedureId);
  }

  private async choix(id: string) {
    const c = await this.prisma.choixEtape.findUnique({ where: { id }, include: { etape: { select: { procedureId: true } } } });
    if (!c) throw new NotFoundException('Réponse introuvable');
    return c;
  }

  /** Photo (procédure publiée, ou admin). Par son id, ou la première photo d'une étape (`etapeId`, anciennes adresses). */
  async lirePhoto(q: { id?: string; etapeId?: string }, admin: boolean) {
    const ph = await this.prisma.photoEtape.findFirst({
      where: q.id ? { id: q.id } : { etapeId: q.etapeId },
      orderBy: { ordre: 'asc' },
      include: { etape: { select: { procedure: { select: { publiee: true } } } } },
    });
    if (!ph || (!admin && !ph.etape.procedure.publiee)) throw new NotFoundException();
    const flux = this.stockage.lire(ph.cle);
    if (!flux) throw new NotFoundException();
    return { flux, ext: ph.cle.split('.').pop()! };
  }

  private async existe(id: string) {
    if (!(await this.prisma.procedure.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Procédure introuvable');
  }

  private async etape(id: string) {
    const e = await this.prisma.etapeProcedure.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Étape introuvable');
    return e;
  }
}
