import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { calculerChemin, sansPartie } from './chemin';

const FINS = ['termine', 'resolu', 'contact'];

/**
 * Suivi des procédures :
 * - « Pas clair ? » : un client signale une étape (admins prévenus, webhook `etape.signalee`) ; l'admin la marque traitée ;
 * - statistiques anonymes : chaque tentative (identifiant tiré au hasard par le téléphone) garde ses réponses,
 *   l'étape atteinte et la fin ; l'admin voit les réponses les plus choisies, les fins et où l'on s'arrête.
 */
@Injectable()
export class SuiviService {
  constructor(private prisma: PrismaService, private push: PushService, private webhooks: WebhooksService) {}

  /** Un client signale une étape pas claire. Un seul signalement ouvert par client et par étape (le message est mis à jour). */
  async signaler(etapeId: string, user: { id: string; admin: boolean }, message?: string) {
    const e = await this.prisma.etapeProcedure.findUnique({ where: { id: etapeId }, include: { procedure: { select: { id: true, titre: true, publiee: true } } } });
    if (!e || (!e.procedure.publiee && !user.admin)) throw new NotFoundException('Étape introuvable');
    const msg = message?.trim() || null;
    const ouvert = await this.prisma.signalementEtape.findFirst({ where: { etapeId, userId: user.id, traite: false } });
    if (ouvert) {
      if (msg) await this.prisma.signalementEtape.update({ where: { id: ouvert.id }, data: { message: msg } });
      return { ok: true };
    }
    const s = await this.prisma.signalementEtape.create({
      data: { etapeId, userId: user.id, message: msg },
      include: { user: { select: { id: true, identifiant: true, nom: true } } },
    });
    const qui = s.user.nom ? `${s.user.nom} (${s.user.identifiant})` : s.user.identifiant;
    const texte = sansPartie(e.texte);
    void this.push.notifierAdmins({
      titre: `❓ Étape pas claire : ${e.procedure.titre}`,
      texte: `${qui} · « ${texte.slice(0, 80)} »${msg ? ` : ${msg}` : ''}`,
      url: `/admin/procedures/${e.procedure.id}`,
    });
    this.webhooks.emettre('etape.signalee', {
      signalement: { id: s.id, message: msg, creeLe: s.createdAt },
      etape: { id: e.id, texte, procedure: { id: e.procedure.id, titre: e.procedure.titre } },
      user: s.user,
    });
    return { ok: true };
  }

  /** Signalements d'une procédure (ouverts d'abord). */
  async signalements(procedureId: string) {
    return this.prisma.signalementEtape.findMany({
      where: { etape: { procedureId } },
      orderBy: [{ traite: 'asc' }, { createdAt: 'desc' }],
      take: 300,
      select: { id: true, etapeId: true, message: true, traite: true, createdAt: true, user: { select: { id: true, identifiant: true, nom: true } } },
    });
  }

  async traiter(id: string, traite: boolean) {
    await this.prisma.signalementEtape.update({ where: { id }, data: { traite } }).catch(() => {
      throw new NotFoundException();
    });
    return { ok: true };
  }

  /** Signalements ouverts, par procédure (pour la liste de l'admin). */
  async ouvertsParProcedure(): Promise<Record<string, number>> {
    const l = await this.prisma.signalementEtape.findMany({ where: { traite: false }, select: { etape: { select: { procedureId: true } } } });
    const r: Record<string, number> = {};
    for (const s of l) r[s.etape.procedureId] = (r[s.etape.procedureId] ?? 0) + 1;
    return r;
  }

  /** Avancement d'une tentative (anonyme). Les admins ne sont pas comptés. */
  async suivre(procedureId: string, admin: boolean, d: { session: string; reponses: Record<string, string>; faites: number; total: number; derniere?: string | null; fin?: string | null }) {
    if (admin) return { ok: true };
    if (d.fin && !FINS.includes(d.fin)) throw new BadRequestException('Fin inconnue');
    const p = await this.prisma.procedure.findUnique({ where: { id: procedureId }, select: { publiee: true } });
    if (!p?.publiee) throw new NotFoundException('Procédure introuvable');
    const donnees = {
      reponses: d.reponses as Prisma.InputJsonValue, faites: Math.max(0, d.faites), total: Math.max(0, d.total),
      derniere: d.derniere ?? null, fin: d.fin ?? null,
    };
    const existant = await this.prisma.suiviParcours.findUnique({ where: { session: d.session }, select: { procedureId: true } });
    if (existant && existant.procedureId !== procedureId) throw new BadRequestException('Session d\'une autre procédure');
    await this.prisma.suiviParcours.upsert({ where: { session: d.session }, update: donnees, create: { session: d.session, procedureId, ...donnees } });
    return { ok: true };
  }

  /**
   * Statistiques d'une procédure : tentatives, fins, réponses choisies (sur le chemin réellement suivi),
   * étapes où l'on s'est arrêté (tentatives non finies), résultats envoyés.
   */
  async stats(procedureId: string) {
    const p = await this.prisma.procedure.findUnique({
      where: { id: procedureId },
      include: { etapes: { orderBy: { ordre: 'asc' }, include: { choix: { orderBy: { ordre: 'asc' } } } } },
    });
    if (!p) throw new NotFoundException('Procédure introuvable');
    const suivis = await this.prisma.suiviParcours.findMany({ where: { procedureId } });
    const choix: Record<string, number> = {};
    const arrets: Record<string, number> = {};
    const fins: Record<string, number> = { termine: 0, resolu: 0, contact: 0 };
    for (const s of suivis) {
      const reponses = (s.reponses ?? {}) as Record<string, string>;
      for (const pas of calculerChemin(p.etapes, reponses).pas) {
        const c = reponses[pas.e.id];
        if (c && pas.e.choix.some((x) => x.id === c)) choix[c] = (choix[c] ?? 0) + 1;
      }
      if (s.fin) fins[s.fin] = (fins[s.fin] ?? 0) + 1;
      else if (s.derniere) arrets[s.derniere] = (arrets[s.derniere] ?? 0) + 1;
    }
    return {
      tentatives: suivis.length,
      terminees: suivis.filter((s) => s.fin).length,
      fins,
      choix,
      arrets,
      envoyes: await this.prisma.diagnosticEnvoye.count({ where: { procedureId } }),
      depuis: suivis.reduce<Date | null>((m, s) => (!m || s.createdAt < m ? s.createdAt : m), null),
    };
  }

  /** Pas-à-pas terminé depuis un rappel : le message doit renvoyer vers ce pas-à-pas ; une fois par jour au plus. */
  async termineDepuisRappel(procedureId: string, userId: string, annonceId: string) {
    const a = await this.prisma.annonce.findUnique({ where: { id: annonceId }, select: { procedureId: true } });
    if (!a || a.procedureId !== procedureId) throw new BadRequestException('Ce message ne renvoie pas vers ce pas-à-pas');
    const recent = await this.prisma.parcoursTermine.findFirst({
      where: { userId, procedureId, annonceId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    });
    if (!recent) await this.prisma.parcoursTermine.create({ data: { userId, procedureId, annonceId } });
    return { ok: true };
  }
}
