import { ImageApi } from '../espaces/kiavik/donneesProcedures';
import './reperes.css';

/**
 * Repères animés posés sur une photo (pas-à-pas, Académie) : ⭕ halo qui pulse, ⚠️ qui bat.
 * Position relative (0–1) : dessinés par-dessus l'image (jamais collés dedans, pour rester animés).
 */
export interface Repere { x: number; y: number; s: 'halo' | 'attention' }

/** Calque des repères : à placer dans un conteneur `position: relative` qui a exactement la taille de l'image. */
export function Reperes({ liste = [] }: { liste?: Repere[] | null }) {
  return (
    <>
      {(liste ?? []).map((r, i) => (
        <span key={i} className={`repere ${r.s}`} style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }}>
          {r.s === 'attention' ? '⚠️' : ''}
        </span>
      ))}
    </>
  );
}

/**
 * Photo avec ses repères. Sans repère : l'image habituelle (mêmes classes, même recadrage).
 * Avec : l'image entière (pas de recadrage, sinon les repères tomberaient à côté), hauteur limitée par `hauteurMax`.
 */
export function ImageReperes({ chemin, reperes, className, hauteurMax, onClick }: {
  chemin: string; reperes?: Repere[] | null; className?: string; hauteurMax?: string; onClick?: () => void;
}) {
  if (!reperes?.length) return <ImageApi chemin={chemin} className={className} onClick={onClick} />;
  return (
    <span className={`photo-reperes ${className ?? ''}`} onClick={onClick}>
      <span className="photo-reperes-cadre" style={hauteurMax ? ({ '--h-max': hauteurMax } as React.CSSProperties) : undefined}>
        <ImageApi chemin={chemin} />
        <Reperes liste={reperes} />
      </span>
    </span>
  );
}
