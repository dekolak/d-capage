import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface Notification { titre: string; texte: string; url?: string }

/**
 * Notifications sur le téléphone des admins (Web Push), sans service extérieur.
 * Clés VAPID : variables VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, sinon générées une fois et gardées en base (Parametre « vapid »).
 * Une notification ratée ne bloque jamais rien ; un abonnement expiré est supprimé.
 */
@Injectable()
export class PushService {
  private log = new Logger('Push');
  private cles?: Promise<{ publicKey: string; privateKey: string }>;

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  private chargerCles() {
    if (!this.cles) {
      this.cles = (async () => {
        const pub = this.config.get<string>('VAPID_PUBLIC_KEY');
        const priv = this.config.get<string>('VAPID_PRIVATE_KEY');
        let c = pub && priv ? { publicKey: pub, privateKey: priv } : undefined;
        if (!c) {
          const p = await this.prisma.parametre.findUnique({ where: { cle: 'vapid' } });
          c = p?.valeur as { publicKey: string; privateKey: string } | undefined;
          if (!c?.publicKey) {
            c = webpush.generateVAPIDKeys();
            await this.prisma.parametre.create({ data: { cle: 'vapid', valeur: c } });
          }
        }
        const sujet = this.config.get<string>('VAPID_SUBJECT') || this.config.get<string>('PUBLIC_URL') || 'https://app.lazzeko.com';
        webpush.setVapidDetails(sujet, c.publicKey, c.privateKey);
        return c;
      })();
      this.cles.catch(() => (this.cles = undefined));
    }
    return this.cles;
  }

  async clePublique() {
    return (await this.chargerCles()).publicKey;
  }

  async abonner(userId: string, a: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    await this.prisma.abonnementPush.upsert({
      where: { endpoint: a.endpoint },
      create: { userId, endpoint: a.endpoint, p256dh: a.keys.p256dh, auth: a.keys.auth },
      update: { userId, p256dh: a.keys.p256dh, auth: a.keys.auth },
    });
  }

  async desabonner(endpoint: string) {
    await this.prisma.abonnementPush.deleteMany({ where: { endpoint } });
  }

  /** Envoie une notification à tous les téléphones abonnés des admins. Renvoie le nombre de téléphones atteints. */
  async notifierAdmins(n: Notification): Promise<number> {
    try {
      await this.chargerCles();
      const abos = await this.prisma.abonnementPush.findMany({ where: { user: { role: Role.ADMIN, actif: true } } });
      const charge = JSON.stringify(n);
      const res = await Promise.all(
        abos.map((a) =>
          webpush
            .sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, { TTL: 24 * 3600 })
            .then(() => true)
            .catch(async (e: { statusCode?: number }) => {
              if (e.statusCode === 404 || e.statusCode === 410) await this.prisma.abonnementPush.delete({ where: { id: a.id } }).catch(() => {});
              else this.log.warn(`Notification non envoyée (${e.statusCode ?? e})`);
              return false;
            }),
        ),
      );
      return res.filter(Boolean).length;
    } catch (e) {
      this.log.warn(`Notifications indisponibles : ${e}`);
      return 0;
    }
  }
}
