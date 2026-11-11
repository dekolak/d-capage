import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GuidesService } from '../guides/guides.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatImage, StockageService } from '../stockage/stockage.service';
import { SUITES } from './chemin';

export interface LienDto { guide?: string | null; ecran?: string | null; pastille?: string | null }
export interface ControleDto { controle?: boolean; solutionId?: string | null }
export interface ChoixDto {
  libelle?: string; signification?: string | null; suite?: string; etapeCibleId?: string | null;
  conclusion?: string | null; solutionId?: string | null; procedureCibleId?: string | null;
}

const avecEtapes = { etapes: { orderBy: { ordre: 'asc' }, include: { choix: { orderBy: { ordre: 'asc' } } } } } satisfies Prisma.ProcedureInclude;
type ProcedureComplete = Prisma.ProcedureGetPayload<{ include: typeof avecEtapes }>;

/** Procédures Kiavik : lecture pour les clients (publiées), édition pour l'admin. */
@Injectable()
export class ProceduresService {
  constructor(private prisma: PrismaService, private stockage: StockageService, private guides: GuidesService) {}

  /** Vue d'une procédure. Pour le client : sans description, prompt, notes ni significations (réservés à l'admin et à l'IA). */
  private vue(p: ProcedureComplete, admin = true) {
    return {
      id: p.id, titre: p.titre, categorie: p.categorie, resume: p.resume, publiee: p.publiee, ordre: p.ordre, updatedAt: p.updatedAt,
      ...(admin ? { description: p.description, prompt: p.prompt, resumeIa: p.resumeIa, resumeIaLe: p.resumeIaLe } : {}),
      etapes: p.etapes.map(({ photoCle, photoMaj, procedureId: _p, note, choix, ...e }) => ({
        ...e,
        ...(admin ? { note } : {}),
        photo: photoCle ? `/procedures/etapes/${e.id}/photo?v=${photoMaj?.getTime() ?? 0}` : null,
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
    const ordre = ((await this.prisma.procedure.aggregate({ _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    const p = await this.prisma.procedure.create({ data: { ...d, ordre }, include: avecEtapes });
    return this.vue(p);
  }

  async modifier(id: string, d: Prisma.ProcedureUpdateInput) {
    await this.existe(id);
    await this.prisma.procedure.update({ where: { id }, data: d });
    return this.lire(id, true);
  }

  async supprimer(id: string) {
    const p = await this.prisma.procedure.findUnique({ where: { id }, include: { etapes: true } });
    if (!p) throw new NotFoundException();
    for (const e of p.etapes) if (e.photoCle) await this.stockage.supprimer(e.photoCle);
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
    const etapes = await this.prisma.etapeProcedure.findMany({ where: { id: { in: etapeIds } }, select: { photoCle: true, choix: { select: { detour: { select: { id: true } } } } } });
    const enfants = etapes.flatMap((e) => e.choix.flatMap((c) => c.detour.map((x) => x.id)));
    return [...etapes.flatMap((e) => (e.photoCle ? [e.photoCle] : [])), ...(await this.photosSous(enfants))];
  }

  async supprimerEtape(etapeId: string) {
    const e = await this.etape(etapeId);
    const photos = await this.photosSous([etapeId]);
    await this.prisma.etapeProcedure.delete({ where: { id: etapeId } });
    for (const cle of photos) await this.stockage.supprimer(cle);
    return this.modifiee(e.procedureId);
  }

  async photo(etapeId: string, f?: Express.Multer.File) {
    const e = await this.etape(etapeId);
    if (!f) throw new BadRequestException('Photo manquante');
    const fmt = formatImage(f.buffer);
    if (!fmt) throw new BadRequestException('Image PNG, JPEG ou WebP attendue');
    const cle = `procedures/${e.procedureId}/${etapeId}-${Date.now()}.${fmt}`;
    await this.stockage.ecrire(cle, f.buffer);
    if (e.photoCle) await this.stockage.supprimer(e.photoCle);
    await this.prisma.etapeProcedure.update({ where: { id: etapeId }, data: { photoCle: cle, photoMaj: new Date() } });
    return this.modifiee(e.procedureId);
  }

  async retirerPhoto(etapeId: string) {
    const e = await this.etape(etapeId);
    if (e.photoCle) await this.stockage.supprimer(e.photoCle);
    await this.prisma.etapeProcedure.update({ where: { id: etapeId }, data: { photoCle: null, photoMaj: null } });
    return this.modifiee(e.procedureId);
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

  /** Photo d'une étape (procédure publiée, ou admin). */
  async lirePhoto(etapeId: string, admin: boolean) {
    const e = await this.prisma.etapeProcedure.findUnique({ where: { id: etapeId }, include: { procedure: { select: { publiee: true } } } });
    if (!e?.photoCle || (!admin && !e.procedure.publiee)) throw new NotFoundException();
    const flux = this.stockage.lire(e.photoCle);
    if (!flux) throw new NotFoundException();
    return { flux, ext: e.photoCle.split('.').pop()! };
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
