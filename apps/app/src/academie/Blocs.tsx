import { Fragment, ReactNode, useEffect, useRef, useState } from 'react';
import { ImageApi } from '../espaces/kiavik/donneesProcedures';
import { api } from '../lib/api';
import { t } from '../lib/i18n';
import { Bloc, duree, idVimeo, Repere } from './donnees';

/**
 * Affichage des blocs d'une leçon (côté client et aperçu admin).
 * `pleinePage` : page de l'Académie faite d'un seul simulateur (ou HTML) : il occupe tout l'écran restant.
 */
export function Blocs({ blocs, pleinePage }: { blocs: Bloc[]; pleinePage?: boolean }) {
  const seul = pleinePage && blocs.length === 1 ? blocs[0] : null;
  if (seul?.type === 'simulateur') return <Simulateur id={seul.simulateurId!} nom={seul.nom ?? undefined} mode="plein" />;
  if (seul?.type === 'html') return <IframeIsolee html={seul.html ?? ''} mode="plein" />;
  return (
    <div className="ac-blocs">
      {blocs.map((b) => (
        <Fragment key={b.id}>
          <BlocVue b={b} />
        </Fragment>
      ))}
    </div>
  );
}

function BlocVue({ b }: { b: Bloc }) {
  switch (b.type) {
    case 'titre':
      return <h2 className="ac-titre">{b.texte}</h2>;
    case 'texte':
      return <Texte texte={b.texte ?? ''} />;
    case 'encadre':
      return <div className={b.niveau === 'avertissement' ? 'gx-warn' : 'gx-tip'}>{b.niveau === 'avertissement' ? '⚠️' : '💡'} <Texte texte={b.texte ?? ''} enLigne /></div>;
    case 'vimeo':
      return <Vimeo b={b} />;
    case 'image':
      return (
        <figure className="ac-image">
          {b.chemin && (
            <span className="ac-photo">
              <ImageApi chemin={b.chemin} />
              <Reperes liste={b.reperes} />
            </span>
          )}
          {b.legende && <figcaption>{b.legende}</figcaption>}
        </figure>
      );
    case 'fichier':
      return <Fichier b={b} />;
    case 'simulateur':
      return <Simulateur id={b.simulateurId!} nom={b.nom ?? undefined} />;
    case 'html':
      return <IframeIsolee html={b.html ?? ''} hauteur={b.hauteur} />;
    case 'note': // visible seulement de l'admin (l'API ne l'envoie pas aux clients)
      return <div className="ac-note">📝 {b.texte}</div>;
    default:
      return null;
  }
}

/** Repères animés posés sur une photo : ⭕ halo qui pulse, ⚠️ pictogramme qui bat. */
export function Reperes({ liste = [], onToucher }: { liste?: Repere[]; onToucher?: (i: number) => void }) {
  return (
    <>
      {liste.map((r, i) => (
        <span key={i} className={`ac-repere ${r.s}`} style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }}
          onClick={onToucher ? (e) => ((e.stopPropagation(), onToucher(i))) : undefined}>
          {r.s === 'attention' ? '⚠️' : ''}
        </span>
      ))}
    </>
  );
}

/** Admin : toucher la photo pose un repère (style choisi), toucher un repère le retire. */
export function PlacerReperes({ b, onChange }: { b: Bloc; onChange: (b: Bloc) => void }) {
  const [style, setStyle] = useState<Repere['s']>('halo');
  if (!b.chemin) return null;
  const liste = b.reperes ?? [];
  const poser = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (liste.length >= 10) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onChange({ ...b, reperes: [...liste, { x: +x.toFixed(4), y: +y.toFixed(4), s: style }] });
  };
  return (
    <div className="ac-placer">
      <div className="seg">
        <button type="button" className={style === 'halo' ? 'on' : ''} onClick={() => setStyle('halo')}>⭕ Halo</button>
        <button type="button" className={style === 'attention' ? 'on' : ''} onClick={() => setStyle('attention')}>⚠️ Attention</button>
      </div>
      <small className="muted">Touchez la photo pour poser un repère animé ; touchez un repère pour le retirer ({liste.length}/10).</small>
      <span className="ac-photo" onClick={poser}>
        <ImageApi chemin={b.chemin} />
        <Reperes liste={liste} onToucher={(i) => onChange({ ...b, reperes: liste.filter((_, j) => j !== i) })} />
      </span>
    </div>
  );
}

