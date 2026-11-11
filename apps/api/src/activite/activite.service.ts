import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Durée de conservation du journal (indiquée dans les conditions d'utilisation). */
export const CONSERVATION_JOURS = 365;

export interface NouvelleActivite { type: 'connexion' | 'page' | 'recherche'; espace?: string | null; chemin?: string; detail?: string; resultats?: number }

/**
 * Journal d'activité des clients (pas des admins) : connexions, pages consultées, recherches.
 * Sert à l'admin pour aider un client (« a-t-il cherché avant d'appeler ? ») et, plus tard, aux statistiques.
 * Un enregistrement raté ne bloque jamais l'utilisateur.
 */
@Injectable()
export class ActiviteService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('Activite');
  private minuteur?: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.nettoyer();
    this.minuteur = setInterval(() => this.nettoyer(), 24 * 3600 * 1000);
    this.minuteur.unref();
  }

  onModuleDestroy() {
    clearInterval(this.minuteur);
  }

  async nettoyer() {
    const avant = new Date(Date.now() - CONSERVATION_JOURS * 24 * 3600 * 1000);
    await this.prisma.activite.deleteMany({ where: { createdAt: { lt: avant } } }).catch((e) => this.log.warn(`Nettoyage : ${e}`));
  }

  noter(userId: string, a: NouvelleActivite) {
    this.prisma.activite
      .create({ data: { userId, type: a.type, espace: a.espace ?? null, chemin: a.chemin ?? null, detail: a.detail ?? null, resultats: a.resultats ?? null } })
      .catch((e) => this.log.warn(`Activité non enregistrée : ${e}`));
  }

  async lister(userId: string, jours: number) {
    const depuis = new Date(Date.now() - jours * 24 * 3600 * 1000);
    return this.prisma.activite.findMany({
      where: { userId, createdAt: { gte: depuis } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: { id: true, type: true, espace: true, chemin: true, detail: true, resultats: true, createdAt: true },
    });
  }
}
