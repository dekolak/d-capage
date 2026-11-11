import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActiviteService } from '../activite/activite.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { calculerChemin, sansPartie } from './chemin';

const ESPACE = 'kiavik';
const clePrompt = (espace: string) => `ia.prompt:${espace}`;

const arbre = {
  etapes: {
    orderBy: { ordre: 'asc' },
    include: {
      choix: { orderBy: { ordre: 'asc' }, include: { solution: { select: { id: true, titre: true } }, procedureCible: { select: { id: true, titre: true } } } },
    },
  },
} satisfies Prisma.ProcedureInclude;
type Arbre = Prisma.ProcedureGetPayload<{ include: typeof arbre }>;
type EtapeArbre = Arbre['etapes'][number];
type ChoixArbre = EtapeArbre['choix'][number];

export const LIBELLES_FIN = { termine: 'Parcours terminé', resolu: 'Problème résolu', contact: 'À contacter (problème non résolu)', en_cours: 'Diagnostic non terminé' } as const;

/**
 * Diagnostics (procédures à questions) et préparation pour l'IA :
 * - le client envoie ses réponses : on recalcule le chemin, on garde le résumé « question : réponse »,
 *   on prévient les admins (notification) et n8n (webhook `diagnostic.envoye`, avec le paquet prêt pour l'IA) ;
 * - catalogue des procédures (descriptions) et export de l'arbre d'une procédure, lisibles par n8n avec une clé API ;
 * - prompt général de l'espace (paramètre `ia.prompt:kiavik`), complété par le prompt de chaque procédure.
 */
@Injectable()
export class DiagnosticsService {
  constructor(private prisma: PrismaService, private push: PushService, private webhooks: WebhooksService, private activite: ActiviteService) {}

  async promptGeneral(): Promise<string> {
    const l = await this.prisma.parametre.findUnique({ where: { cle: clePrompt(ESPACE) } });
    return ((l?.valeur ?? {}) as { texte?: string }).texte ?? '';
  }

  async definirPromptGeneral(texte: string) {
    const valeur = { texte: texte.trim() };
    await this.prisma.parametre.upsert({ where: { cle: clePrompt(ESPACE) }, update: { valeur }, create: { cle: clePrompt(ESPACE), valeur } });
    return valeur;
  }

  private async charger(id: string): Promise<Arbre> {
    const p = await this.prisma.procedure.findUnique({ where: { id }, include: arbre });
    if (!p) throw new NotFoundException('Procédure introuvable');
    return p;
  }

  /** Chemin suivi avec ces réponses, en clair. */
  private resultat(p: Arbre, reponses: Record<string, string>) {
    const ch = calculerChemin<ChoixArbre, EtapeArbre>(p.etapes, reponses);
    const chemin = ch.pas
      .filter((x) => x.e.choix.length)
      .flatMap((x) => {
        const c = x.e.choix.find((y) => y.id === reponses[x.e.id]);
        return c ? [{ question: sansPartie(x.e.texte), reponse: c.libelle, ...(c.signification ? { signification: c.signification } : {}) }] : [];
      });
    const type = ch.fin?.type ?? 'en_cours';
    const choixFin = ch.fin && ch.fin.type !== 'termine' ? ch.fin.choix : null;
    const fin = {
      type,
      texte: LIBELLES_FIN[type],
      ...(choixFin?.conclusion ? { conclusion: choixFin.conclusion } : {}),
      ...(choixFin?.solution ? { astuce: choixFin.solution.titre } : {}),
      ...(choixFin?.procedureCible ? { procedure: choixFin.procedureCible.titre } : {}),
    };
    const texte = [
      ...chemin.map((l) => `${l.question} : ${l.reponse}`),
      `→ ${fin.texte}${'conclusion' in fin ? ` : ${fin.conclusion}` : ''}`,
    ].join('\n');
    return { chemin, fin, texte };
  }

  /** Paquet texte prêt à envoyer à une IA : prompts, description, résultat du client. */
  private paquet(general: string, p: Arbre, texte: string, message?: string | null) {
    return [
      general && `# Consignes générales\n${general}`,
      p.prompt && `# Consignes pour « ${p.titre} »\n${p.prompt}`,
      `# Procédure\n${p.titre}${p.description ? `\n${p.description}` : ''}`,
      `# Résultat du client\n${texte}`,
      message && `# Message du client\n${message}`,
    ].filter(Boolean).join('\n\n');
  }

