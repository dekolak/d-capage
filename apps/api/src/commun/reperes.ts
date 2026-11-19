import { BadRequestException } from '@nestjs/common';

/**
 * Repères animés posés sur une photo (pas-à-pas, Académie) : ⭕ halo qui pulse, ⚠️ qui bat.
 * Position relative (0–1) : l'app les dessine par-dessus l'image, quelle que soit sa taille. 10 au plus.
 */
export interface Repere { x: number; y: number; s: 'halo' | 'attention' }

export function nettoyerReperes(entree: unknown): Repere[] {
  if (entree === undefined || entree === null) return [];
  if (!Array.isArray(entree)) throw new BadRequestException('Repères : liste attendue');
  const ok = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  return entree.slice(0, 10).flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return ok(o.x) && ok(o.y) ? [{ x: +(o.x as number).toFixed(4), y: +(o.y as number).toFixed(4), s: o.s === 'attention' ? 'attention' : 'halo' } as Repere] : [];
  });
}
