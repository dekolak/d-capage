import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CorrectionGuide, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatImage, StockageService } from '../stockage/stockage.service';
import { Guide, GuidesService } from './guides.service';
import { assurerCategorie } from '../categories/assurer';

/** Champs d'une fiche de bouton modifiables dans l'app. */
export interface CorrectionPastille {
  titre: string;
  texte: string;
  conseil?: string | null;
  niveau?: 'astuce' | 'avertissement' | 'a_completer' | null;
  mots_cles?: string[];
}

type Scene = { cap?: string; etapes?: { cap?: string; corrige?: boolean }[]; corrige?: boolean };

/**
 * Corrections des guides faites par l'admin depuis l'app (fiches des boutons, sous-titres et photos des animations).
 * Elles sont enregistrées en base et appliquées par-dessus les fichiers d'origine : une mise à jour des fichiers
 * ne les efface pas, et supprimer une correction revient à l'original.
 */

@Injectable()
export class CorrectionsService {
  constructor(private prisma: PrismaService, private stockage: StockageService, private guides: GuidesService) {}

  /** Guide avec les corrections ; pour l'admin, les éléments corrigés portent `corrige: true`. */
  async guide(slug: string, admin: boolean): Promise<Guide> {
    const base = this.guides.brut(slug);
    const liste = await this.prisma.correctionGuide.findMany({ where: { guide: slug } });
    const g = liste.length ? this.appliquer(structuredClone(base), liste, admin) : base;
    return admin ? g : this.guides.pourClient(g);
  }

  private appliquer(g: Guide, liste: CorrectionGuide[], admin: boolean): Guide {
    const marque = admin ? { corrige: true } : {};
    for (const c of liste) {
      const v = c.valeur as Record<string, unknown>;
      const morceaux = c.cle.split('/');
      if (c.type === 'pastille') {
        const [ecran, id] = morceaux;
        const p = g.ecrans.find((e) => e.id === ecran)?.pastilles.find((x) => x.id === id);
        if (!p) continue;
        const pv = v as unknown as CorrectionPastille;
        Object.assign(p, { titre: pv.titre, texte: pv.texte, mots_cles: pv.mots_cles ?? [] }, marque);
        if (pv.conseil) p.conseil = pv.conseil;
        else delete p.conseil;
        if (pv.niveau) p.niveau = pv.niveau;
        else delete p.niveau;
      } else if (c.type === 'etape') {
        const [anim, scene, etape] = morceaux;
        const s = g.animations?.find((a) => a.id === anim)?.scenes[Number(scene)] as Scene | undefined;
        if (!s) continue;
        const cible = s.etapes ? s.etapes[Number(etape)] : s;
        if (cible) Object.assign(cible, { cap: String(v.cap ?? '') }, marque);
      } else if (c.type === 'animation') {
        const a = g.animations?.find((x) => x.id === c.cle);
        if (a && typeof v.categorie === 'string') Object.assign(a, { categorie: v.categorie }, admin ? { categorieCorrigee: true } : {});
      } else if (c.type === 'photo') {
        const [anim, cle] = morceaux;
        const ph = g.animations?.find((a) => a.id === anim)?.photos?.[cle];
        if (ph && c.photoCle) Object.assign(ph, { image: `/api/guides/corrections/${c.id}/photo?v=${c.updatedAt.getTime()}` }, marque);
      }
    }
    return g;
  }

  private animation(slug: string, anim: string) {
    const a = this.guides.brut(slug).animations?.find((x) => x.id === anim);
    if (!a) throw new NotFoundException('Animation introuvable');
    return a;
  }

  private async enregistrer(guide: string, type: string, cle: string, data: { valeur?: Prisma.InputJsonValue; photoCle?: string | null }) {
    await this.prisma.correctionGuide.upsert({
      where: { guide_type_cle: { guide, type, cle } },
      create: { guide, type, cle, valeur: data.valeur ?? {}, photoCle: data.photoCle ?? null },
      update: data,
    });
    return this.guide(guide, true);
  }

  corrigerPastille(slug: string, ecran: string, pastille: string, v: CorrectionPastille) {
    const e = this.guides.brut(slug).ecrans.find((x) => x.id === ecran);
    if (!e?.pastilles.some((p) => p.id === pastille)) throw new NotFoundException('Bouton introuvable');
    const valeur = {
      titre: v.titre.trim(),
      texte: v.texte.trim(),
      conseil: v.conseil?.trim() || null,
      niveau: v.niveau || null,
      mots_cles: [...new Set((v.mots_cles ?? []).map((m) => m.trim()).filter(Boolean))],
    };
    return this.enregistrer(slug, 'pastille', `${ecran}/${pastille}`, { valeur });
  }

