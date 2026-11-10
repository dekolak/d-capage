import { kiavik } from './kiavik';
import { lazzeko } from './lazzeko';
import { AppEspace } from './types';

/** Écrans de chaque espace, par slug (voir apps/api/src/espaces/espaces.ts). */
export const APPS: Record<string, AppEspace> = { lazzeko, kiavik };
