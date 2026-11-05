import type { I18n } from '@decapage/machine-kit';

export const t = (x: I18n | undefined) => x?.fr ?? '';
export const date = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const nomMachine = (m: { nom: string; surnom: string | null }) => (m.surnom ? `${m.surnom} · ${m.nom}` : m.nom);
