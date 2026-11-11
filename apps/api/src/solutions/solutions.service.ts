import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Solution } from '@prisma/client';
import { GuidesService } from '../guides/guides.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatImage, StockageService } from '../stockage/stockage.service';
import { assurerCategorie } from '../categories/assurer';

export interface SolutionDto {
  titre?: string; categorie?: string; cause?: string | null; texte?: string; avertissement?: string | null; motsCles?: string[];
  guide?: string | null; ecran?: string | null; pastille?: string | null; procedureId?: string | null; publiee?: boolean; ordre?: number;
}

/** Fiches « Astuces & solutions » : lecture (publiées pour les clients), édition par l'admin. */
@Injectable()
export class SolutionsService {
  constructor(private prisma: PrismaService, private stockage: StockageService, private guides: GuidesService) {}

  private vue({ photoCle, photoMaj, cle: _c, module: _m, ...s }: Solution) {
    return { ...s, photo: photoCle ? `/solutions/${s.id}/photo?v=${photoMaj?.getTime() ?? 0}` : null };
  }

  async lister(admin: boolean) {
    const l = await this.prisma.solution.findMany({ where: admin ? {} : { publiee: true }, orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }] });
    return l.map((s) => this.vue(s));
  }

  async lire(id: string, admin: boolean) {
    const s = await this.prisma.solution.findUnique({ where: { id } });
    if (!s || (!admin && !s.publiee)) throw new NotFoundException('Fiche introuvable');
    return this.vue(s);
  }

  /** Nettoie les champs et vérifie les liens (bouton du guide, procédure). */
  private async donnees(d: SolutionDto) {
    const r: Record<string, unknown> = { ...d };
    for (const k of ['cause', 'avertissement'] as const) if (d[k] !== undefined) r[k] = d[k]?.trim() || null;
    for (const k of ['titre', 'texte', 'categorie'] as const) if (d[k] !== undefined) r[k] = d[k]!.trim();
    if (d.categorie !== undefined) await assurerCategorie(this.prisma, d.categorie);
    if (d.motsCles) r.motsCles = [...new Set(d.motsCles.map((m) => m.trim()).filter(Boolean))];
    if (d.guide !== undefined || d.ecran !== undefined || d.pastille !== undefined) {
      if (!d.guide || !d.ecran) Object.assign(r, { guide: null, ecran: null, pastille: null });
      else if (!this.guides.lienValide(d.guide, d.ecran, d.pastille)) throw new BadRequestException('Bouton du guide introuvable');
      else r.pastille = d.pastille || null;
    }
    if (d.procedureId) {
      if (!(await this.prisma.procedure.findUnique({ where: { id: d.procedureId }, select: { id: true } }))) throw new BadRequestException('Procédure introuvable');
    } else if (d.procedureId !== undefined) r.procedureId = null;
    return r;
  }

  async creer(d: SolutionDto & { titre: string; texte: string }) {
    const ordre = ((await this.prisma.solution.aggregate({ _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    return this.vue(await this.prisma.solution.create({ data: { ...(await this.donnees(d)), ordre } as never }));
  }

  async modifier(id: string, d: SolutionDto) {
    await this.existe(id);
    return this.vue(await this.prisma.solution.update({ where: { id }, data: (await this.donnees(d)) as never }));
  }

  async supprimer(id: string) {
    const s = await this.existe(id);
    if (s.photoCle) await this.stockage.supprimer(s.photoCle);
    await this.prisma.solution.delete({ where: { id } });
    return { ok: true };
  }

  async photo(id: string, f?: Express.Multer.File) {
    const s = await this.existe(id);
    if (!f) throw new BadRequestException('Photo manquante');
    const fmt = formatImage(f.buffer);
    if (!fmt) throw new BadRequestException('Image PNG, JPEG ou WebP attendue');
    const cle = `solutions/${id}-${Date.now()}.${fmt}`;
    await this.stockage.ecrire(cle, f.buffer);
    if (s.photoCle) await this.stockage.supprimer(s.photoCle);
    return this.vue(await this.prisma.solution.update({ where: { id }, data: { photoCle: cle, photoMaj: new Date() } }));
  }

  async retirerPhoto(id: string) {
    const s = await this.existe(id);
    if (s.photoCle) await this.stockage.supprimer(s.photoCle);
    return this.vue(await this.prisma.solution.update({ where: { id }, data: { photoCle: null, photoMaj: null } }));
  }

  async lirePhoto(id: string, admin: boolean) {
    const s = await this.prisma.solution.findUnique({ where: { id } });
    if (!s?.photoCle || (!admin && !s.publiee)) throw new NotFoundException();
    const flux = this.stockage.lire(s.photoCle);
    if (!flux) throw new NotFoundException();
    return { flux, ext: s.photoCle.split('.').pop()! };
  }

  private async existe(id: string) {
    const s = await this.prisma.solution.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Fiche introuvable');
    return s;
  }
}
