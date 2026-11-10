import { ReactElement } from 'react';

/** Un onglet de la barre du bas. `icone` = tracé SVG (24×24) ; `plus` = gros bouton central. */
export interface Onglet {
  to: string;
  label: string;
  icone?: string;
  plus?: boolean;
  end?: boolean;
}

/**
 * Partie de l'app propre à un espace : ses écrans et sa barre du bas.
 * Le compte, les conditions, les messages et l'administration sont communs (App.tsx).
 */
export interface AppEspace {
  onglets: Onglet[];
  /** Routes de l'espace (fragment de <Route>, appelé comme une fonction dans <Routes>). */
  routes(): ReactElement;
}

export const ICONES = {
  liste: 'M4 6h16M4 12h16M4 18h10',
  groupe: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
  aide: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  compte: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  livre: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  etapes: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
};