/**
 * Texte simple, sans HTML : paragraphes (ligne vide), listes (« - »), **gras**, *italique*, liens [texte](https://…)
 * et adresses https:// cliquables.
 */
export function Texte({ texte, enLigne }: { texte: string; enLigne?: boolean }) {
  const enrichir = (s: string): ReactNode[] => {
    const morceaux: ReactNode[] = [];
    const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
    let i = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (m.index > i) morceaux.push(s.slice(i, m.index));
      const k = `${m.index}`;
      if (m[1]) morceaux.push(<b key={k}>{m[1]}</b>);
      else if (m[2]) morceaux.push(<i key={k}>{m[2]}</i>);
      else if (m[3]) morceaux.push(<a key={k} href={m[4]} target="_blank" rel="noreferrer">{m[3]}</a>);
      else morceaux.push(<a key={k} href={m[5]} target="_blank" rel="noreferrer">{m[5]}</a>);
      i = m.index + m[0].length;
    }
    if (i < s.length) morceaux.push(s.slice(i));
    return morceaux;
  };
  if (enLigne) return <span>{enrichir(texte)}</span>;
  return (
    <div className="ac-texte">
      {texte.split(/\n\s*\n/).map((p, n) => {
        const lignes = p.split('\n');
        if (lignes.every((l) => /^\s*[-•]\s+/.test(l)))
          return <ul key={n}>{lignes.map((l, j) => <li key={j}>{enrichir(l.replace(/^\s*[-•]\s+/, ''))}</li>)}</ul>;
        return <p key={n}>{lignes.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{enrichir(l)}</Fragment>)}</p>;
      })}
    </div>
  );
}

/** Vidéo Vimeo : seulement la vignette ; le lecteur se charge au toucher (rien de téléchargé avant). */
function Vimeo({ b }: { b: Bloc }) {
  const [lecture, setLecture] = useState(false);
  const v = idVimeo(b.url ?? '');
  if (!v) return null;
  const src = `https://player.vimeo.com/video/${v.id}?${v.h ? `h=${v.h}&` : ''}autoplay=1&dnt=1`;
  return (
    <div className="ac-video">
      {lecture ? (
        <iframe src={src} title={b.titre ?? 'Vidéo'} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      ) : (
        <button type="button" className="ac-video-vignette" onClick={() => setLecture(true)} aria-label={t('academie.lire', { titre: b.titre ?? '' })}>
          {b.vignette ? <img src={b.vignette} alt="" loading="lazy" /> : <span className="ac-video-vide" />}
          <span className="ac-play">▶</span>
          {(b.titre || b.duree) && <span className="ac-video-titre">{b.titre}{b.duree ? ` · ${duree(b.duree)}` : ''}</span>}
        </button>
      )}
    </div>
  );
}

function Fichier({ b }: { b: Bloc }) {
  const ouvrir = async () => {
    if (b.url) return window.open(b.url, '_blank', 'noopener');
    const blob = await api<Blob>(b.chemin!);
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  };
  return (
    <button type="button" className="carte ac-fichier" onClick={ouvrir}>
      📎 <b>{b.nom}</b> <span className="muted petit">{b.url ? t('academie.lien') : t('academie.ouvrir')}</span>
    </button>
  );
}

function Simulateur({ id, nom, mode = 'ecran' }: { id: string; nom?: string; mode?: ModeCadre }) {
  const [html, setHtml] = useState<string>();
  const [err, setErr] = useState(false);
  useEffect(() => {
    api<{ html: string }>(`/academie/simulateurs/${id}`).then((r) => setHtml(r.html)).catch(() => setErr(true));
  }, [id]);
  if (err) return <p className="muted petit">{t('academie.simulateurIndisponible')}</p>;
  return html === undefined ? <div className="ac-charge" /> : <IframeIsolee html={html} titre={mode === 'plein' ? undefined : nom ?? t('academie.simulateur')} pleinEcranDirect={mode !== 'plein'} mode={mode} />;
}

