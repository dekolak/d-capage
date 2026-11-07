import { Injectable, NotFoundException } from '@nestjs/common';
import { Annonce, CibleClient, Prisma, Recurrence, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const JOUR = 86_400_000;
const POIDS = { IMPORTANT: 0, INFO: 1, CONSEIL: 2 } as const;

export interface Ciblage {
  cibleClient?: CibleClient;
  fabricantIds?: string[];
  modeleIds?: string[];
  varianteIds?: string[];
}

/** N° de période en cours : 0 pour un message ponctuel ; sinon nombre de périodes écoulées depuis le début. */
export function occurrence(a: Pick<Annonce, 'recurrence' | 'intervalle' | 'debut'>, maintenant = new Date()): number {
  if (a.recurrence === Recurrence.AUCUNE) return 0;
  const n = Math.max(1, a.intervalle);
  if (a.recurrence === Recurrence.MOIS) {
    let mois = (maintenant.getFullYear() - a.debut.getFullYear()) * 12 + maintenant.getMonth() - a.debut.getMonth();
    if (maintenant.getDate() < a.debut.getDate()) mois -= 1; // le jour anniversaire n'est pas encore arrivé
    return Math.floor(Math.max(0, mois) / n);
  }
  const duree = (a.recurrence === Recurrence.SEMAINES ? 7 : 1) * n * JOUR;
  return Math.floor(Math.max(0, maintenant.getTime() - a.debut.getTime()) / duree);
}

/** Date de la prochaine réapparition d'un message périodique. */
export function prochaine(a: Pick<Annonce, 'recurrence' | 'intervalle' | 'debut'>, maintenant = new Date()): Date | null {
  if (a.recurrence === Recurrence.AUCUNE) return null;
  const k = occurrence(a, maintenant) + 1;
  const n = Math.max(1, a.intervalle);
  if (a.recurrence === Recurrence.MOIS) {
    const d = new Date(a.debut);
    d.setMonth(d.getMonth() + k * n);
    return d;
  }
  return new Date(a.debut.getTime() + k * (a.recurrence === Recurrence.SEMAINES ? 7 : 1) * n * JOUR);
}

/** Filtre Prisma des utilisateurs visés par un ciblage (utilisateurs actifs, hors admins). */
export function utilisateursVises(c: Ciblage): Prisma.UserWhereInput {
  const machines: Prisma.UserMachineWhereInput[] = [
    ...(c.varianteIds?.length ? [{ varianteId: { in: c.varianteIds } }] : []),
    ...(c.modeleIds?.length ? [{ variante: { modeleId: { in: c.modeleIds } } }] : []),
    ...(c.fabricantIds?.length ? [{ variante: { modele: { fabricantId: { in: c.fabricantIds } } } }] : []),
  ];
  return {
    role: Role.USER,
    actif: true,
    ...(c.cibleClient === CibleClient.LAZZEKO ? { clientLazzeko: true } : c.cibleClient === CibleClient.AUTRES ? { clientLazzeko: false } : {}),
    ...(machines.length ? { machines: { some: { OR: machines } } } : {}),
  };
}

@Injectable()
export class AnnoncesService {
  constructor(private prisma: PrismaService) {}

  /** Messages à afficher maintenant pour cet utilisateur (et note qu'il les a vus). */
  async pourMoi(userId: string) {
    const now = new Date();
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, clientLazzeko: true, machines: { select: { varianteId: true, variante: { select: { modeleId: true, modele: { select: { fabricantId: true } } } } } } },
    });
    if (!u || u.role !== Role.USER) return [];
    const actives = await this.prisma.annonce.findMany({
      where: { actif: true, debut: { lte: now }, OR: [{ fin: null }, { fin: { gt: now } }] },
    });
    const vise = (a: Annonce) => {
      if (a.cibleClient === CibleClient.LAZZEKO && !u.clientLazzeko) return false;
      if (a.cibleClient === CibleClient.AUTRES && u.clientLazzeko) return false;
      if (!a.fabricantIds.length && !a.modeleIds.length && !a.varianteIds.length) return true;
      return u.machines.some(
        (m) => a.varianteIds.includes(m.varianteId) || a.modeleIds.includes(m.variante.modeleId) || a.fabricantIds.includes(m.variante.modele.fabricantId),
      );
    };
    const candidates = actives.filter(vise).map((a) => ({ a, occ: occurrence(a, now) }));
    if (!candidates.length) return [];
    const lectures = await this.prisma.annonceLecture.findMany({
      where: { userId, OR: candidates.map((c) => ({ annonceId: c.a.id, occurrence: c.occ })) },
    });
    const comprises = new Set(lectures.filter((l) => l.compriseLe).map((l) => `${l.annonceId}:${l.occurrence}`));
    const a_afficher = candidates.filter((c) => !comprises.has(`${c.a.id}:${c.occ}`));
    // statistiques « vu »
    await Promise.all(
      a_afficher.map((c) =>
        this.prisma.annonceLecture.upsert({
          where: { annonceId_userId_occurrence: { annonceId: c.a.id, userId, occurrence: c.occ } },
          update: {},
          create: { annonceId: c.a.id, userId, occurrence: c.occ },
        }),
      ),
    );
    return a_afficher
      .sort((x, y) => POIDS[x.a.niveau] - POIDS[y.a.niveau] || y.a.debut.getTime() - x.a.debut.getTime())
      .map(({ a }) => ({ id: a.id, titre: a.titre, texte: a.texte, niveau: a.niveau, lienUrl: a.lienUrl, lienTexte: a.lienTexte }));
  }

  async compris(id: string, userId: string) {
    const a = await this.prisma.annonce.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    const occ = occurrence(a);
    await this.prisma.annonceLecture.upsert({
      where: { annonceId_userId_occurrence: { annonceId: id, userId, occurrence: occ } },
      update: { compriseLe: new Date() },
      create: { annonceId: id, userId, occurrence: occ, compriseLe: new Date() },
    });
    return { ok: true };
  }

  // ---------- administration ----------
  compterCible(c: Ciblage) {
    return this.prisma.user.count({ where: utilisateursVises(c) });
  }

  async lister() {
    const now = new Date();
    const liste = await this.prisma.annonce.findMany({ orderBy: [{ actif: 'desc' }, { debut: 'desc' }] });
    return Promise.all(
      liste.map(async (a) => {
        const occ = occurrence(a, now);
        const [cible, vues, comprises] = await Promise.all([
          this.compterCible(a),
          this.prisma.annonceLecture.count({ where: { annonceId: a.id, occurrence: occ } }),
          this.prisma.annonceLecture.count({ where: { annonceId: a.id, occurrence: occ, compriseLe: { not: null } } }),
        ]);
        const etat = !a.actif ? 'PAUSE' : a.debut > now ? 'PROGRAMME' : a.fin && a.fin <= now ? 'TERMINE' : 'EN_COURS';
        return { ...a, etat, cible, stats: { occurrence: occ, vues, comprises }, prochaine: prochaine(a, now) };
      }),
    );
  }

  creer(d: Prisma.AnnonceCreateInput) {
    return this.prisma.annonce.create({ data: d });
  }

  async modifier(id: string, d: Prisma.AnnonceUpdateInput) {
    await this.trouver(id);
    return this.prisma.annonce.update({ where: { id }, data: d });
  }

  async supprimer(id: string) {
    await this.trouver(id);
    await this.prisma.annonce.delete({ where: { id } });
    return { ok: true };
  }

  private async trouver(id: string) {
    const a = await this.prisma.annonce.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Message introuvable');
    return a;
  }
}
