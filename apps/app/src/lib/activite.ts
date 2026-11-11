import { api } from './api';

/**
 * Journal d'activité (clients seulement, l'API ignore les admins) : pages consultées et recherches.
 * Envoi en arrière-plan ; une erreur n'est jamais montrée à l'utilisateur.
 */
let dernier = { cle: '', quand: 0 };

function envoyer(json: { type: 'page' | 'recherche'; chemin?: string; detail?: string; resultats?: number }) {
  const cle = JSON.stringify([json.type, json.chemin, json.detail]);
  if (cle === dernier.cle && Date.now() - dernier.quand < 20000) return; // pas de doublon rapproché
  dernier = { cle, quand: Date.now() };
  api('/activite', { method: 'POST', json }).catch(() => {});
}

export const noterPage = (chemin: string, titre?: string) => envoyer({ type: 'page', chemin: chemin.slice(0, 300), detail: titre?.slice(0, 200) });
export const noterRecherche = (texte: string, resultats: number, chemin: string) =>
  envoyer({ type: 'recherche', detail: texte.slice(0, 200), resultats, chemin: chemin.slice(0, 300) });

/** Titre lisible de la page affichée : bouton ouvert dans un guide, titre de l'écran, sinon le titre principal. */
export function titrePage(): string | undefined {
  const t = (s: string) => (document.querySelector(s) as HTMLElement | null)?.innerText?.trim().replace(/\s*\n\s*/g, ' · ');
  const pastille = t('.gx-fiche h3');
  const ecran = t('.gx-titre');
  if (ecran) return pastille ? `${ecran} → ${pastille}` : ecran;
  return t('main h1') ?? undefined;
}
