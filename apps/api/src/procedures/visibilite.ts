import { BadRequestException } from '@nestjs/common';
import { espaceDeLaRequete } from '../espaces/espaces';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Qui voit quel contenu (pas-à-pas, Bon à savoir) :
 * - chaque contenu appartient à UN espace (technologie) : lazzeko ou kiavik, jamais les deux ;
 * - sans étiquette, il concerne toutes les machines de l'espace ;
 * - avec étiquettes, il concerne les clients dont au moins une machine (modèle visible dans l'espace) porte une de ces étiquettes.
 */
export const ESPACES_CONTENU = ['lazzeko', 'kiavik'] as const;
export type EspaceContenu = (typeof ESPACES_CONTENU)[number];

/** Module « Pas-à-pas et Bon à savoir » de l'espace de la requête. */
export const moduleContenu = (req: { headers: Record<string, string | string[] | undefined> }) =>
  espaceDeLaRequete(req).slug === 'lazzeko' ? 'procedures-lazzeko' : 'procedures-kiavik';

export const norm = (e: string) => e.trim().toLowerCase();

/** Étiquettes saisies : sans espaces autour, sans doublon (sans tenir compte des majuscules), 30 au plus. */
export function nettoyerEtiquettes(l?: string[]): string[] | undefined {
  if (!l) return undefined;
  const vues = new Set<string>();
  const r: string[] = [];
  for (const x of l) {
    const e = x.trim().replace(/\s+/g, ' ');
    if (e && !vues.has(norm(e))) {
      vues.add(norm(e));
      r.push(e.slice(0, 40));
    }
  }
  if (r.length > 30) throw new BadRequestException('30 étiquettes au plus');
  return r;
}

export function verifierEspace(e?: string) {
  if (e !== undefined && !ESPACES_CONTENU.includes(e as EspaceContenu)) throw new BadRequestException('Espace : lazzeko ou kiavik');
  return e;
}

/** Étiquettes des machines du client (modèles visibles dans l'espace). */
export async function etiquettesClient(prisma: PrismaService, userId: string, espace: string): Promise<Set<string>> {
  const ms = await prisma.userMachine.findMany({
    where: { userId, variante: { modele: { espaces: { has: espace } } } },
    select: { variante: { select: { modele: { select: { etiquettes: true } } } } },
  });
  return new Set(ms.flatMap((m) => m.variante.modele.etiquettes.map(norm)));
}

export const visible = (c: { espace: string; etiquettes: string[] }, espace: string, siennes: Set<string>) =>
  c.espace === espace && (!c.etiquettes.length || c.etiquettes.some((e) => siennes.has(norm(e))));

/** Contexte d'un client (null = admin : il voit tout). */
export type Lecteur = { espace: string; etiquettes: Set<string> } | null;
export async function lecteur(prisma: PrismaService, moi: { id: string; admin: boolean }, espace: string): Promise<Lecteur> {
  return moi.admin ? null : { espace, etiquettes: await etiquettesClient(prisma, moi.id, espace) };
}
