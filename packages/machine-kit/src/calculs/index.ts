import { laserPulse } from './laser-pulse';
import { soudureLaser } from './soudure-laser';
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
