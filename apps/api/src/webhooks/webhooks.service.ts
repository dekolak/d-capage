import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export const EVENEMENTS = ['fiche.creee', 'fiche.modifiee', 'avis.publie', 'avis.modifie', 'aide.demandee', 'motdepasse.demande'] as const;
export type Evenement = (typeof EVENEMENTS)[number];

const MAX_TENTATIVES = 6;
const DELAI_MS = [0, 30_000, 120_000, 600_000, 1_800_000, 7_200_000]; // 0, 30 s, 2 min, 10 min, 30 min, 2 h
const TIMEOUT_MS = 10_000;

/**
 * Envoi des publications (fiches, avis) vers des services externes, par exemple une IA de modération.
 * - émettre() crée une livraison en base pour chaque abonné : rien n'est perdu au redémarrage ;
 * - un envoi en arrière-plan poste le JSON, signé : X-Decapage-Signature = sha256=HMAC(secret, corps) ;
 * - en cas d'échec : nouvelles tentatives espacées, puis statut ECHEC.
 * Le service externe peut répondre en masquant le contenu via PATCH /api/admin/avis/:id (clé API).
 */
@Injectable()
export class WebhooksService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('Webhooks');
  private minuteur?: NodeJS.Timeout;
  private enCours = false;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.WEBHOOKS_DESACTIVES === 'true') return;
    this.minuteur = setInterval(() => this.traiter().catch((e) => this.log.error(e)), 5_000);
  }

  onModuleDestroy() {
    if (this.minuteur) clearInterval(this.minuteur);
  }

  /** Ne bloque jamais l'action de l'utilisateur : une erreur ici est seulement journalisée. */
  async emettre(evenement: Evenement, donnees: Record<string, unknown>) {
    try {
      const abonnes = await this.prisma.webhook.findMany({ where: { actif: true } });
      const cibles = abonnes.filter((w) => !w.evenements.length || w.evenements.includes(evenement));
      if (!cibles.length) return;
      const charge = { evenement, date: new Date().toISOString(), ...donnees } as Prisma.InputJsonValue;
      await this.prisma.webhookLivraison.createMany({ data: cibles.map((w) => ({ webhookId: w.id, evenement, charge })) });
      setImmediate(() => this.traiter().catch((e) => this.log.error(e)));
    } catch (e) {
      this.log.error(`Émission ${evenement} impossible : ${(e as Error).message}`);
    }
  }

  async traiter() {
    if (this.enCours) return;
    this.enCours = true;
    try {
      const lot = await this.prisma.webhookLivraison.findMany({
        where: { statut: 'EN_ATTENTE', prochainEssai: { lte: new Date() } },
        include: { webhook: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      for (const l of lot) await this.envoyer(l);
    } finally {
      this.enCours = false;
    }
  }

  private async envoyer(l: Prisma.WebhookLivraisonGetPayload<{ include: { webhook: true } }>) {
    const corps = JSON.stringify({ livraison: l.id, ...(l.charge as object) });
    const signature = 'sha256=' + createHmac('sha256', l.webhook.secret).update(corps).digest('hex');
    const tentatives = l.tentatives + 1;
    let code: number | null = null;
    let erreur: string | null = null;
    try {
      const r = await fetch(l.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'decapage-webhooks/1',
          'X-Decapage-Evenement': l.evenement,
          'X-Decapage-Livraison': l.id,
          'X-Decapage-Signature': signature,
        },
        body: corps,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      code = r.status;
      if (!r.ok) erreur = `HTTP ${r.status}`;
    } catch (e) {
      erreur = (e as Error).message;
    }
    const ok = !erreur;
    await this.prisma.webhookLivraison.update({
      where: { id: l.id },
      data: {
        tentatives,
        dernierCode: code,
        derniereErreur: erreur,
        statut: ok ? 'ENVOYE' : tentatives >= MAX_TENTATIVES ? 'ECHEC' : 'EN_ATTENTE',
        envoyeLe: ok ? new Date() : null,
        prochainEssai: new Date(Date.now() + (DELAI_MS[tentatives] ?? DELAI_MS[DELAI_MS.length - 1])),
      },
    });
  }

  // ---------- administration ----------
  lister() {
    return this.prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, nom: true, url: true, evenements: true, actif: true, createdAt: true },
    });
  }

  async creer(d: { nom: string; url: string; evenements?: string[] }) {
    const secret = 'whsec_' + randomBytes(24).toString('base64url');
    const w = await this.prisma.webhook.create({ data: { nom: d.nom, url: d.url, evenements: d.evenements ?? [], secret } });
    return { id: w.id, nom: w.nom, url: w.url, evenements: w.evenements, secret, avertissement: 'Copiez le secret maintenant : il sert à vérifier la signature des envois.' };
  }

  async modifier(id: string, d: { nom?: string; url?: string; evenements?: string[]; actif?: boolean }) {
    await this.trouver(id);
    return this.prisma.webhook.update({ where: { id }, data: d, select: { id: true, nom: true, url: true, evenements: true, actif: true } });
  }

  async supprimer(id: string) {
    await this.trouver(id);
    await this.prisma.webhook.delete({ where: { id } });
    return { ok: true };
  }

  async tester(id: string) {
    const w = await this.trouver(id);
    await this.prisma.webhookLivraison.create({
      data: { webhookId: w.id, evenement: 'test', charge: { evenement: 'test', date: new Date().toISOString(), message: 'Envoi de test' } },
    });
    await this.traiter();
    return this.livraisons(id);
  }

  async livraisons(id: string) {
    await this.trouver(id);
    return this.prisma.webhookLivraison.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, evenement: true, statut: true, tentatives: true, dernierCode: true, derniereErreur: true, createdAt: true, envoyeLe: true },
    });
  }

  private async trouver(id: string) {
    const w = await this.prisma.webhook.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Webhook introuvable');
    return w;
  }
}
