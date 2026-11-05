import type { ConfigMachine, Valeurs } from '../schema';
import type { Erreur } from '../valeurs';

export interface Indicateur {
  key: string;
  label: string;
  valeur: number;
  unite: string;
  /** Texte court d'interprétation (optionnel). */
  note?: string;
  /** true si le calcul repose sur une constante hypothétique. */
  hypothese?: boolean;
}

/**
 * Module propre à une technologie (laser pulsé, sablage…).
 * Les indicateurs sont recalculés à l'affichage, jamais stockés :
 * corriger une constante met à jour toutes les fiches.
 */
export interface Technologie {
  id: string;
  nom: string;
  indicateurs(cfg: ConfigMachine, v: Valeurs): Indicateur[];
  /** Contrôles qui croisent plusieurs champs (ex. zone max selon la lentille). */
  valider?(cfg: ConfigMachine, v: Valeurs): Erreur[];
}
