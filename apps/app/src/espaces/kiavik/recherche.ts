import { Guide } from './guides';

/**
 * Recherche dans les guides, sur le téléphone (instantanée, sans serveur, hors connexion).
 * Cherche dans le titre, les mots-clés (invisibles pour le client), le texte et le conseil des boutons, le titre de l'écran,
 * et les groupes de boutons (« Flèches de direction »).
 * Comprend les phrases : « je me rappelle plus le retard de mouvement » → retard, mouvement (mots inutiles ignorés,
 * quelques synonymes). Sans accents ni majuscules ; début de mot ou une faute de frappe tolérée.
 * Si tous les mots ne sont pas trouvés, les boutons qui en ont le plus passent d'abord (au moins la moitié des mots).
 */
export interface Resultat {
  type: 'pastille' | 'ensemble';
  guide: string;
  nomGuide: string;
  ecran: string;
  codeEcran: string;
  titreEcran: string;
  /** Bouton (type pastille) ou identifiant du groupe (type ensemble). */
  pastille: string;
  titre: string;
  extrait: string;
  /** Groupe : ses boutons. */
  pastilles?: string[];
  score: number;
}

export const normaliser = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();

const mots = (s: string) => normaliser(s).split(' ').filter(Boolean);

/** Mots sans intérêt pour la recherche (« je me rappelle plus », « comment », « le »…). */
const MOTS_VIDES = new Set(
  ('je j me m moi tu te t il elle on nous vous ils elles le la les l un une des de du d a au aux et ou en pour par sur sous dans avec sans ' +
    'ce cet cette ces c ca cela qui que quoi qu quel quelle quels quelles comment pourquoi quand est sont etre ai as avoir se s sa son ses ' +
    'mon ma mes ton ta tes ne n pas plus rappelle rappeles rappelais souviens souvenir sais savoir trouve trouver cherche chercher ' +
    'veux voudrais faut faire fait peux peut bouton boutons touche truc machin svp merci bonjour aide')
    .split(' '),
);

/** Quelques synonymes de départ (les mots propres à un bouton se mettent dans ses mots-clés, dans l'app). */
const SYNONYMES: Record<string, string[]> = {
  delai: ['retard'], attente: ['retard', 'pause'], decalage: ['retard', 'offset'], attendre: ['retard', 'pause'],
  fleche: ['direction'], fleches: ['direction'], deplacer: ['mouvement', 'direction'], bouger: ['mouvement', 'direction'],
  arreter: ['stop', 'pause'], stopper: ['stop', 'pause'], demarrer: ['start', 'lancer'], lancer: ['start', 'demarrer'],
  nettoyer: ['nettoyage'], nettoyage: ['nettoyer'], buse: ['buses', 'tete'], couleur: ['couleurs', 'canal'],
};

/** Mots utiles de la requête, chacun avec ses variantes (synonymes). */
export function motsRecherche(requete: string): string[][] {
  const l = mots(requete);
  const utiles = l.filter((m) => !MOTS_VIDES.has(m));
  // que des mots vides (« plus ») : on les garde quand même
  return (utiles.length ? utiles : l).map((m) => [m, ...(SYNONYMES[m] ?? [])]);
}

/** Combien de mots de la requête sont trouvés dans ce texte (0 si moins de la moitié). */
export function nbTrouves(q: string[][], texte: string): number {
  if (!q.length) return 0;
  const liste = mots(texte);
  const n = q.filter((variantes) => variantes.some((v) => meilleur(v, liste) > 0)).length;
  return n >= Math.ceil(q.length / 2) ? n : 0;
}

/** Une faute au plus (lettre en trop, en moins, remplacée ou inversée). */
function uneFaute(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length || i === b.length) return Math.abs(a.length - b.length) <= 1;
  if (a.slice(i + 1) === b.slice(i + 1)) return true; // remplacée
  if (a.slice(i + 1) === b.slice(i)) return true; // en trop dans a
  if (a.slice(i) === b.slice(i + 1)) return true; // en moins dans a
  return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // inversée
}

/** Le mot cherché correspond-il à ce mot du texte ? 2 = début de mot, 1 = faute de frappe, 0 = non. */
function correspond(cherche: string, mot: string): number {
  if (mot.startsWith(cherche)) return 2;
  if (cherche.length >= 4 && (uneFaute(cherche, mot.slice(0, cherche.length)) || uneFaute(cherche, mot))) return 1;
  return 0;
}

function meilleur(cherche: string, liste: string[]): number {
  let m = 0;
  for (const w of liste) if ((m = Math.max(m, correspond(cherche, w))) === 2) break;
  return m;
}

/** Adresse d'un résultat : l'écran avec le bouton (?p=) ou le groupe (?g=) en surbrillance. */
export const lienResultat = (r: Resultat) =>
  `/guides/${r.guide}/${r.ecran}?${r.type === 'ensemble' ? 'g' : 'p'}=${encodeURIComponent(r.pastille)}`;

export function rechercher(guides: Guide[], requete: string, max = 50): Resultat[] {
  const q = motsRecherche(requete);
  if (!q.length) return [];
  const res: Resultat[] = [];
  /** Score des champs pondérés : mots trouvés d'abord (×100), puis la qualité (titre et mots-clés comptent plus). */
  const noter = (champs: [string[], number][]) => {
    let score = 0;
    let trouves = 0;
    for (const variantes of q) {
      let s = 0;
      for (const v of variantes) for (const [liste, poids] of champs) s = Math.max(s, meilleur(v, liste) * poids);
      if (s) trouves++;
      score += s;
    }
    return trouves >= Math.ceil(q.length / 2) ? trouves * 100 + score : 0;
  };
  for (const g of guides)
    for (const e of g.ecrans) {
      const champsEcran = mots(`${e.code} ${e.titre}`);
      const base = { guide: g.slug, nomGuide: g.nom, ecran: e.id, codeEcran: e.code, titreEcran: e.titre };
      for (const p of e.pastilles) {
        // poids : identifiant / titre 3, mots-clés 3, écran 1, texte et conseil 1
        let score = noter([
          [mots(`${p.id} ${p.titre}`), 3],
          [mots((p.mots_cles ?? []).join(' ')), 3],
          [champsEcran, 1],
          [mots(`${p.texte} ${p.conseil ?? ''}`), 1],
        ]);
        if (!score) continue;
        if (p.etat === 'non_utilise') score -= 2; // les boutons utilisés d'abord
        res.push({ ...base, type: 'pastille', pastille: p.id, titre: p.titre, extrait: p.texte, score });
      }
      for (const en of e.ensembles ?? []) {
        const titres = en.pastilles.map((id) => e.pastilles.find((p) => p.id === id)?.titre ?? '').join(' ');
        const score = noter([
          [mots(en.nom), 3],
          [mots((en.mots_cles ?? []).join(' ')), 3],
          [champsEcran, 1],
          [mots(`${en.texte ?? ''} ${titres}`), 1],
        ]);
        // un groupe passe juste devant ses boutons à égalité
        if (score) res.push({ ...base, type: 'ensemble', pastille: en.id, titre: en.nom, extrait: en.texte ?? '', pastilles: en.pastilles, score: score + 1 });
      }
    }
  return res.sort((a, b) => b.score - a.score).slice(0, max);
}
