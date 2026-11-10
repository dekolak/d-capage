import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GuidesService } from '../guides/guides.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatImage, StockageService } from '../stockage/stockage.service';

export interface LienDto { guide?: string | null; ecran?: string | null; pastille?: string | null }

const avecEtapes = { etapes: { orderBy: { ordre: 'asc' } } } satisfies Prisma.ProcedureInclude;
type ProcedureComplete = Prisma.ProcedureGetPayload<{ include: typeof avecEtapes }>;

/** Procédures Kiavik : lecture pour les clients (publiées), édition pour l'admin. */
@Injectable()
export class ProceduresService {
  constructor(private prisma: PrismaService, private stockage: StockageService, private guides: GuidesService) {}

  private vue(p: ProcedureComplete) {
    return {
      id: p.id, titre: p.titre, categorie: p.categorie, resume: p.resume, publiee: p.publiee, ordre: p.ordre, updatedAt: p.updatedAt,
      etapes: p.etapes.map(({ photoCle, photoMaj, procedureId: _p, ...e }) => ({
        ...e,
        photo: photoCle ? `/procedures/etapes/${e.id}/photo?v=${photoMaj?.getTime() ?? 0}` : null,
      })),
    };
  }

  /** Liste (sans le texte des étapes, avec les liens vers les pastilles pour l'affichage dans les guides). */
  async lister(admin: boolean) {
    const l = await this.prisma.procedure.findMany({
      where: admin ? {} : { publiee: true },
      orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
      include: { etapes: { orderBy: { ordre: 'asc' }, select: { texte: true, guide: true, ecran: true, pastille: true } } },
    });
    return l.map(({ etapes, cle: _c, module: _m, createdAt: _d, ...p }) => ({
      ...p,
      nbEtapes: etapes.length,
      // texte des étapes : pour la recherche
      textes: etapes.map((e) => e.texte),
      liens: etapes.filter((e) => e.guide && e.ecran).map((e) => ({ guide: e.guide!, ecran: e.ecran!, pastille: e.pastille })),
    }));
  }

  async lire(id: string, admin: boolean) {
    const p = await this.prisma.procedure.findUnique({ where: { id }, include: avecEtapes });
    if (!p || (!admin && !p.publiee)) throw new NotFoundException('Procédure introuvable');
    return this.vue(p);
  }

  // ---------- admin ----------
  async creer(d: { titre: string; categorie?: string; resume?: string | null }) {
    const ordre = ((await this.prisma.procedure.aggregate({ _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    const p = await this.prisma.procedure.create({ data: { ...d, ordre }, include: avecEtapes });
    return this.vue(p);
  }

  async modifier(id: string, d: Prisma.ProcedureUpdateInput) {
    await this.existe(id);
    return this.vue(await this.prisma.procedure.update({ where: { id }, data: d, include: avecEtapes }));
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

  async ajouterEtape(id: string, d: { texte: string; avertissement?: string | null } & LienDto) {
    await this.existe(id);
    const ordre = ((await this.prisma.etapeProcedure.aggregate({ where: { procedureId: id }, _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    await this.prisma.etapeProcedure.create({
      data: { procedureId: id, ordre, texte: d.texte, avertissement: d.avertissement || null, ...this.verifierLien(d) },
    });
    return this.lire(id, true);
  }

  async modifierEtape(etapeId: string, d: { texte?: string; avertissement?: string | null } & LienDto) {
    const e = await this.etape(etapeId);
    await this.prisma.etapeProcedure.update({
      where: { id: etapeId },
      data: {
        ...(d.texte !== undefined ? { texte: d.texte } : {}),
        ...(d.avertissement !== undefined ? { avertissement: d.avertissement || null } : {}),
        ...this.verifierLien(d),
      },
    });
    return this.lire(e.procedureId, true);
  }

  /** Monter (-1) ou descendre (+1) une étape. */
  async deplacerEtape(etapeId: string, sens: -1 | 1) {
    const e = await this.etape(etapeId);
    const liste = await this.prisma.etapeProcedure.findMany({ where: { procedureId: e.procedureId }, orderBy: { ordre: 'asc' } });
    const i = liste.findIndex((x) => x.id === etapeId);
    const j = i + sens;
    if (j >= 0 && j < liste.length) {
      [liste[i], liste[j]] = [liste[j], liste[i]];
      await this.prisma.$transaction(liste.map((x, n) => this.prisma.etapeProcedure.update({ where: { id: x.id }, data: { ordre: n } })));
    }
    return this.lire(e.procedureId, true);
  }

  async supprimerEtape(etapeId: string) {
    const e = await this.etape(etapeId);
    if (e.photoCle) await this.stockage.supprimer(e.photoCle);
    await this.prisma.etapeProcedure.delete({ where: { id: etapeId } });
    return this.lire(e.procedureId, true);
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
    return this.lire(e.procedureId, true);
  }

  async retirerPhoto(etapeId: string) {
    const e = await this.etape(etapeId);
    if (e.photoCle) await this.stockage.supprimer(e.photoCle);
    await this.prisma.etapeProcedure.update({ where: { id: etapeId }, data: { photoCle: null, photoMaj: null } });
    return this.lire(e.procedureId, true);
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
