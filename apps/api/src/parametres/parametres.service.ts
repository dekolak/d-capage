import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Paramètres de l'app modifiables par l'admin, avec leur valeur par défaut. */
export const PARAMETRES = {
  /** Affiche le bouton « Demander de l'aide à Lazzeko » sur les fiches. */
  aideSupport: false,
};
export type Parametres = typeof PARAMETRES;

@Injectable()
export class ParametresService {
  constructor(private prisma: PrismaService) {}

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
