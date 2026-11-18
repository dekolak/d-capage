import { Injectable, NotFoundException } from '@nestjs/common';
import { nomMachine } from '../catalogue/catalogue.service';
import { espace as espaceDef } from '../espaces/espaces';
import { MachinesService } from '../machines/machines.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';

/**
 * Envoyer un pas-à-pas à un client par le n° court de sa machine (621, L621…) : bulle à l'ouverture de son app,
 * liste « Reçus » dans Ma machine. L'envoi lui ouvre ce pas-à-pas même non publié ou étiqueté pour une autre machine.
 */
@Injectable()
export class EnvoisService {
  constructor(private prisma: PrismaService, private machines: MachinesService, private webhooks: WebhooksService) {}

  async envoyer(procedureId: string, numero: string, auteurId: string, message?: string) {
    const p = await this.prisma.procedure.findUnique({ where: { id: procedureId }, select: { id: true, titre: true, espace: true } });
    if (!p) throw new NotFoundException('Pas-à-pas introuvable');
    const m = await this.machines.parNumero(numero);
    const a = await this.prisma.user.findUnique({ where: { id: auteurId }, select: { nom: true, identifiant: true } });
    const auteur = a?.nom?.split(' ')[0] || a?.identifiant || 'Admin';
    const e = await this.prisma.envoiPasAPas.create({
      data: { procedureId: p.id, userMachineId: m.id, userId: m.client.id, auteur, message: message?.trim() || null },
    });
    const domaine = espaceDef(p.espace)?.domaines[0];
    this.webhooks.emettre('pasapas.envoye', {
      envoi: { id: e.id, message: e.message, auteur, creeLe: e.createdAt },
      pasAPas: { id: p.id, titre: p.titre, espace: p.espace, lien: domaine ? `https://${domaine}/procedures/${p.id}` : `/procedures/${p.id}` },
      machine: { id: m.id, numero: m.numero, nom: m.nom, numeroSerie: m.numeroSerie }, client: m.client,
    });
    return { id: e.id, client: m.client, machine: { numero: m.numero, nom: m.nom, surnom: m.surnom, numeroSerie: m.numeroSerie } };
  }

  /** Envois d'un pas-à-pas (admin) : à qui, quand, ouvert, terminé. */
  async duPasAPas(procedureId: string) {
    const l = await this.prisma.envoiPasAPas.findMany({
      where: { procedureId }, orderBy: { createdAt: 'desc' }, take: 100,
      include: { user: { select: { nom: true, identifiant: true } }, machine: { select: { numero: true, surnom: true, variante: { include: { modele: { include: { fabricant: true } } } } } } },
    });
    return l.map((e) => ({
      id: e.id, message: e.message, auteur: e.auteur, creeLe: e.createdAt, vuLe: e.vuLe, ouvertLe: e.ouvertLe, termineLe: e.termineLe,
      client: e.user.nom || e.user.identifiant, machine: { numero: e.machine.numero, nom: e.machine.surnom || nomMachine(e.machine.variante) },
    }));
  }

  /** Reçus du client : les plus récents d'abord (espace ouvert). */
  async miens(userId: string, espace: string) {
    const l = await this.prisma.envoiPasAPas.findMany({
      where: { userId, procedure: { espace } }, orderBy: { createdAt: 'desc' }, take: 50,
      include: { procedure: { select: { id: true, titre: true, type: true } } },
    });
    return l.map((e) => ({
      id: e.id, machineId: e.userMachineId, auteur: e.auteur, message: e.message, creeLe: e.createdAt, vu: !!e.vuLe, ouvert: !!e.ouvertLe, termine: !!e.termineLe,
      pasAPas: e.procedure,
    }));
  }

  async marquer(id: string, userId: string, quoi: 'vu' | 'termine') {
    const e = await this.prisma.envoiPasAPas.findFirst({ where: { id, userId } });
    if (!e) throw new NotFoundException();
    const maintenant = new Date();
    await this.prisma.envoiPasAPas.update({
      where: { id },
      data: quoi === 'vu' ? { vuLe: e.vuLe ?? maintenant } : { termineLe: e.termineLe ?? maintenant, vuLe: e.vuLe ?? maintenant, ouvertLe: e.ouvertLe ?? maintenant },
    });
    return { ok: true };
  }

  /** Le client a-t-il reçu ce pas-à-pas ? (accès même non publié) — et on note qu'il l'a ouvert. */
  async aRecu(procedureId: string, userId: string) {
    const l = await this.prisma.envoiPasAPas.findMany({ where: { procedureId, userId }, select: { id: true, ouvertLe: true } });
    const aOuvrir = l.filter((e) => !e.ouvertLe).map((e) => e.id);
    if (aOuvrir.length) await this.prisma.envoiPasAPas.updateMany({ where: { id: { in: aOuvrir } }, data: { ouvertLe: new Date(), vuLe: new Date() } });
    return l.length > 0;
  }
}
