/**
 * Affichage clair / sombre, choisi sur ce téléphone (Compte → Affichage).
 * « auto » suit le réglage du téléphone. Posé sur <html data-theme="clair|sombre"> ; les couleurs sont dans styles.css.
 */
export type Theme = 'auto' | 'clair' | 'sombre';
const CLE = 'decapage.theme';
const sombreTel = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export const themeChoisi = (): Theme => {
  const v = localStorage.getItem(CLE);
  return v === 'clair' || v === 'sombre' ? v : 'auto';
};

export function appliquerTheme(choix: Theme = themeChoisi()) {
  const sombre = choix === 'sombre' || (choix === 'auto' && !!sombreTel()?.matches);
  document.documentElement.dataset.theme = sombre ? 'sombre' : 'clair';
}

export function choisirTheme(choix: Theme) {
  if (choix === 'auto') localStorage.removeItem(CLE);
  else localStorage.setItem(CLE, choix);
  appliquerTheme(choix);
}

/** Au démarrage : appliquer, puis suivre le téléphone s'il change (mode auto). */
export function demarrerTheme() {
  appliquerTheme();
  sombreTel()?.addEventListener?.('change', () => appliquerTheme());
}