  corrigerEtape(slug: string, anim: string, scene: number, etape: number, cap: string) {
    const s = this.animation(slug, anim).scenes[scene] as Scene | undefined;
    const cible = s && (s.etapes ? s.etapes[etape] : etape === 0 ? s : undefined);
    if (!cible || cible.cap === undefined) throw new NotFoundException('Sous-titre introuvable');
    return this.enregistrer(slug, 'etape', `${anim}/${scene}/${etape}`, { valeur: { cap: cap.trim() } });
  }

  async remplacerPhoto(slug: string, anim: string, cle: string, f?: Express.Multer.File) {
    if (!this.animation(slug, anim).photos?.[cle]) throw new NotFoundException('Photo introuvable');
    if (!f) throw new BadRequestException('Photo manquante');
    const fmt = formatImage(f.buffer);
    if (!fmt) throw new BadRequestException('Image PNG, JPEG ou WebP attendue');
    const ancienne = await this.prisma.correctionGuide.findUnique({ where: { guide_type_cle: { guide: slug, type: 'photo', cle: `${anim}/${cle}` } } });
    const photoCle = `guides/${slug}/${anim}-${cle}-${Date.now()}.${fmt}`;
    await this.stockage.ecrire(photoCle, f.buffer);
    if (ancienne?.photoCle) await this.stockage.supprimer(ancienne.photoCle);
    return this.enregistrer(slug, 'photo', `${anim}/${cle}`, { photoCle });
  }

  /** Catégorie d'une animation sur l'accueil. */
  async categorieAnimation(slug: string, anim: string, categorie: string) {
    this.animation(slug, anim);
    await assurerCategorie(this.prisma, categorie);
    return this.enregistrer(slug, 'animation', anim, { valeur: { categorie: categorie.trim() } });
  }

  /** Catégories corrigées des animations, par guide puis animation (pour la liste des guides). */
  async categoriesAnimations(): Promise<Record<string, Record<string, string>>> {
    const l = await this.prisma.correctionGuide.findMany({ where: { type: 'animation' } });
    const r: Record<string, Record<string, string>> = {};
    for (const c of l) {
      const v = c.valeur as { categorie?: string };
      if (v.categorie) (r[c.guide] ??= {})[c.cle] = v.categorie;
    }
    return r;
  }

  /** Ordre des démos animées dans leur catégorie de l'accueil, par guide puis animation. */
  async ordresAnimations(): Promise<Record<string, Record<string, number>>> {
    const l = await this.prisma.correctionGuide.findMany({ where: { type: 'animation-ordre' } });
    const r: Record<string, Record<string, number>> = {};
    for (const c of l) {
      const v = c.valeur as { ordre?: number };
      if (typeof v.ordre === 'number') (r[c.guide] ??= {})[c.cle] = v.ordre;
    }
    return r;
  }

  /** Range des démos animées dans cet ordre (0, 1, 2…). */
  async ordonnerAnimations(l: { guide: string; id: string }[]) {
    for (const a of l) this.animation(a.guide, a.id);
    await this.prisma.$transaction(
      l.map((a, n) =>
        this.prisma.correctionGuide.upsert({
          where: { guide_type_cle: { guide: a.guide, type: 'animation-ordre', cle: a.id } },
          create: { guide: a.guide, type: 'animation-ordre', cle: a.id, valeur: { ordre: n } },
          update: { valeur: { ordre: n } },
        }),
      ),
    );
  }

  /** Revenir à l'original. */
  async retirer(slug: string, type: 'pastille' | 'etape' | 'photo' | 'animation', cle: string) {
    const c = await this.prisma.correctionGuide.findUnique({ where: { guide_type_cle: { guide: slug, type, cle } } });
    if (c) {
      if (c.photoCle) await this.stockage.supprimer(c.photoCle);
      await this.prisma.correctionGuide.delete({ where: { id: c.id } });
    }
    return this.guide(slug, true);
  }

  async lirePhoto(id: string) {
    const c = await this.prisma.correctionGuide.findUnique({ where: { id } });
    const flux = c?.photoCle ? this.stockage.lire(c.photoCle) : null;
    if (!c?.photoCle || !flux) throw new NotFoundException();
    return { flux, ext: c.photoCle.split('.').pop()! };
  }
}
