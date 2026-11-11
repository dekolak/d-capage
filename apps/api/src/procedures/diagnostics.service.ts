import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActiviteService } from '../activite/activite.service';
import { GuidesService } from '../guides/guides.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { calculerChemin, sansPartie } from './chemin';

/** « Partie — texte » → partie. */
const partieDe = (texte: string) => /^(.{2,40}?)\s+—\s+([\s\S]+)$/.exec(texte)?.[1]?.trim() ?? null;

const ESPACE = 'kiavik';
const clePrompt = (espace: string) => `ia.prompt:${espace}`;

const arbre = {
  suivante: { select: { id: true, titre: true } },
  etapes: {
    orderBy: { ordre: 'asc' },
    include: {
      choix: { orderBy: { ordre: 'asc' }, include: { solution: { select: { id: true, titre: true } }, procedureCible: { select: { id: true, titre: true } } } },
      _count: { select: { photos: true } },
      solution: { select: { titre: true } },
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
  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private webhooks: WebhooksService,
    private activite: ActiviteService,
    private guides: GuidesService,
  ) {}

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

  /**
   * Résumé texte de la procédure, fabriqué automatiquement (sans IA) à partir de l'arbre : étapes numérotées,
   * questions, réponses (avec leur signification), détours, suites, conclusions, notes. Toujours à jour.
   */
  resume(p: Arbre): string {
    const lignes = new Map<string, EtapeArbre[]>();
    for (const e of p.etapes) lignes.set(e.brancheId ?? '', [...(lignes.get(e.brancheId ?? '') ?? []), e]);
    const principale = lignes.get('') ?? [];
    const out: string[] = [`Procédure : ${p.titre}`, `Catégorie : ${p.categorie}`];
    if (p.resume) out.push(`Résumé : ${p.resume}`);
    if (p.description) out.push(`Description : ${p.description}`);
    out.push('', 'Étapes :');
    const suite = (c: ChoixArbre) => {
      if (c.suite === 'resolu') return `FIN : problème résolu${c.conclusion ? ` — ${c.conclusion}` : ''}`;
      if (c.suite === 'contact') return `FIN : contacter Kiavik${c.conclusion ? ` — ${c.conclusion}` : ''}`;
      if (c.suite === 'etape') {
        const k = principale.findIndex((x) => x.id === c.etapeCibleId);
        return k >= 0 ? `↪ aller à l'étape ${k + 1}` : '↪ aller à une étape (non choisie)';
      }
      return '↩ retour sur la route principale';
    };
    const ecrire = (k: string, marge: string) => {
      let partie: string | null = null;
      (lignes.get(k) ?? []).forEach((e, n) => {
        const p2 = k ? null : partieDe(e.texte);
        if (p2 && p2 !== partie) out.push(`${marge}[${p2}]`);
        partie = p2 ?? partie;
        const tete = k ? '- ' : `${n + 1}. `;
        const infos = [
          e.avertissement && `⚠️ ${e.avertissement}`,
          e.guide && e.ecran && `bouton ${this.guides.libelleLien(e.guide, e.ecran, e.pastille)}`,
          e._count.photos && `${e._count.photos} photo${e._count.photos > 1 ? 's' : ''}`,
          e.controle && `contrôle Oui / Non${e.solution ? ` ; si Non : astuce « ${e.solution.titre} »` : ''}`,
        ].filter(Boolean);
        out.push(`${marge}${tete}${e.choix.length ? '❓ ' : ''}${sansPartie(e.texte)}${infos.length ? ` (${infos.join(' ; ')})` : ''}`);
        if (e.note) out.push(`${marge}   Note : ${e.note}`);
        for (const c of e.choix) {
          out.push(`${marge}   → ${c.libelle}${c.signification ? ` (${c.signification})` : ''} :`);
          ecrire(c.id, `${marge}      `);
          out.push(`${marge}      ${suite(c)}`);
          if (c.solution) out.push(`${marge}      💡 astuce : ${c.solution.titre}`);
          if (c.procedureCible) out.push(`${marge}      📋 procédure : ${c.procedureCible.titre}`);
        }
      });
    };
    ecrire('', '');
    if (!principale.length) out.push('(aucune étape)');
    if (p.suivante) out.push('', `Ensuite (proposé à la fin) : ➡ procédure « ${p.suivante.titre} »`);
    return out.join('\n');
  }

  /** Paquet texte prêt à coller dans une IA : prompts, résumé de la procédure, puis (s'il y a lieu) résultat et message du client. */
  private paquet(general: string, p: Arbre, texte?: string, message?: string | null) {
    return [
      general && `# Consignes générales\n${general}`,
      p.prompt && `# Consignes pour « ${p.titre} »\n${p.prompt}`,
      `# Procédure\n${this.resume(p)}`,
      texte && `# Résultat du client\n${texte}`,
      message && `# Message du client\n${message}`,
    ].filter(Boolean).join('\n\n');
  }

  /** Paquet d'un diagnostic reçu (bouton « Copier pour l'IA »). */
  async paquetDiagnostic(id: string) {
    const d = await this.prisma.diagnosticEnvoye.findUnique({ where: { id } });
    if (!d) throw new NotFoundException();
    return { texte: this.paquet(await this.promptGeneral(), await this.charger(d.procedureId), d.texte, d.message) };
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
        ...(e._count.photos ? { photos: e._count.photos } : {}),
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
      /** Résumé texte automatique (sans IA), et le même précédé des prompts : prêt à coller dans une IA. */
      resumeTexte: this.resume(p),
      paquet: this.paquet(await this.promptGeneral(), p),
      route: ligne(''),
    };
  }
}
