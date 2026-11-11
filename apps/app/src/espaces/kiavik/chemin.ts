/**
 * Moteur des diagnostics : la « route principale » (étapes sans branche) et des détours.
 * Une question (étape avec des réponses) ouvre, selon la réponse, son détour (étapes de la branche),
 * puis la suite de la réponse : `retour` (on reprend après la question), `etape` (saut vers une étape
 * de la route principale), `resolu` ou `contact` (fin).
 *
 * ⚠️ Copie de apps/api/src/procedures/chemin.ts (testé côté API) : à garder identiques.
 */
export type Suite = 'retour' | 'etape' | 'resolu' | 'contact';
export const SUITES: Suite[] = ['retour', 'etape', 'resolu', 'contact'];

export interface ChoixMoteur { id: string; suite: string; etapeCibleId: string | null }
export interface EtapeMoteur<C extends ChoixMoteur = ChoixMoteur> { id: string; ordre: number; brancheId: string | null; choix: C[] }

export interface Pas<E> {
  e: E;
  /** 0 = route principale, 1 = détour, 2 = détour dans un détour… */
  profondeur: number;
  /** Place, sur la route principale, de l'étape (ou de la question dont on fait le détour). */
  principal: number;
}
export type Fin<C> = { type: 'termine' } | { type: 'resolu' | 'contact'; choix: C };
export interface Chemin<E, C> { pas: Pas<E>[]; fin: Fin<C> | null }

const LIMITE = 500; // garde-fou contre les boucles (sauts en arrière)

/** Chemin suivi avec ces réponses (question → réponse). `fin` vaut null si on attend la réponse à la dernière question. */
export function calculerChemin<C extends ChoixMoteur, E extends EtapeMoteur<C>>(
  etapes: E[],
  reponses: Record<string, string>,
): Chemin<E, C> {
  const lignes = new Map<string, E[]>();
  for (const e of [...etapes].sort((a, b) => a.ordre - b.ordre)) {
    const k = e.brancheId ?? '';
    lignes.set(k, [...(lignes.get(k) ?? []), e]);
  }
  const principale = lignes.get('') ?? [];
  const pas: Pas<E>[] = [];
  type R = { t: 'suite' } | { t: 'attente' } | { t: 'fin'; fin: Fin<C> } | { t: 'saut'; cible: string };

  const parcourir = (ligne: E[], debut: number, profondeur: number, principal: number): R => {
    for (let k = debut; k < ligne.length; k++) {
      const e = ligne[k];
      const place = profondeur === 0 ? k : principal;
      pas.push({ e, profondeur, principal: place });
      if (pas.length > LIMITE) return { t: 'attente' };
      if (!e.choix.length) continue;
      const c = e.choix.find((x) => x.id === reponses[e.id]);
      if (!c) return { t: 'attente' };
      const r = parcourir(lignes.get(c.id) ?? [], 0, profondeur + 1, place);
      if (r.t !== 'suite') return r;
      if (c.suite === 'resolu' || c.suite === 'contact') return { t: 'fin', fin: { type: c.suite, choix: c } };
      if (c.suite === 'etape' && c.etapeCibleId) return { t: 'saut', cible: c.etapeCibleId };
    }
    return { t: 'suite' };
  };

  let debut = 0;
  for (;;) {
    const r = parcourir(principale, debut, 0, 0);
    if (r.t === 'suite') return { pas, fin: { type: 'termine' } };
    if (r.t === 'attente') return { pas, fin: null };
    if (r.t === 'fin') return { pas, fin: r.fin };
    const i = principale.findIndex((x) => x.id === r.cible);
    if (i < 0) return { pas, fin: { type: 'termine' } };
    debut = i;
  }
}

/** « Partie — texte » → texte (le titre de partie ne sert qu'à l'affichage). Même règle que decouperEtape côté app. */
export const sansPartie = (texte: string) => /^(.{2,40}?)\s+—\s+([\s\S]+)$/.exec(texte)?.[2] ?? texte;
