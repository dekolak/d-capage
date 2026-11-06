import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CONDITIONS_DEFAUT } from './conditions-defaut';

/** Paramètres de l'app modifiables par l'admin, avec leur valeur par défaut. */
export const PARAMETRES = {
  /** Affiche le bouton « Demander de l'aide à Lazzeko » sur les fiches. */
  aideSupport: false,
  /** Version des conditions d'utilisation : l'augmenter oblige chaque utilisateur à les accepter de nouveau. */
  conditionsVersion: 1,
  conditionsTexte: CONDITIONS_DEFAUT,
};
export type Parametres = typeof PARAMETRES;

@Injectable()
export class ParametresService {
  private cacheVersion?: { v: number; t: number };

  constructor(private prisma: PrismaService) {}

  /** Version courante des conditions (cache 30 s : lue à chaque requête par la garde). */
  async versionConditions(): Promise<number> {
    if (this.cacheVersion && Date.now() - this.cacheVersion.t < 30_000) return this.cacheVersion.v;
    const v = await this.valeur('conditionsVersion');
    this.cacheVersion = { v, t: Date.now() };
    return v;
  }

  /** Publie un nouveau texte : version + 1, tout le monde devra l'accepter. */
  async publierConditions(texte: string) {
    const v = (await this.valeur('conditionsVersion')) + 1;
    await this.modifier({ conditionsTexte: texte, conditionsVersion: v });
    this.cacheVersion = undefined;
    return { version: v, texte };
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
