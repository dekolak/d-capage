import { createContext, Fragment, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import fr, { Cle } from '../textes/fr';

/**
 * Traduction de l'app.
 * - Les textes de l'interface sont dans src/textes/<langue>.ts ; `fr.ts` est la référence (toutes les clés).
 * - Une langue n'a pas besoin d'être complète : une clé manquante s'affiche en français.
 * - Langue utilisée : celle du compte (`moi.langue`), sinon celle du téléphone si elle est disponible, sinon le français.
 * - Ajouter une langue = créer src/textes/<code>.ts et l'ajouter dans DICTIONNAIRES (voir docs/TRADUCTION.md).
 */
export type { Cle };
type Dictionnaire = Partial<Record<Cle, string>>;

const DICTIONNAIRES: Record<string, Dictionnaire> = {
  fr,
  // en, ← ajouter ici la langue (import en from '../textes/en')
};

/** Langues disponibles dans l'app (au moins en partie traduites). */
export const LANGUES = Object.keys(DICTIONNAIRES);
export const NOMS_LANGUES: Record<string, string> = { fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', nl: 'Nederlands' };

let courante = 'fr';
export const langue = () => courante;

/** Première langue du téléphone disponible dans l'app, sinon français. */
export function langueDuTelephone(): string {
  const prefs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const l of prefs) {
    const code = l.toLowerCase().split('-')[0];
    if (DICTIONNAIRES[code]) return code;
  }
  return 'fr';
}

const remplir = (s: string, v?: Record<string, string | number>) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s);

/** Texte traduit ; `{nom}` est remplacé par `v.nom`. */
export function t(cle: Cle, v?: Record<string, string | number>): string {
  return remplir(DICTIONNAIRES[courante]?.[cle] ?? fr[cle] ?? cle, v);
}

/**
 * Texte qui dépend d'un nombre : clés `<base>.one` et `<base>.other` (règles de pluriel de la langue).
 * Ex. tn('etapes', 3) → « 3 étapes ». `{n}` vaut le nombre.
 */
export function tn(base: string, n: number, v?: Record<string, string | number>): string {
  const forme = new Intl.PluralRules(courante).select(n) === 'one' ? 'one' : 'other';
  return t(`${base}.${forme}` as Cle, { n, ...v });
}

/** Texte avec des éléments (gras, liens…) : `{nom}` est remplacé par le nœud React `v.nom`. */
export function tr(cle: Cle, v: Record<string, ReactNode>): ReactNode {
  const s = t(cle);
  return s.split(/(\{\w+\})/).map((morceau, i) => {
    const m = /^\{(\w+)\}$/.exec(morceau);
    return <Fragment key={i}>{m && m[1] in v ? v[m[1]] : morceau}</Fragment>;
  });
}

/** Dates et nombres selon la langue. */
export const dateCourte = (d: string | number | Date) => new Date(d).toLocaleDateString(courante, { day: 'numeric', month: 'short', year: 'numeric' });
export const dateHeure = (d: string | number | Date) => new Date(d).toLocaleString(courante, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

interface Ctx { langue: string; choisir(l: string | null): void }
const LangueCtx = createContext<Ctx>({ langue: 'fr', choisir: () => {} });
export const useLangue = () => useContext(LangueCtx);

/**
 * Applique la langue (compte, sinon téléphone) et redessine l'app quand elle change.
 * `compte` = langue enregistrée sur le compte (null = celle du téléphone).
 */
export function LangueProvider({ compte, children }: { compte: string | null | undefined; children: ReactNode }) {
  const [force, setForce] = useState<string | null>(null);
  const voulue = force ?? compte ?? langueDuTelephone();
  const l = DICTIONNAIRES[voulue] ? voulue : 'fr';
  courante = l;
  useEffect(() => {
    document.documentElement.lang = l;
  }, [l]);
  const ctx = useMemo(() => ({ langue: l, choisir: setForce }), [l]);
  // key : tout l'arbre est redessiné avec la nouvelle langue
  return <LangueCtx.Provider value={ctx}><Fragment key={l}>{children}</Fragment></LangueCtx.Provider>;
}