  async envoyer(procedureId: string, user: { id: string; admin: boolean }, reponses: Record<string, string>, message?: string) {
    const p = await this.charger(procedureId);
    if (!p.publiee && !user.admin) throw new NotFoundException('Procédure introuvable');
    const r = this.resultat(p, reponses);
    if (!r.chemin.length) throw new BadRequestException('Répondez au moins à une question');
    const msg = message?.trim() || null;
    const d = await this.prisma.diagnosticEnvoye.create({
      data: { procedureId, userId: user.id, resultat: { chemin: r.chemin, fin: r.fin }, texte: r.texte, message: msg },
      include: { user: { select: { id: true, identifiant: true, nom: true, numeroOdoo: true } } },
    });
    this.activite.noter(user.id, { type: 'diagnostic', espace: ESPACE, detail: `${p.titre} : ${r.fin.texte}` });
    const qui = d.user.nom ? `${d.user.nom} (${d.user.identifiant})` : d.user.identifiant;
    void this.push.notifierAdmins({ titre: `🩺 Diagnostic : ${p.titre}`, texte: `${qui} · ${r.fin.texte}`, url: '/admin/diagnostics' });
    const general = await this.promptGeneral();
    this.webhooks.emettre('diagnostic.envoye', {
      diagnostic: { id: d.id, procedure: { id: p.id, titre: p.titre }, chemin: r.chemin, fin: r.fin, texte: r.texte, message: msg, creeLe: d.createdAt },
      user: d.user,
      ia: { promptGeneral: general, prompt: p.prompt, description: p.description, paquet: this.paquet(general, p, r.texte, msg) },
    });
    return { ok: true, id: d.id, texte: r.texte };
  }

  /** Diagnostics envoyés par un client (son historique). */
  async miens(userId: string) {
    return this.prisma.diagnosticEnvoye.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, texte: true, message: true, resultat: true, createdAt: true, procedure: { select: { id: true, titre: true } } },
    });
  }

  /** Diagnostics reçus (admin, ou n8n avec une clé API). */
  async lister(nonLus = false) {
    const l = await this.prisma.diagnosticEnvoye.findMany({
      where: nonLus ? { lu: false } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, identifiant: true, nom: true } }, procedure: { select: { id: true, titre: true } } },
    });
    return { nonLus: await this.prisma.diagnosticEnvoye.count({ where: { lu: false } }), diagnostics: l };
  }

  async marquer(id: string, lu: boolean) {
    await this.prisma.diagnosticEnvoye.update({ where: { id }, data: { lu } }).catch(() => {
      throw new NotFoundException();
    });
    return { ok: true };
  }

  /** Catalogue des procédures publiées (descriptions) : l'IA y choisit la procédure ou le diagnostic à proposer. */
  async catalogue() {
    const l = await this.prisma.procedure.findMany({
      where: { publiee: true },
      orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, titre: true, categorie: true, resume: true, description: true, updatedAt: true, etapes: { select: { _count: { select: { choix: true } } } } },
    });
    return {
      espace: ESPACE,
      promptGeneral: await this.promptGeneral(),
      procedures: l.map(({ etapes, ...p }) => ({ ...p, diagnostic: etapes.some((e) => e._count.choix > 0), lien: `/procedures/${p.id}` })),
    };
  }

  /** Export structuré d'une procédure (route principale, questions, détours) : ce que l'IA lira. */
  async exporter(id: string) {
    const p = await this.charger(id);
    const lignes = new Map<string, EtapeArbre[]>();
    for (const e of p.etapes) lignes.set(e.brancheId ?? '', [...(lignes.get(e.brancheId ?? '') ?? []), e]);
    const ligne = (k: string): unknown[] =>
      (lignes.get(k) ?? []).map((e) => ({
        id: e.id,
        texte: e.texte,
        ...(e.avertissement ? { avertissement: e.avertissement } : {}),
        ...(e.note ? { note: e.note } : {}),
        ...(e.guide && e.ecran ? { bouton: { guide: e.guide, ecran: e.ecran, pastille: e.pastille } } : {}),
        ...(e.photoCle ? { photo: true } : {}),
        ...(e.controle ? { controle: true } : {}),
        ...(e.choix.length
          ? {
              question: true,
              reponses: e.choix.map((c) => ({
                id: c.id,
                libelle: c.libelle,
                ...(c.signification ? { signification: c.signification } : {}),
                detour: ligne(c.id),
                suite: c.suite,
                ...(c.suite === 'etape' && c.etapeCibleId ? { allerA: c.etapeCibleId } : {}),
                ...(c.conclusion ? { conclusion: c.conclusion } : {}),
                ...(c.solution ? { astuce: c.solution.titre } : {}),
                ...(c.procedureCible ? { procedure: c.procedureCible.titre } : {}),
              })),
            }
          : {}),
      }));
    return {
      id: p.id, titre: p.titre, categorie: p.categorie, resume: p.resume, description: p.description, publiee: p.publiee,
      promptGeneral: await this.promptGeneral(), prompt: p.prompt,
      resumeIa: p.resumeIa, resumeIaLe: p.resumeIaLe, modifieeLe: p.updatedAt,
      route: ligne(''),
    };
  }
}
