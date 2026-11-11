import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../../lib/i18n';
import { Fenetre } from './Fenetres';
import { lienGuide } from './donneesProcedures';
import { pastillesNavigation, useGuide } from './guides';
import './parcours.css';

/**
 * Capture d'un écran du guide avec le bouton à toucher entouré (cercle qui clignote), sans quitter la page.
 * Zoom : la capture est agrandie et centrée sur le bouton. Sert à « Voir le bouton » et au parcours guidé.
 */
export function CaptureBouton({ guide: slug, ecran: idEcran, pastille, explication = true, zoomDepart = false }: {
  guide: string; ecran: string; pastille: string | null; explication?: boolean; zoomDepart?: boolean;
}) {
  const { guide } = useGuide(slug);
  const [zoom, setZoom] = useState(zoomDepart);
  const defile = useRef<HTMLDivElement>(null);
  const e = guide?.ecrans.find((x) => x.id === idEcran);
  const p = e?.pastilles.find((x) => x.id === pastille) ?? (guide && e ? pastillesNavigation(guide, e).find((n) => n.info?.id === pastille)?.info : undefined);

  // zoom : on fait défiler pour amener le bouton au centre
  useLayoutEffect(() => {
    const d = defile.current;
    if (!d || !e || !p) return;
    const centrer = () => {
      d.scrollLeft = (p.x / e.largeur) * d.scrollWidth - d.clientWidth / 2;
      d.scrollTop = (p.y / e.hauteur) * d.scrollHeight - d.clientHeight / 2;
    };
    centrer();
    const img = d.querySelector('img');
    img?.addEventListener('load', centrer);
    return () => img?.removeEventListener('load', centrer);
  }, [zoom, e, p]);

  if (!guide) return <div className="cb-cadre cb-vide" />;
  if (!e) return null;
  const lien = lienGuide({ guide: slug, ecran: idEcran, pastille });
  return (
    <div className="cb">
      <div className="cb-boite">
      <div ref={defile} className={`cb-cadre ${zoom ? 'zoom' : ''}`} style={{ aspectRatio: `${e.largeur} / ${e.hauteur}` }}>
        <div className="cb-image" style={{ aspectRatio: `${e.largeur} / ${e.hauteur}` }}>
          {e.type === 'capture' && e.image ? (
            <img src={e.image} alt="" draggable={false} />
          ) : (
            <div className="cb-fenetre"><Fenetre fenetre={e.fenetre ?? ''} largeur={e.largeur} hauteur={e.hauteur} onFermer={() => {}} /></div>
          )}
          {p && <span className="cb-anneau" style={{ left: `${(p.x / e.largeur) * 100}%`, top: `${(p.y / e.hauteur) * 100}%` }} />}
        </div>
      </div>
        <button type="button" className="cb-zoom" aria-label={t('kiavik.guide.zoom')} onClick={() => setZoom(!zoom)}>{zoom ? '⤡' : '⤢'}</button>
      </div>
      <div className="cb-legende">
        <span className="gx-ref">{guide.nom.split(' ')[0]} · {e.code}{pastille ? ` · ${pastille}` : ''}</span>
        {p && explication && (
          <>
            <b>{p.titre}</b>
            <span className="muted petit">{p.texte}</span>
          </>
        )}
        {lien && <Link to={lien} className="lien petit">{t('kiavik.parcours.ouvrirGuide')}</Link>}
      </div>
    </div>
  );
}
