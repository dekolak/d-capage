/**
 * Gammes de machines : liste fixe (définie ici, pas modifiable dans l'app) pour éviter les dérives.
 * Une machine = une gamme. La gamme décide de l'espace (Lazzeko et Kiavik n'ont rien en commun), de la catégorie
 * (« Pour qui ? », plans d'entretien) et de l'univers (réglages décapage, soudure, impression…).
 * Ajouter une gamme = modifier ce fichier.
 */
export interface Gamme {
  slug: string;
  espace: 'lazzeko' | 'kiavik';
  /** Catégorie de machine (ciblage « Pour qui ? », plans d'entretien par catégorie). */
  categorie: string;
  nom: string;
  /** Univers de réglages / d'accueil (null : pas de réglages, ex. accessoire). */
  univers: 'decapage' | 'soudure' | 'impression' | null;
}

export const GAMMES: Gamme[] = [
  { slug: 'lazzeko-decapeuse', espace: 'lazzeko', categorie: 'Décapeuse', nom: 'Lazzeko · Décapeuse', univers: 'decapage' },
  { slug: 'lazzeko-soudeuse', espace: 'lazzeko', categorie: 'Soudeuse', nom: 'Lazzeko · Soudeuse', univers: 'soudure' },
  { slug: 'lazzeko-accessoire', espace: 'lazzeko', categorie: 'Accessoire', nom: 'Lazzeko · Accessoire', univers: null },
  { slug: 'kiavik-imprimante', espace: 'kiavik', categorie: 'Imprimante', nom: 'Kiavik · Imprimante', univers: 'impression' },
  { slug: 'kiavik-accessoire', espace: 'kiavik', categorie: 'Accessoire', nom: 'Kiavik · Accessoire', univers: null },
];
export const SLUGS_GAMMES = GAMMES.map((g) => g.slug);
export const gamme = (slug?: string | null) => GAMMES.find((g) => g.slug === slug);
