import { laserPulse } from './laser-pulse';
import type { Technologie } from './types';

export * from './types';
export { modeleLaser } from './laser-pulse';

/** Registre des technologies. Nouvelle technologie = un fichier + une ligne ici. */
const REGISTRE: Record<string, Technologie> = {
  [laserPulse.id]: laserPulse,
};

export function technologie(id: string): Technologie | undefined {
  return REGISTRE[id];
}

export function technologies(): Technologie[] {
  return Object.values(REGISTRE);
}
