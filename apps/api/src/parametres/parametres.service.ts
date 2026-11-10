import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { espace } from '../espaces/espaces';
import { PrismaService } from '../prisma/prisma.service';
import { CONDITIONS_DEFAUT } from './conditions-defaut';

/** Paramètres de l'app modifiables par l'admin, avec leur valeur par défaut. */
export const PARAMETRES = {
  /** Affiche le bouton « Demander de l'aide » sur les fiches (espace Lazzeko). */
  aideSupport: false,
};
export type Parametres = typeof PARAMETRES;

export interface Conditions {
  espace: string;
  version: number;
  texte: string;
}

/** Les conditions d'utilisation sont rangées par espace, sous la clé `conditions:<espace>`. */
const cleConditions = (e: string) => `conditions:${e}`;

@Injectable()
export class ParametresService {
  private cacheVersions = new Map<string, { v: number; t: number }>();

  constructor(private prisma: PrismaService) {}

  async conditions(slug: string): Promise<Conditions> {
    if (!espace(slug)) throw new NotFoundException('Espace inconnu');
    const l = await this.prisma.parametre.findUnique({ where: { cle: cleConditions(slug) } });
    const v = (l?.valeur ?? {}) as { version?: number; texte?: string };
    return { espace: slug, version: v.version ?? 1, texte: v.texte ?? CONDITIONS_DEFAUT[slug] ?? '' };
  }

  /** Version courante des conditions d'un espace (cache 30 s : lue à chaque requête par la garde). */
  async versionConditions(slug: string): Promise<number> {
    const c = this.cacheVersions.get(slug);
    if (c && Date.now() - c.t < 30_000) return c.v;
    const v = (await this.conditions(slug)).version;
    this.cacheVersions.set(slug, { v, t: Date.now() });
    return v;
  }

  /** Publie un nouveau texte pour un espace : version + 1, chacun devra l'accepter de nouveau. */
  async publierConditions(slug: string, texte: string): Promise<Conditions> {
    const version = (await this.conditions(slug)).version + 1;
    const valeur = { version, texte };
    await this.prisma.parametre.upsert({ where: { cle: cleConditions(slug) }, update: { valeur }, create: { cle: cleConditions(slug), valeur } });
    this.cacheVersions.delete(slug);
    return { espace: slug, version, texte };
  }

  async tous(): Promise<Parametres> {
    const lignes = await this.prisma.parametre.findMany({ where: { cle: { in: Object.keys(PARAMETRES) } } });
    const v: Record<string, unknown> = { ...PARAMETRES };
    for (const l of lignes) v[l.cle] = l.valeur;
    return v as Parametres;
  }

  async valeur<K extends keyof Parametres>(k: K): Promise<Parametres[K]> {
    return (await this.tous())[k];
  }

  async modifier(p: Partial<Parametres>) {
    for (const [cle, valeur] of Object.entries(p))
      if (cle in PARAMETRES && valeur !== undefined)
        await this.prisma.parametre.upsert({
          where: { cle },
          update: { valeur: valeur as Prisma.InputJsonValue },
          create: { cle, valeur: valeur as Prisma.InputJsonValue },
        });
    return this.tous();
  }
}
