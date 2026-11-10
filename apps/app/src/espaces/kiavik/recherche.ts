import { Guide } from './guides';

/**
 * Recherche dans les guides, sur le téléphone (instantanée, sans serveur).
 * Cherche dans le titre, les mots-clés, le texte et le conseil des pastilles, et le titre de l'écran.
 * Sans accents ni majuscules ; chaque mot tapé doit être trouvé (début de mot, ou une faute de frappe tolérée).
 */
export interface Resultat {
  guide: string;
  nomGuide: string;
  ecran: string;
  codeEcran: string;
  titreEcran: string;
  pastille: string;
  titre: string;
  extrait: string;
  score: number;
}

export const normaliser = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();

const mots = (s: string) => normaliser(s).split(' ').filter(Boolean);

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

export function rechercher(guides: Guide[], requete: string, max = 50): Resultat[] {
  const q = mots(requete);
  if (!q.length) return [];
  const res: Resultat[] = [];
  for (const g of guides)
    for (const e of g.ecrans) {
      const champsEcran = mots(`${e.code} ${e.titre}`);
      for (const p of e.pastilles) {
        // poids : identifiant / titre 3, mots-clés 3, écran 1, texte et conseil 1
        const champs: [string[], number][] = [
          [mots(`${p.id} ${p.titre}`), 3],
          [mots((p.mots_cles ?? []).join(' ')), 3],
          [champsEcran, 1],
          [mots(`${p.texte} ${p.conseil ?? ''}`), 1],
        ];
        let score = 0;
        let tous = true;
        for (const c of q) {
          let s = 0;
          for (const [liste, poids] of champs) s = Math.max(s, meilleur(c, liste) * poids);
          if (!s) {
            tous = false;
            break;
          }
          score += s;
        }
        if (!tous) continue;
        if (p.etat === 'non_utilise') score -= 2; // les boutons utilisés d'abord
        res.push({
          guide: g.slug, nomGuide: g.nom, ecran: e.id, codeEcran: e.code, titreEcran: e.titre,
          pastille: p.id, titre: p.titre, extrait: p.texte, score,
        });
      }
    }
  return res.sort((a, b) => b.score - a.score).slice(0, max);
}
