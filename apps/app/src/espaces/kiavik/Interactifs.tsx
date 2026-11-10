import { CSSProperties, PointerEvent as PE, useEffect, useRef, useState } from 'react';
import { Ecran, Guide, InteractifCanaux, InteractifEchantillon, modeBlancChoisi, Rect } from './guides';
import { t } from '../../lib/i18n';

/**
 * Écrans interactifs (repris du prototype) :
 *  - T5 : on tire une poignée d'angle pour faire un échantillon à taille réelle (taille affichée en cm) ;
 *  - T9 : on coche « Aperçu canaux de sortie » puis on touche un canal pour voir ce qu'il dépose.
 * Les zones et coordonnées viennent du JSON du guide (`interactif` de l'écran).
 */
/** État de l'aperçu des canaux (T9), partagé entre la capture et les boutons sous la capture. */
export interface EtatCanaux { actif: boolean; canal: string | null }
export const CANAUX_DEPART: EtatCanaux = { actif: false, canal: null };

interface Props { guide: Guide; e: Ecran; remise: number; canaux: EtatCanaux; setCanaux(c: EtatCanaux): void }

export function Interactif({ guide, e, remise, canaux, setCanaux }: Props) {
  if (e.interactif?.type === 'echantillon') return <Echantillon e={e} cfg={e.interactif} remise={remise} />;
  if (e.interactif?.type === 'canaux') return <Canaux guide={guide} e={e} cfg={e.interactif} etat={canaux} setEtat={setCanaux} />;
  return null;
}

/** Gros boutons sous la capture (les cases de la capture sont petites sur un téléphone). */
export function CommandesInteractif({ e, canaux, setCanaux }: Props) {
  if (e.interactif?.type !== 'canaux') return null;
  const { actif, canal } = canaux;
  return (
    <div className="ix-commandes">
      <button type="button" className={`btn petit ${actif ? 'prim' : ''}`} onClick={() => setCanaux({ actif: !actif, canal: canal ?? 'w' })}>
        {actif ? '✓ ' : ''}{t('kiavik.interactif.apercuCanaux')}
      </button>
      {e.interactif.lignes.filter((l) => l.canal).map((l) => (
        <button type="button" key={l.nom} className={`btn petit ${actif && canal === l.canal ? 'prim' : ''}`} onClick={() => setCanaux({ actif: true, canal: l.canal! })}>
          {l.nom}
        </button>
      ))}
    </div>
  );
}

const boite = (e: Ecran, r: Rect): CSSProperties => ({
  left: `${(r.x / e.largeur) * 100}%`, top: `${(r.y / e.hauteur) * 100}%`,
  width: `${(r.largeur / e.largeur) * 100}%`, height: `${(r.hauteur / e.hauteur) * 100}%`,
});
const cm = (v: number) => v.toFixed(1).replace('.', ',');
const P = (v: number) => `${v * 100}%`;

type Sel = { x0: number; y0: number; x1: number; y1: number };
const ENTIERE: Sel = { x0: 0, y0: 0, x1: 1, y1: 1 };
const ECART_MIN = 0.08;

