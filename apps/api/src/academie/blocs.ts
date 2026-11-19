import { BadRequestException } from '@nestjs/common';

/**
 * Blocs d'une leçon de l'Académie (JSON dans LeconAcademie.blocs). Une page = une suite de blocs simples ;
 * le bloc « html » (et le simulateur) est affiché dans une iframe isolée côté app (sandbox, sans accès au compte).
 */
/** « note » : rappel pour l'admin (ex. « vidéo à placer ici ») : jamais envoyé aux clients. */
export const TYPES_BLOCS = ['titre', 'texte', 'vimeo', 'image', 'encadre', 'simulateur', 'html', 'fichier', 'note'] as const;
export type TypeBloc = (typeof TYPES_BLOCS)[number];
export type Bloc = { id: string; type: TypeBloc } & Record<string, unknown>;

const MAX_BLOCS = 100;
const texte = (v: unknown, max: number, nom: string, requis = true) => {
  if (v === undefined || v === null || v === '') {
    if (requis) throw new BadRequestException(`${nom} : vide`);
    return undefined;
  }
  if (typeof v !== 'string') throw new BadRequestException(`${nom} : texte attendu`);
  if (v.length > max) throw new BadRequestException(`${nom} : ${max} caractères au plus`);
  return v;
};
const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e6 ? Math.round(v) : undefined);

/** Vimeo : https://vimeo.com/123456789 ou /123456789/abcdef (non répertoriée), player.vimeo.com/video/123?h=abc. */
export function idVimeo(url: string): { id: string; h?: string } | null {
  const m = url.trim().match(/^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{5,12})(?:\/([0-9a-f]{6,20}))?(?:[/?#].*)?$/i);
  if (!m) return null;
  const h = m[2] ?? url.match(/[?&]h=([0-9a-f]{6,20})/i)?.[1];
  return { id: m[1], ...(h ? { h } : {}) };
}

/** Vérifie et nettoie les blocs envoyés par l'éditeur (champs connus seulement). */
export function nettoyerBlocs(entree: unknown): Bloc[] {
  if (!Array.isArray(entree)) throw new BadRequestException('blocs : liste attendue');
  if (entree.length > MAX_BLOCS) throw new BadRequestException(`${MAX_BLOCS} blocs au plus par leçon`);
  const ids = new Set<string>();
  return entree.map((b, i) => {
    if (!b || typeof b !== 'object') throw new BadRequestException(`bloc ${i + 1} : invalide`);
    const x = b as Record<string, unknown>;
    const type = x.type as TypeBloc;
    if (!TYPES_BLOCS.includes(type)) throw new BadRequestException(`bloc ${i + 1} : type inconnu`);
    let id = typeof x.id === 'string' && /^[\w-]{1,40}$/.test(x.id) ? x.id : `b${i}-${Date.now().toString(36)}`;
    if (ids.has(id)) id = `${id}-${i}`;
    ids.add(id);
    const n = `bloc ${i + 1}`;
    switch (type) {
      case 'titre':
        return { id, type, texte: texte(x.texte, 200, n) };
      case 'note':
        return { id, type, texte: texte(x.texte, 4000, n) };
      case 'texte':
        return { id, type, texte: texte(x.texte, 20000, n) };
      case 'encadre':
        return { id, type, niveau: x.niveau === 'avertissement' ? 'avertissement' : 'astuce', texte: texte(x.texte, 4000, n) };
      case 'vimeo': {
        const url = texte(x.url, 500, n)!;
        if (!idVimeo(url)) throw new BadRequestException(`${n} : lien Vimeo invalide`);
        const vignette = texte(x.vignette, 500, n, false);
        return {
          id, type, url,
          titre: texte(x.titre, 200, n, false),
          ...(vignette && /^https:\/\/i\.vimeocdn\.com\//.test(vignette) ? { vignette } : {}),
          ...(nombre(x.duree) !== undefined ? { duree: nombre(x.duree) } : {}),
        };
      }
      case 'image': {
        // repères animés posés sur la photo (position relative 0–1) : halo qui pulse ou ⚠️
        const reperes = (Array.isArray(x.reperes) ? x.reperes : []).slice(0, 10).flatMap((r) => {
          const o = r as Record<string, unknown>;
          const ok = (v: unknown) => typeof v === 'number' && v >= 0 && v <= 1;
          return ok(o.x) && ok(o.y) ? [{ x: +(o.x as number).toFixed(4), y: +(o.y as number).toFixed(4), s: o.s === 'attention' ? 'attention' : 'halo' }] : [];
        });
        return { id, type, fichierId: texte(x.fichierId, 40, n), legende: texte(x.legende, 300, n, false), ...(reperes.length ? { reperes } : {}) };
      }
      case 'fichier': {
        const url = texte(x.url, 500, n, false);
        if (url && !/^https?:\/\//.test(url)) throw new BadRequestException(`${n} : lien en https:// attendu`);
        if (!url && !x.fichierId) throw new BadRequestException(`${n} : fichier ou lien manquant`);
        return { id, type, nom: texte(x.nom, 200, n), ...(url ? { url } : { fichierId: texte(x.fichierId, 40, n) }) };
      }
      case 'simulateur':
        return { id, type, simulateurId: texte(x.simulateurId, 40, n) };
      case 'html':
        return { id, type, html: texte(x.html, 500_000, n), ...(nombre(x.hauteur) ? { hauteur: nombre(x.hauteur) } : {}) };
    }
  }) as Bloc[];
}