/** Script ajouté au HTML : il envoie sa hauteur à l'app pour que la boîte s'ajuste. */
const SCRIPT_HAUTEUR = `<script>(function(){function h(){parent.postMessage({academieHauteur:Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0)},'*')}addEventListener('load',h);new ResizeObserver(h).observe(document.documentElement);setTimeout(h,300)})()</script>`;

/**
 * Hauteur de la boîte :
 * - auto : suit le contenu (petit HTML), sans dépasser 85 % de l'écran ;
 * - ecran : simulateur dans une leçon : hauteur d'écran fixe, il défile dedans (ses panneaux « en bas de l'écran » restent visibles) ;
 * - plein : page faite du seul simulateur : tout l'écran restant, comme s'il était ouvert seul.
 */
type ModeCadre = 'auto' | 'ecran' | 'plein';

/**
 * HTML libre ou simulateur, dans une boîte isolée : iframe `sandbox` sans `allow-same-origin` (origine opaque) :
 * le code tourne (animations, boutons, calculs) mais ne peut ni lire le compte du client ni toucher à l'app.
 * ⤢ plein écran.
 */
export function IframeIsolee({ html, hauteur, titre, pleinEcranDirect, mode = 'auto' }: { html: string; hauteur?: number; titre?: string; pleinEcranDirect?: boolean; mode?: ModeCadre }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const boite = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(hauteur ?? 200);
  const [plein, setPlein] = useState(false);
  const auto = mode === 'auto' && !hauteur;
  useEffect(() => {
    if (!auto) return;
    const f = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const v = Number((e.data as { academieHauteur?: number })?.academieHauteur);
      if (Number.isFinite(v) && v > 0) setH(Math.min(Math.max(v, 80), Math.round(innerHeight * 0.85)));
    };
    addEventListener('message', f);
    return () => removeEventListener('message', f);
  }, [auto]);
  // plein : de la boîte jusqu'au bas de l'écran (au-dessus de la barre d'onglets)
  useEffect(() => {
    if (mode !== 'plein') return;
    const calc = () => {
      const haut = boite.current?.getBoundingClientRect().top ?? 0;
      const barre = (document.querySelector('.onglets') as HTMLElement | null)?.offsetHeight ?? 0;
      setH(Math.max(300, innerHeight - haut - barre - 8));
      // puis on retire ce qui dépasse encore (marges de la page) : une seule barre de défilement, celle du simulateur
      requestAnimationFrame(() => {
        const trop = document.documentElement.scrollHeight - innerHeight;
        if (trop > 0) setH((x) => Math.max(300, x - trop));
      });
    };
    calc();
    addEventListener('resize', calc);
    return () => removeEventListener('resize', calc);
  }, [mode]);
  const doc = auto ? `${html}${SCRIPT_HAUTEUR}` : html;
  const hauteurCadre = mode === 'ecran' && !hauteur ? 'min(85dvh, 900px)' : h;
  const cadre = (style: React.CSSProperties) => (
    <iframe ref={ref} srcDoc={doc} sandbox="allow-scripts allow-forms allow-popups allow-modals" title={titre ?? 'Contenu'} style={style} />
  );
  return (
    <div ref={boite} className={'ac-html' + (mode === 'plein' ? ' ac-html-plein' : '')}>
      {(titre || pleinEcranDirect) && (
        <div className="ac-html-barre">
          <b>🖥 {titre}</b>
          <button type="button" className="btn petit" onClick={() => setPlein(true)}>⤢ {t('academie.pleinEcran')}</button>
        </div>
      )}
      {!plein && cadre({ height: hauteurCadre })}
      {!titre && !pleinEcranDirect && mode !== 'plein' && (
        <button type="button" className="btn-lien petit" onClick={() => setPlein(true)}>⤢ {t('academie.pleinEcran')}</button>
      )}
      {plein && (
        <div className="ac-plein">
          <button type="button" className="gx-fermer" aria-label={t('commun.fermer')} onClick={() => setPlein(false)}>✕</button>
          {cadre({ width: '100%', height: '100%' })}
        </div>
      )}
    </div>
  );
}
