import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';

/** Académie : module isolé (cours → leçons → blocs). Voir docs/ACADEMIE.md. */

export type TypeBloc = 'titre' | 'texte' | 'vimeo' | 'image' | 'encadre' | 'simulateur' | 'html' | 'fichier' | 'note';
export interface Repere { x: number; y: number; s: 'halo' | 'attention' }
export interface Bloc {
  id: string;
  type: TypeBloc;
  texte?: string;
  niveau?: 'astuce' | 'avertissement';
  url?: string;
  titre?: string;
  vignette?: string;
  duree?: number;
  fichierId?: string;
  chemin?: string;
  legende?: string;
  /** Repères animés sur une photo (position relative 0–1) : halo qui pulse ou ⚠️. */
  reperes?: Repere[];
  nom?: string | null;
  simulateurId?: string;
  html?: string;
  hauteur?: number;
}

/** « parcours » : plusieurs leçons, progression ; « page » : un contenu seul (simulateur, fiche…). */
export type TypeCours = 'parcours' | 'page';
export interface ResumeCours {
  id: string; titre: string; description: string | null; publie: boolean; espace: string; type: TypeCours;
  couverture?: string; vignette?: string; nbLecons: number; pourQui: string[];
  cibleModeles: string[]; cibleCategories: string[];
  faites: number; reprendre: string | null;
}
export interface Cours {
  id: string; titre: string; description: string | null; publie: boolean; espace: string; type: TypeCours; couverture?: string; vignette?: string;
  cibleCategories: string[]; cibleModeles: string[];
  lecons: { id: string; titre: string; faite: boolean }[];
}
export interface Lecon {
  id: string; titre: string; faite: boolean; blocs: Bloc[];
  cours: { id: string; titre: string; nbLecons: number; rang: number };
  precedente: string | null; suivante: string | null;
}

export const moduleAcademie = (espace: string) => (espace === 'lazzeko' ? 'academie-lazzeko' : 'academie-kiavik');

/** Le compte a-t-il l'Académie dans l'espace ouvert ? (l'admin : toujours) */
export function useAccesAcademie() {
  const { moi } = useAuth();
  const { espace } = useEspace();
  return !!moi && (moi.role === 'ADMIN' || moi.modules.includes(moduleAcademie(espace.slug)));
}

/** Vimeo : identifiant et clé des vidéos non répertoriées (vimeo.com/123/abc, player.vimeo.com/video/123?h=abc). */
export function idVimeo(url: string): { id: string; h?: string } | null {
  const m = url.trim().match(/^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{5,12})(?:\/([0-9a-f]{6,20}))?(?:[/?#].*)?$/i);
  if (!m) return null;
  const h = m[2] ?? url.match(/[?&]h=([0-9a-f]{6,20})/i)?.[1];
  return { id: m[1], ...(h ? { h } : {}) };
}

/** Titre, vignette et durée d'une vidéo Vimeo (oEmbed, sans clé). null si Vimeo ne répond pas. */
export async function infosVimeo(url: string): Promise<{ titre?: string; vignette?: string; duree?: number } | null> {
  try {
    const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url.trim())}&width=640`);
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string; thumbnail_url?: string; duration?: number };
    return { titre: j.title, vignette: j.thumbnail_url, duree: j.duration };
  } catch {
    return null;
  }
}

export const duree = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');
