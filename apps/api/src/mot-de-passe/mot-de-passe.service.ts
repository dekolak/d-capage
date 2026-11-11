import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { ActiviteService } from '../activite/activite.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { WebhooksService } from '../webhooks/webhooks.service';

export const VALIDITE_CODE_MIN = 60;
const MAX_DEMANDES_HEURE = 3;
const MAX_ESSAIS = 5;
const ERREUR_CODE = 'Code incorrect ou expiré';

/**
 * Mot de passe oublié, sans serveur email dans l'app : le client demande (identifiant, ou email s'il l'a oublié aussi)
 * → notification aux admins + webhook `motdepasse.demande` (n8n) → un code est généré (6 chiffres, 1 h, usage unique, 5 essais)
 * par l'admin, ou par n8n avec une clé API qui l'envoie par email → le client choisit son mot de passe.
 * Le code n'est stocké que haché et n'est jamais envoyé dans un webhook.
 */
@Injectable()
export class MotDePasseService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private push: PushService,
    private webhooks: WebhooksService,
    private activite: ActiviteService,
  ) {}

  /** Demande d'un client. Même réponse dans tous les cas (ne révèle pas si l'identifiant existe). */
  async demander(saisie: string, message: string | undefined, espace: string) {
    if (saisie.includes('@')) return this.demanderParEmail(saisie.trim().toLowerCase(), message, espace);
    const user = await this.prisma.user.findUnique({ where: { identifiant: saisie.trim().toLowerCase() } });
    if (!user?.actif) return;
    const recentes = await this.prisma.demandeMotDePasse.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (recentes >= MAX_DEMANDES_HEURE) return;
    // une seule demande en attente par compte
    await this.prisma.demandeMotDePasse.updateMany({ where: { userId: user.id, statut: 'EN_ATTENTE' }, data: { statut: 'ANNULEE', traiteeLe: new Date() } });
    const d = await this.prisma.demandeMotDePasse.create({ data: { userId: user.id, message: message?.trim() || null, espace } });
    this.activite.noter(user.id, { type: 'motdepasse', espace, detail: 'Mot de passe oublié : demande envoyée' });
    const qui = user.nom ? `${user.nom} (${user.identifiant})` : user.identifiant;
    void this.push.notifierAdmins({ titre: '🔐 Mot de passe oublié', texte: `${qui}${d.message ? ` : « ${d.message} »` : ''}`, url: '/admin/mots-de-passe' });
    this.webhooks.emettre('motdepasse.demande', {
      demande: { id: d.id, message: d.message, espace, creeLe: d.createdAt },
      user: { id: user.id, identifiant: user.identifiant, nom: user.nom, numeroOdoo: user.numeroOdoo },
    });
  }

  /**
   * Demande faite avec un email : l'app ne connaît pas les emails des clients (ils sont dans Odoo).
   * La demande est gardée sans compte ; n8n retrouve le client dans Odoo, ou l'admin indique l'identifiant.
   */
  private async demanderParEmail(email: string, message: string | undefined, espace: string) {
    const recentes = await this.prisma.demandeMotDePasse.count({ where: { email, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (recentes >= MAX_DEMANDES_HEURE) return;
    await this.prisma.demandeMotDePasse.updateMany({ where: { email, statut: 'EN_ATTENTE' }, data: { statut: 'ANNULEE', traiteeLe: new Date() } });
    const d = await this.prisma.demandeMotDePasse.create({ data: { email, message: message?.trim() || null, espace } });
    void this.push.notifierAdmins({ titre: '🔐 Mot de passe oublié', texte: `Demande avec l'email ${email}${d.message ? ` : « ${d.message} »` : ''}`, url: '/admin/mots-de-passe' });
    this.webhooks.emettre('motdepasse.demande', { demande: { id: d.id, email, message: d.message, espace, creeLe: d.createdAt }, user: null });
  }

  /** Demandes à traiter (et les dernières traitées), pour l'admin. */
  async lister() {
    const choix = { id: true, email: true, message: true, statut: true, codeExpire: true, essais: true, espace: true, createdAt: true, traiteeLe: true, user: { select: { id: true, identifiant: true, nom: true, numeroOdoo: true } } };
    const [enCours, traitees] = await Promise.all([
      this.prisma.demandeMotDePasse.findMany({ where: { statut: { in: ['EN_ATTENTE', 'CODE_ENVOYE'] } }, orderBy: { createdAt: 'desc' }, select: choix }),
      this.prisma.demandeMotDePasse.findMany({ where: { statut: { in: ['UTILISEE', 'ANNULEE'] } }, orderBy: { createdAt: 'desc' }, take: 20, select: choix }),
    ]);
    const maintenant = Date.now();
    return {
      enAttente: enCours.filter((d) => d.statut === 'EN_ATTENTE' || (d.codeExpire && d.codeExpire.getTime() > maintenant)).length,
      demandes: [...enCours, ...traitees].map((d) => ({ ...d, expire: d.statut === 'CODE_ENVOYE' && !!d.codeExpire && d.codeExpire.getTime() <= maintenant })),
    };
  }

  /**
   * Génère le code (renvoyé une seule fois, à l'admin ou à n8n). Un nouveau code remplace le précédent.
   * Demande faite avec un email : indiquer l'identifiant du compte retrouvé (`identifiant`).
   * Renvoie aussi l'identifiant et le nom, à mettre dans l'email au client.
   */
  async genererCode(id: string, identifiant?: string) {
    const d = await this.prisma.demandeMotDePasse.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Demande introuvable');
    if (d.statut === 'UTILISEE' || d.statut === 'ANNULEE') throw new BadRequestException('Demande déjà traitée');
    let userId = d.userId;
    if (!userId) {
      if (!identifiant?.trim()) throw new BadRequestException('Indiquez l\'identifiant du compte de ce client');
      const u = await this.prisma.user.findUnique({ where: { identifiant: identifiant.trim().toLowerCase() } });
      if (!u?.actif) throw new NotFoundException('Compte introuvable ou désactivé');
      userId = u.id;
    }
    const user = (await this.prisma.user.findUnique({ where: { id: userId }, select: { identifiant: true, nom: true } }))!;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeExpire = new Date(Date.now() + VALIDITE_CODE_MIN * 60_000);
    await this.prisma.demandeMotDePasse.update({ where: { id }, data: { userId, statut: 'CODE_ENVOYE', codeHash: await AuthService.hasher(code), codeExpire, essais: 0 } });
    return { code, expire: codeExpire, identifiant: user.identifiant, nom: user.nom };
  }

  async annuler(id: string) {
    await this.prisma.demandeMotDePasse.updateMany({ where: { id, statut: { in: ['EN_ATTENTE', 'CODE_ENVOYE'] } }, data: { statut: 'ANNULEE', traiteeLe: new Date(), codeHash: null } });
    return this.lister();
  }

  /** Le client saisit le code et son nouveau mot de passe : il est connecté directement. */
  async reinitialiser(identifiant: string, code: string, nouveau: string, espace: string) {
    const user = await this.prisma.user.findUnique({ where: { identifiant: identifiant.trim().toLowerCase() } });
    const d = user?.actif
      ? await this.prisma.demandeMotDePasse.findFirst({ where: { userId: user.id, statut: 'CODE_ENVOYE' }, orderBy: { createdAt: 'desc' } })
      : null;
    if (!user || !d?.codeHash || !d.codeExpire || d.codeExpire.getTime() < Date.now() || d.essais >= MAX_ESSAIS) throw new BadRequestException(ERREUR_CODE);
    if (!(await AuthService.verifier(code.trim(), d.codeHash))) {
      await this.prisma.demandeMotDePasse.update({ where: { id: d.id }, data: { essais: { increment: 1 } } });
      throw new BadRequestException(ERREUR_CODE);
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await AuthService.hasher(nouveau) } }),
      this.prisma.demandeMotDePasse.update({ where: { id: d.id }, data: { statut: 'UTILISEE', traiteeLe: new Date(), codeHash: null } }),
    ]);
    this.activite.noter(user.id, { type: 'motdepasse', espace, detail: 'Mot de passe changé avec un code' });
    return this.auth.connexion(user.identifiant, nouveau, espace);
  }
}
