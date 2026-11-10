/**
 * Langues de l'app (code ISO 639-1). `fr` est la langue de référence.
 * Une langue listée ici peut être enregistrée sur un compte ; l'app affiche le français
 * pour tout texte pas encore traduit (voir docs/TRADUCTION.md).
 */
export const LANGUES = ['fr', 'en'] as const;
export type Langue = (typeof LANGUES)[number];