function Echantillon({ e, cfg, remise }: { e: Ecran; cfg: InteractifEchantillon; remise: number }) {
  const [s, setS] = useState<Sel>(ENTIERE);
  const [alerte, setAlerte] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setS(ENTIERE); // pastille Remise (5.7)
  }, [remise]);

  const tirer = (coin: 'nw' | 'ne' | 'sw' | 'se') => (ev: PE<HTMLDivElement>) => {
    ev.preventDefault();
    ev.stopPropagation();
    const el = ev.currentTarget;
    el.setPointerCapture(ev.pointerId);
    const r = zone.current!.getBoundingClientRect();
    el.onpointermove = (m) => {
      const fx = Math.min(1, Math.max(0, (m.clientX - r.left) / r.width));
      const fy = Math.min(1, Math.max(0, (m.clientY - r.top) / r.height));
      setS((p) => ({
        x0: coin[1] === 'w' ? Math.min(fx, p.x1 - ECART_MIN) : p.x0,
        x1: coin[1] === 'e' ? Math.max(fx, p.x0 + ECART_MIN) : p.x1,
        y0: coin[0] === 'n' ? Math.min(fy, p.y1 - ECART_MIN) : p.y0,
        y1: coin[0] === 's' ? Math.max(fy, p.y0 + ECART_MIN) : p.y1,
      }));
    };
    el.onpointerup = el.onpointercancel = () => {
      el.onpointermove = null;
    };
  };
  const milieu = (ev: PE) => {
    ev.preventDefault();
    ev.stopPropagation();
    setAlerte(true);
    setTimeout(() => setAlerte(false), 1200);
  };

  const entiere = s.x1 - s.x0 > 0.999 && s.y1 - s.y0 > 0.999;
  const [L, H] = cfg.taille_cm;
  const coins = { nw: [s.x0, s.y0], ne: [s.x1, s.y0], sw: [s.x0, s.y1], se: [s.x1, s.y1] } as const;
  const milieux = [[(s.x0 + s.x1) / 2, s.y0], [(s.x0 + s.x1) / 2, s.y1], [s.x1, (s.y0 + s.y1) / 2], [s.x0, (s.y0 + s.y1) / 2]];
  return (
    <>
      <div ref={zone} className="ix-zone" style={boite(e, cfg.zone)}>
        <div className="ix-sel" style={{ left: P(s.x0), top: P(s.y0), width: P(s.x1 - s.x0), height: P(s.y1 - s.y0) }}>
          <div className={`ix-lab ${alerte ? 'ko' : ''}`}>
            {alerte ? (
              t('kiavik.interactif.anglesSeulement')
            ) : entiere ? (
              <>{t('kiavik.interactif.imageEntiere', { l: cm(L), h: cm(H) })}<br /><small>{t('kiavik.interactif.tirerAngle')}</small></>
            ) : (
              <>{t('kiavik.interactif.echantillon')}<br /><b>{t('kiavik.interactif.taille', { l: cm((s.x1 - s.x0) * L), h: cm((s.y1 - s.y0) * H) })}</b></>
            )}
          </div>
        </div>
      </div>
      <div className="ix-poignees" style={boite(e, cfg.zone)}>
        {Object.entries(coins).map(([k, [x, y]]) => (
          <div key={k} className={`ix-coin ${k}`} style={{ left: P(x), top: P(y) }} onPointerDown={tirer(k as keyof typeof coins)} aria-label={t('kiavik.interactif.poignee')} />
        ))}
        {milieux.map(([x, y], i) => (
          <div key={i} className="ix-milieu" style={{ left: P(x), top: P(y) }} onPointerDown={milieu} title={t('kiavik.interactif.angles')} />
        ))}
      </div>
    </>
  );
}

function Canaux({ guide, e, cfg, etat, setEtat }: { guide: Guide; e: Ecran; cfg: InteractifCanaux; etat: EtatCanaux; setEtat(c: EtatCanaux): void }) {
  const { actif, canal } = etat;
  const modes = guide.modesBlanc?.modes ?? [];
  const blanc = modes.find((m) => m.nom === modeBlancChoisi("Couleur d'accompagnement")) ?? modes[0];
  const image = canal === 'w' ? blanc?.image_canal.replace('/pw_', '/w_') : canal ? cfg.images[canal] : undefined;
  const legende = canal === 'w' ? t('kiavik.interactif.blanc', { mode: blanc?.nom ?? '' }) : cfg.lignes.find((l) => l.canal === canal)?.nom;
  const ligne = (y: number): Rect => ({ x: cfg.ligne.x, y: y - cfg.ligne.hauteur / 2, largeur: cfg.ligne.largeur, hauteur: cfg.ligne.hauteur });
  return (
    <>
      <button
        type="button"
        className="ix-case"
        style={boite(e, cfg.case)}
        aria-pressed={actif}
        aria-label={t('kiavik.interactif.apercuCanauxSortie')}
        onClick={() => setEtat({ actif: !actif, canal: canal ?? 'w' })}
      >
        <i>{actif ? '✓' : ''}</i>
      </button>
      {cfg.lignes.map((l) => (
        <button
          type="button"
          key={l.nom}
          className={`ix-ligne ${l.canal ? '' : 'off'} ${actif && canal === l.canal ? 'on' : ''}`}
          style={boite(e, ligne(l.y))}
          disabled={!l.canal}
          aria-label={l.nom}
          onClick={() => setEtat({ actif: true, canal: l.canal! })}
        >
          <i>{actif && canal === l.canal ? '✓' : ''}</i>
        </button>
      ))}
      {actif && image && (
        <div className="ix-apercu" style={boite(e, cfg.apercu)}>
          <img src={image} alt="" />
          <span>{canal === 'w' ? legende : t('kiavik.interactif.canal', { nom: legende ?? '' })}</span>
        </div>
      )}
      {!actif && (
        <div className="ix-indice" style={boite(e, { x: cfg.ligne.x, y: cfg.lignes[cfg.lignes.length - 1].y + 15, largeur: cfg.ligne.largeur, hauteur: 30 })}>
          {t('kiavik.interactif.cocherCase')}
        </div>
      )}
    </>
  );
}
