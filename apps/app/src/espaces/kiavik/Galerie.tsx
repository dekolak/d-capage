import { useEffect, useRef, useState } from 'react';
import { t } from '../../lib/i18n';
import { ImageApi } from './donneesProcedures';
import './parcours.css';

export interface PhotoEtape { id: string; url: string }

/**
 * Photos d'une étape : une seule = l'image ; plusieurs = défilement au doigt (aimanté) avec un compteur.
 * Toucher une photo l'ouvre en plein écran (flèches, glisser, Échap).
 * Les gestes restent dans la galerie (ils ne changent pas d'étape dans le parcours guidé).
 */
export function Galerie({ photos, className = 'gx-etape-photo' }: { photos: PhotoEtape[]; className?: string }) {
  const [plein, setPlein] = useState<number | null>(null);
  const [ici, setIci] = useState(0);
  const bande = useRef<HTMLDivElement>(null);
  if (!photos.length) return null;
  const surDefilement = () => {
    const b = bande.current;
    if (b) setIci(Math.round(b.scrollLeft / Math.max(1, b.clientWidth)));
  };
  return (
    <>
      {photos.length === 1 ? (
        <ImageApi chemin={photos[0].url} className={className} onClick={() => setPlein(0)} />
      ) : (
        <div className="ga" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
          <div className="ga-bande" ref={bande} onScroll={surDefilement}>
            {photos.map((ph, k) => (
              <ImageApi key={ph.id} chemin={ph.url} className={`${className} ga-photo`} onClick={() => setPlein(k)} />
            ))}
          </div>
          <span className="ga-compteur">{t('kiavik.photos.compteur', { i: ici + 1, n: photos.length })}</span>
        </div>
      )}
      {plein !== null && <PleinEcran photos={photos} depart={plein} onFermer={() => setPlein(null)} />}
    </>
  );
}

function PleinEcran({ photos, depart, onFermer }: { photos: PhotoEtape[]; depart: number; onFermer(): void }) {
  const [i, setI] = useState(depart);
  const debut = useRef<number | null>(null);
  const n = photos.length;
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
      if (e.key === 'ArrowRight') setI((x) => Math.min(n - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [n, onFermer]);
  return (
    <div
      className="gx-plein ga-plein"
      onClick={onFermer}
      onTouchStart={(e) => { e.stopPropagation(); debut.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        const d = debut.current === null ? 0 : e.changedTouches[0].clientX - debut.current;
        debut.current = null;
        if (Math.abs(d) > 60) setI((x) => (d < 0 ? Math.min(n - 1, x + 1) : Math.max(0, x - 1)));
      }}
    >
      <ImageApi chemin={photos[i].url} />
      {n > 1 && (
        <>
          <button type="button" className="ga-fleche g" aria-label={t('kiavik.photos.precedente')} disabled={i === 0} onClick={(e) => { e.stopPropagation(); setI(i - 1); }}>‹</button>
          <button type="button" className="ga-fleche d" aria-label={t('kiavik.photos.suivante')} disabled={i === n - 1} onClick={(e) => { e.stopPropagation(); setI(i + 1); }}>›</button>
          <span className="ga-compteur plein">{t('kiavik.photos.compteur', { i: i + 1, n })}</span>
        </>
      )}
    </div>
  );
}
