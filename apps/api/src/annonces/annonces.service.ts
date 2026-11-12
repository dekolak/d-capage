import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Annonce, CibleClient, Prisma, Recurrence, Role, TypeQuestion } from '@prisma/client';
import { espacesDesModules, modulesDeLEspace } from '../espaces/espaces';
import { PrismaService } from '../prisma/prisma.service';

const JOUR = 86_400_000;
const POIDS = { IMPORTANT: 0, INFO: 1, CONSEIL: 2 } as const;

export interface Ciblage {
  /** Espaces visés (vide = tous) : comptes ayant au moins un module de ces espaces. */
  espaces?: string[];
  cibleClient?: CibleClient;
  fabricantIds?: string[];
  modeleIds?: string[];
  varianteIds?: string[];
  numerosOdoo?: string[];
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

/** Date de début d'une période donnée. */
export function debutPeriode(a: Pick<Annonce, 'recurrence' | 'intervalle' | 'debut'>, k: number): Date {
  if (a.recurrence === Recurrence.AUCUNE) return a.debut;
  const n = Math.max(1, a.intervalle);
  if (a.recurrence === Recurrence.MOIS) {
    const d = new Date(a.debut);
    d.setMonth(d.getMonth() + k * n);
    return d;
  }
  return new Date(a.debut.getTime() + k * (a.recurrence === Recurrence.SEMAINES ? 7 : 1) * n * JOUR);
}

function verifierQuestion(d: Prisma.AnnonceUncheckedCreateInput) {
  const t = d.questionType ?? TypeQuestion.AUCUNE;
  if (t === TypeQuestion.AUCUNE) return;
  if (!d.question || !String(d.question).trim()) throw new BadRequestException('Écrivez la question');
  const opts = (Array.isArray(d.options) ? d.options : (d.options as { set?: string[] } | undefined)?.set) ?? [];
  if (t === TypeQuestion.CHOIX && (opts.length < 2 || opts.length > 5 || opts.some((o) => !o.trim())))
    throw new BadRequestException('Entre 2 et 5 réponses possibles');
}

/** La date ne se demande qu'après une question Oui / Non. */
function nettoyerDate<T extends Prisma.AnnonceUncheckedCreateInput>(d: T): T {
  if ((d.questionType ?? TypeQuestion.AUCUNE) !== TypeQuestion.OUI_NON) return { ...d, ...(d.dateSi !== undefined || d.questionType ? { dateSi: null, dateQuestion: null } : {}) };
  return { ...d, ...(d.dateQuestion !== undefined ? { dateQuestion: d.dateQuestion?.trim() || null } : {}) };
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
  const modules = (c.espaces ?? []).flatMap(modulesDeLEspace);
  return {
    role: Role.USER,
    actif: true,
    ...(c.espaces?.length ? { modules: { some: { module: { in: modules } } } } : {}),
    ...(c.cibleClient === CibleClient.LAZZEKO ? { clientLazzeko: true } : c.cibleClient === CibleClient.AUTRES ? { clientLazzeko: false } : {}),
    ...(machines.length ? { machines: { some: { OR: machines } } } : {}),
    ...(c.numerosOdoo?.length ? { numeroOdoo: { in: c.numerosOdoo } } : {}),
  };
}

@Injectable()
export class AnnoncesService {
  constructor(private prisma: PrismaService) {}

