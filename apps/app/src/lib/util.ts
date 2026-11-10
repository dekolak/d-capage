import type { I18n } from '@decapage/machine-kit';

import { dateCourte, langue } from './i18n';

/** Libellé d'une config machine ({fr, en, …}) dans la langue de l'app, sinon en français. */
export const libelle = (x: I18n | undefined) => (x as Record<string, string> | undefined)?.[langue()] ?? x?.fr ?? '';

/** Date courte dans la langue de l'app. */
export const date = (s: string) => dateCourte(s);
export const nomMachine = (m: { nom: string; surnom: string | null }) => (m.surnom ? `${m.surnom} · ${m.nom}` : m.nom);
