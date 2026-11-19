import { laserPulse } from './laser-pulse';
import { soudureLaser } from './soudure-laser';
import type { ConfigMachine, Valeurs } from '../schema';
import type { Technologie } from './types';

export * from './types';
export { modeleLaser } from './laser-pulse';
export { modeleSoudure } from './soudure-laser';

/** Registre des technologies. Nouvelle technologie = un fichier + une ligne ici. */
const REGISTRE: Record<string, Technologie> = {
  [laserPulse.id]: laserPulse,
  [soudureLaser.id]: soudureLaser,
};

export function technologie(id: string): Technologie | undefined {
  return REGISTRE[id];
}

export function technologies(): Technologie[] {
  return Object.values(REGISTRE);
}

/** Métiers connus, dans l'ordre d'affichage. */
export const UNIVERS = ['decapage', 'soudure'] as const;

/** Métier d'une technologie (« decapage » par défaut). */
export function universTechnologie(id?: string | null): string {
  return (id && REGISTRE[id]?.univers) || 'decapage';
}

/** Métier d'une fiche : technologie de la machine, ou procédé choisi dans les valeurs. */
export function universFiche(cfg: ConfigMachine, v: Valeurs): string {
  const t = REGISTRE[cfg.technologie];
  return t?.universFiche?.(cfg, v) ?? t?.univers ?? 'decapage';
}