  /** Messages à afficher maintenant pour cet utilisateur (et note qu'il les a vus). */
  async pourMoi(userId: string, espace: string) {
    const now = new Date();
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, clientLazzeko: true, modules: { select: { module: true } }, numeroOdoo: true, machines: { select: { varianteId: true, variante: { select: { modeleId: true, modele: { select: { fabricantId: true } } } } } } },
    });
    if (!u || u.role !== Role.USER) return [];
    // Les messages s'affichent dans l'espace ouvert, si le compte y a accès.
    if (!espacesDesModules(u.modules.map((m) => m.module)).some((e) => e.slug === espace)) return [];
    const actives = await this.prisma.annonce.findMany({
      where: { actif: true, debut: { lte: now }, OR: [{ fin: null }, { fin: { gt: now } }] },
      include: { procedure: { select: { id: true, titre: true, publiee: true } } },
    });
    const vise = (a: Annonce) => {
      if (a.espaces.length && !a.espaces.includes(espace)) return false;
      if (a.cibleClient === CibleClient.LAZZEKO && !u.clientLazzeko) return false;
      if (a.cibleClient === CibleClient.AUTRES && u.clientLazzeko) return false;
      if (a.numerosOdoo.length && !(u.numeroOdoo && a.numerosOdoo.includes(u.numeroOdoo))) return false;
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
      .map(({ a }) => ({
        id: a.id, titre: a.titre, texte: a.texte, niveau: a.niveau, lienUrl: a.lienUrl, lienTexte: a.lienTexte,
        ...(a.procedure?.publiee ? { procedure: { id: a.procedure.id, titre: a.procedure.titre } } : {}),
        ...(a.questionType !== TypeQuestion.AUCUNE
          ? {
              question: {
                type: a.questionType, texte: a.question, options: a.options, autre: a.autreOption, obligatoire: a.reponseObligatoire,
                ...(a.dateSi ? { dateSi: a.dateSi, dateQuestion: a.dateQuestion } : {}),
              },
            }
          : {}),
      }));
  }

  async compris(id: string, userId: string) {
    const a = await this.prisma.annonce.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    if (a.questionType !== TypeQuestion.AUCUNE && a.reponseObligatoire) throw new BadRequestException('Une réponse est attendue');
    const occ = occurrence(a);
    await this.prisma.annonceLecture.upsert({
      where: { annonceId_userId_occurrence: { annonceId: id, userId, occurrence: occ } },
      update: { compriseLe: new Date() },
      create: { annonceId: id, userId, occurrence: occ, compriseLe: new Date() },
    });
    return { ok: true };
  }

  /** Réponse à la question : une par personne et par période (modifiable tant que la période dure). */
  async repondre(id: string, userId: string, valeur: string, autre?: string, dateFaite?: string) {
    const a = await this.prisma.annonce.findUnique({ where: { id } });
    if (!a || a.questionType === TypeQuestion.AUCUNE) throw new NotFoundException('Pas de question pour ce message');
    const v = valeur.trim();
    const ok =
      a.questionType === TypeQuestion.OUI_NON ? ['oui', 'non'].includes(v)
      : a.questionType === TypeQuestion.NOTE ? /^[1-5]$/.test(v)
      : a.questionType === TypeQuestion.CHOIX ? a.options.includes(v) || (a.autreOption && v === 'Autre')
      : v.length >= 1 && v.length <= 1000;
    if (!ok) throw new BadRequestException('Réponse invalide');
    const occ = occurrence(a);
    const precision = a.questionType === TypeQuestion.CHOIX && v === 'Autre' ? autre?.trim().slice(0, 300) || null : null;
    // date indiquée : seulement si le message la demande pour cette réponse ; pas dans le futur
    let date: Date | null = null;
    if (dateFaite && a.questionType === TypeQuestion.OUI_NON && (a.dateSi === 'toujours' || a.dateSi === v)) {
      const d = new Date(`${dateFaite}T12:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + JOUR || d.getUTCFullYear() < 2000) throw new BadRequestException('Date invalide');
      date = d;
    }
    await this.prisma.$transaction([
      this.prisma.annonceReponse.upsert({
        where: { annonceId_userId_occurrence: { annonceId: id, userId, occurrence: occ } },
        update: { valeur: v, autre: precision, dateFaite: date },
        create: { annonceId: id, userId, occurrence: occ, valeur: v, autre: precision, dateFaite: date },
      }),
      this.prisma.annonceLecture.upsert({
        where: { annonceId_userId_occurrence: { annonceId: id, userId, occurrence: occ } },
        update: { compriseLe: new Date() },
        create: { annonceId: id, userId, occurrence: occ, compriseLe: new Date() },
      }),
    ]);
    return { ok: true };
  }

  /** Résultats d'une question : par période (la période en cours par défaut). */
  async resultats(id: string, occ?: number) {
    const a = await this.trouver(id);
    const enCours = occurrence(a);
    const o = occ ?? enCours;
    const parPeriode = await this.prisma.annonceReponse.groupBy({ by: ['occurrence'], where: { annonceId: id }, _count: true, orderBy: { occurrence: 'desc' } });
    const reponses = await this.prisma.annonceReponse.findMany({
      where: { annonceId: id, occurrence: o },
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { identifiant: true, nom: true, clientLazzeko: true } } },
    });
    const choix =
      a.questionType === TypeQuestion.OUI_NON ? ['oui', 'non']
      : a.questionType === TypeQuestion.NOTE ? ['5', '4', '3', '2', '1']
      : a.questionType === TypeQuestion.CHOIX ? [...a.options, ...(a.autreOption ? ['Autre'] : [])]
      : [];
    const compte = (v: string) => reponses.filter((r) => r.valeur === v).length;
    const notes = a.questionType === TypeQuestion.NOTE ? reponses.map((r) => Number(r.valeur)) : [];
    return {
      type: a.questionType, question: a.question, occurrence: o, occurrenceEnCours: enCours,
      periodes: parPeriode.map((p) => ({ occurrence: p.occurrence, nombre: p._count, debut: debutPeriode(a, p.occurrence) })),
      total: reponses.length,
      resume: choix.map((v) => ({ valeur: v, nombre: compte(v) })),
      moyenne: notes.length ? +(notes.reduce((x, y) => x + y, 0) / notes.length).toFixed(2) : null,
      reponses: await Promise.all(
        reponses.map(async (r) => ({
          valeur: r.valeur, autre: r.autre, date: r.updatedAt, dateFaite: r.dateFaite, user: r.user,
          // pas-à-pas terminé depuis ce rappel, pendant cette période
          termine: a.procedureId
            ? (await this.prisma.parcoursTermine.findFirst({
                where: { annonceId: id, userId: r.userId, createdAt: { gte: debutPeriode(a, o) } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true },
              }))?.createdAt ?? null
            : null,
        })),
      ),
    };
  }

  /** Export CSV (séparateur « ; » pour Excel en français). */
  async csv(id: string) {
    const a = await this.trouver(id);
    const rs = await this.prisma.annonceReponse.findMany({
      where: { annonceId: id },
      orderBy: [{ occurrence: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: { identifiant: true, nom: true, clientLazzeko: true } } },
    });
    const c = (x: unknown) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const lignes = [
      ['Période', 'Début de période', 'Identifiant', 'Nom', 'Client Lazzeko', 'Réponse', 'Précision', 'Date indiquée', 'Date'].map(c).join(';'),
      ...rs.map((r) =>
        [r.occurrence + 1, debutPeriode(a, r.occurrence).toISOString().slice(0, 10), r.user.identifiant, r.user.nom, r.user.clientLazzeko ? 'oui' : 'non', r.valeur, r.autre, r.dateFaite?.toISOString().slice(0, 10), r.updatedAt.toISOString()]
          .map(c).join(';'),
      ),
    ];
    return '\uFEFF' + lignes.join('\r\n'); // BOM : accents corrects dans Excel
  }

  /** Historique d'entretien d'un client : réponses aux rappels (messages liés à un pas-à-pas ou demandant une date), pas-à-pas terminés. */
  async entretien(userId: string) {
    const [reponses, termines] = await Promise.all([
      this.prisma.annonceReponse.findMany({
        where: { userId, annonce: { OR: [{ procedureId: { not: null } }, { dateSi: { not: null } }] } },
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: { annonce: { select: { id: true, titre: true, question: true, procedure: { select: { id: true, titre: true } } } } },
      }),
      this.prisma.parcoursTermine.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' }, take: 200, include: { procedure: { select: { id: true, titre: true } } },
      }),
    ]);
    return {
      reponses: reponses.map((r) => ({
        message: r.annonce.titre, question: r.annonce.question, pasAPas: r.annonce.procedure, valeur: r.valeur, dateFaite: r.dateFaite, le: r.updatedAt,
      })),
      termines: termines.map((t) => ({ pasAPas: t.procedure, le: t.createdAt, depuisRappel: !!t.annonceId })),
    };
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
        const [cible, vues, comprises, reponses] = await Promise.all([
          this.compterCible(a),
          this.prisma.annonceLecture.count({ where: { annonceId: a.id, occurrence: occ } }),
          this.prisma.annonceLecture.count({ where: { annonceId: a.id, occurrence: occ, compriseLe: { not: null } } }),
          this.prisma.annonceReponse.count({ where: { annonceId: a.id, occurrence: occ } }),
        ]);
        const etat = !a.actif ? 'PAUSE' : a.debut > now ? 'PROGRAMME' : a.fin && a.fin <= now ? 'TERMINE' : 'EN_COURS';
        return { ...a, etat, cible, stats: { occurrence: occ, vues, comprises, reponses }, prochaine: prochaine(a, now) };
      }),
    );
  }

  async creer(d: Prisma.AnnonceUncheckedCreateInput) {
    verifierQuestion(d);
    await this.verifierProcedure(d.procedureId);
    return this.prisma.annonce.create({ data: nettoyerDate(d) });
  }

  private async verifierProcedure(id: string | null | undefined) {
    if (id && !(await this.prisma.procedure.findUnique({ where: { id }, select: { id: true } }))) throw new BadRequestException('Pas-à-pas introuvable');
  }

  async modifier(id: string, d: Prisma.AnnonceUncheckedUpdateInput) {
    const a = await this.trouver(id);
    verifierQuestion({ questionType: a.questionType, question: a.question, options: a.options, ...d } as Prisma.AnnonceUncheckedCreateInput);
    await this.verifierProcedure(d.procedureId as string | null | undefined);
    return this.prisma.annonce.update({ where: { id }, data: nettoyerDate({ questionType: a.questionType, ...d } as Prisma.AnnonceUncheckedCreateInput) });
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
