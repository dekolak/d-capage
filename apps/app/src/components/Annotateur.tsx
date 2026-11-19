import { useEffect, useRef, useState } from 'react';
import { Erreur } from './Composants';
import { Repere, Reperes } from './Reperes';
import './annotateur.css';

/*
 * Annoter une photo — un seul outil pour les pas-à-pas et l'Académie (PC ou téléphone) :
 * - formes fixes : flèche, rond, rectangle, zone grisée, pictos (⚠️ 🎯 ➡️…) ou n'importe quel emoji / texte ;
 *   à l'enregistrement, l'app fabrique l'image annotée (affichée partout) ; l'original et le calque sont gardés par l'API ;
 * - repères animés : ⭕ halo qui pulse, ⚠️ qui bat ; gardés à part et dessinés par-dessus l'image (ils restent animés).
 * Tout est en coordonnées relatives (0–1) : le calque se rouvre et se modifie.
 */

type Outil = 'fleche' | 'rond' | 'rect' | 'zone' | 'picto' | 'halo' | 'attention' | 'gomme';
export interface Forme {
  t: Exclude<Outil, 'gomme' | 'halo' | 'attention'>;
  x1: number; y1: number; x2: number; y2: number;
  /** Couleur, épaisseur relative à la largeur de l'image, picto ou texte. */
  c: string; e: number; s?: string;
}
const COULEURS = ['#e11d48', '#facc15', '#ffffff', '#111111', '#2563eb'];
const EPAISSEURS = [{ n: 'Fin', v: 0.004 }, { n: 'Moyen', v: 0.008 }, { n: 'Gros', v: 0.014 }];
const PICTOS = ['⚠️', '🎯', '➡️', '⬅️', '⬆️', '⬇️', '✅', '❌', '🔧', '①', '②', '③', '④', '⑤'];
const OUTILS: { o: Outil; l: string }[] = [
  { o: 'fleche', l: '➡ Flèche' }, { o: 'rond', l: '⭕ Rond' }, { o: 'rect', l: '▭ Rectangle' },
  { o: 'zone', l: '▩ Zone grisée' }, { o: 'picto', l: '😀 Picto / texte' },
  { o: 'halo', l: '⭕ Halo animé' }, { o: 'attention', l: '⚠️ Attention animée' }, { o: 'gomme', l: '🧽 Gomme' },
];

/** D'où vient la photo et où enregistrer : chaque endroit (pas-à-pas, Académie) fournit le sien. */
export interface SourceAnnotation {
  /** Photo d'origine (sans calque). */
  original(): Promise<Blob>;
  formes?: Forme[] | null;
  reperes?: Repere[] | null;
  /** Un calque est déjà collé dans l'image (bouton « Revenir à la photo d'origine »). */
  annotee?: boolean;
  /** image = photo annotée (null s'il n'y a plus de forme fixe : revenir à l'original). true = enregistré. */
  enregistrer(r: { image: Blob | null; formes: Forme[]; reperes: Repere[] }): Promise<boolean>;
}

/** Dessine les formes sur un contexte de la taille de l'image (w × h). */
function dessiner(g: CanvasRenderingContext2D, formes: Forme[], w: number, h: number) {
  for (const f of formes) {
    const [x1, y1, x2, y2] = [f.x1 * w, f.y1 * h, f.x2 * w, f.y2 * h];
    const ep = Math.max(2, f.e * w);
    g.save();
    g.strokeStyle = f.c;
    g.fillStyle = f.c;
    g.lineWidth = ep;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // contour sombre léger : lisible sur une photo claire comme foncée
    g.shadowColor = 'rgba(0,0,0,.45)';
    g.shadowBlur = ep;
    if (f.t === 'fleche') {
      const a = Math.atan2(y2 - y1, x2 - x1);
      const pointe = Math.max(ep * 4, 14);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2 - Math.cos(a) * pointe * 0.6, y2 - Math.sin(a) * pointe * 0.6);
      g.stroke();
      g.beginPath();
      g.moveTo(x2, y2);
      g.lineTo(x2 - pointe * Math.cos(a - 0.45), y2 - pointe * Math.sin(a - 0.45));
      g.lineTo(x2 - pointe * Math.cos(a + 0.45), y2 - pointe * Math.sin(a + 0.45));
      g.closePath();
      g.fill();
    } else if (f.t === 'rond') {
      g.beginPath();
      g.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      g.stroke();
    } else if (f.t === 'rect') {
      g.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (f.t === 'zone') {
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(40,40,40,.6)';
      g.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (f.t === 'picto' && f.s) {
      const taille = Math.max(16, f.e * w * 8);
      g.font = `bold ${taille}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = Math.max(2, taille / 10);
      g.strokeStyle = f.c === '#111111' ? '#ffffff' : '#111111';
      g.strokeText(f.s, x1, y1);
      g.fillText(f.s, x1, y1);
    }
    g.restore();
  }
}

/** Forme sous le point (gomme) : la plus récente dont la boîte (un peu élargie) contient le point. */
function sous(formes: Forme[], x: number, y: number): number {
  for (let i = formes.length - 1; i >= 0; i--) {
    const f = formes[i];
    const m = f.t === 'picto' ? 0.05 : 0.02;
    const [a, b] = f.t === 'picto' ? [f.x1 - m, f.x1 + m] : [Math.min(f.x1, f.x2) - m, Math.max(f.x1, f.x2) + m];
    const [c, d] = f.t === 'picto' ? [f.y1 - m, f.y1 + m] : [Math.min(f.y1, f.y2) - m, Math.max(f.y1, f.y2) + m];
    if (x >= a && x <= b && y >= c && y <= d) return i;
  }
  return -1;
}

/** Fenêtre d'annotation ; elle se ferme quand l'enregistrement a réussi. */
export function Annotateur({ source, onFermer }: { source: SourceAnnotation; onFermer: () => void }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement>();
  const [formes, setFormes] = useState<Forme[]>(source.formes ?? []);
  const [reperes, setReperes] = useState<Repere[]>(source.reperes ?? []);
  const [encours, setEncours] = useState<Forme | null>(null);
  const [outil, setOutil] = useState<Outil>('fleche');
  const [couleur, setCouleur] = useState(COULEURS[0]);
  const [epaisseur, setEpaisseur] = useState(EPAISSEURS[1].v);
  const [picto, setPicto] = useState('⚠️');
  const [libre, setLibre] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState<unknown>();

  // la photo d'origine (sans calque), pour dessiner dessus
  useEffect(() => {
    let url = '';
    source.original()
      .then((b) => {
        url = URL.createObjectURL(b);
        const i = new Image();
        i.onload = () => setImg(i);
        i.src = url;
      })
      .catch(setErr);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = toile.current;
    if (!c || !img) return;
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    dessiner(g, encours ? [...formes, encours] : formes, c.width, c.height);
  }, [img, formes, encours]);

  const point = (e: React.PointerEvent) => {
    const r = toile.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const bas = (e: React.PointerEvent) => {
    const p = point(e);
    if (outil === 'gomme') {
      // un repère animé proche d'abord, sinon la forme sous le doigt
      const r = reperes.findIndex((x) => Math.abs(x.x - p.x) < 0.04 && Math.abs(x.y - p.y) < 0.05);
      if (r >= 0) return setReperes(reperes.filter((_, k) => k !== r));
      const i = sous(formes, p.x, p.y);
      if (i >= 0) setFormes(formes.filter((_, k) => k !== i));
      return;
    }
    if (outil === 'halo' || outil === 'attention') {
      if (reperes.length < 10) setReperes([...reperes, { x: +p.x.toFixed(4), y: +p.y.toFixed(4), s: outil }]);
      return;
    }
    if (outil === 'picto') {
      const s = libre.trim() || picto;
      setFormes([...formes, { t: 'picto', x1: p.x, y1: p.y, x2: p.x, y2: p.y, c: couleur, e: epaisseur, s }]);
      return;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
    setEncours({ t: outil, x1: p.x, y1: p.y, x2: p.x, y2: p.y, c: couleur, e: epaisseur });
  };
  const bouge = (e: React.PointerEvent) => {
    if (!encours) return;
    const p = point(e);
    setEncours({ ...encours, x2: p.x, y2: p.y });
  };
  const haut = () => {
    if (!encours) return;
    // un clic sans glisser ne crée rien
    if (Math.abs(encours.x2 - encours.x1) + Math.abs(encours.y2 - encours.y1) > 0.01) setFormes([...formes, encours]);
    setEncours(null);
  };

  const enregistrer = async () => {
    const c = toile.current;
    if (!c) return;
    setEnvoi(true);
    setErr(undefined);
    try {
      // formes fixes : collées dans l'image ; plus aucune : retour à la photo d'origine (image null)
      const image = formes.length
        ? await new Promise<Blob>((ok, ko) => c.toBlob((x) => (x ? ok(x) : ko(new Error('Image impossible à fabriquer'))), 'image/jpeg', 0.9))
        : null;
      if (await source.enregistrer({ image, formes, reperes })) onFermer();
      else setEnvoi(false);
    } catch (x) {
      setErr(x);
      setEnvoi(false);
    }
  };
  const original = async () => {
    if (!confirm('Supprimer le calque (formes et repères) et revenir à la photo d\'origine ?')) return;
    setEnvoi(true);
    if (await source.enregistrer({ image: null, formes: [], reperes: [] }).catch((x) => ((setErr(x), false)))) onFermer();
    else setEnvoi(false);
  };

  return (
    <div className="an-fond" role="dialog" aria-modal="true">
      <div className="an">
        <div className="an-barre">
          <span className="an-groupe">
            {OUTILS.map((x) => <button key={x.o} type="button" className={outil === x.o ? 'on' : ''} onClick={() => setOutil(x.o)}>{x.l}</button>)}
          </span>
          <span className="an-groupe">
            {COULEURS.map((c) => <button key={c} type="button" className={`an-couleur ${couleur === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Couleur ${c}`} onClick={() => setCouleur(c)} />)}
          </span>
          <span className="an-groupe">
            {EPAISSEURS.map((x) => <button key={x.n} type="button" className={epaisseur === x.v ? 'on' : ''} onClick={() => setEpaisseur(x.v)}>{x.n}</button>)}
          </span>
        </div>
        {outil === 'picto' && (
          <div className="an-barre">
            <span className="an-groupe">
              {PICTOS.map((p) => <button key={p} type="button" className={`an-picto ${!libre && picto === p ? 'on' : ''}`} onClick={() => { setPicto(p); setLibre(''); }}>{p}</button>)}
            </span>
            <input className="an-libre" value={libre} maxLength={40} placeholder="ou un emoji / texte au clavier, puis cliquez sur la photo" onChange={(e) => setLibre(e.target.value)} />
          </div>
        )}
        <p className="muted petit an-aide">
          {outil === 'gomme' ? 'Touchez un élément pour l\'effacer.'
            : outil === 'picto' ? 'Touchez la photo pour poser le picto.'
            : outil === 'halo' || outil === 'attention' ? `Touchez la photo pour poser un repère animé (il reste animé chez le client, ${reperes.length}/10).`
            : 'Glissez sur la photo.'}
          {outil === 'zone' && ' La zone grisée masque ou met en retrait une partie de la photo.'}
        </p>

        <div className="an-toile">
          {img ? (
            <span className="an-cadre">
              <canvas ref={toile} onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut} className={outil === 'gomme' ? 'gomme' : ''} />
              <Reperes liste={reperes} />
            </span>
          ) : (
            <p className="muted">Chargement de la photo…</p>
          )}
        </div>

        <Erreur e={err} />
        <div className="an-actions">
          <button type="button" className="btn" disabled={!formes.length && !reperes.length} onClick={() => (reperes.length && (outil === 'halo' || outil === 'attention' || !formes.length) ? setReperes(reperes.slice(0, -1)) : setFormes(formes.slice(0, -1)))}>↩ Annuler</button>
          <button type="button" className="btn" disabled={!formes.length && !reperes.length} onClick={() => confirm('Tout effacer ?') && ((setFormes([]), setReperes([])))}>🧹 Tout effacer</button>
          {(source.annotee || !!source.reperes?.length) && <button type="button" className="btn danger" onClick={original}>🗑 Revenir à la photo d'origine</button>}
          <span className="an-espace" />
          <button type="button" className="btn" onClick={onFermer}>Fermer</button>
          <button type="button" className="btn prim" disabled={envoi || !img} onClick={enregistrer}>{envoi ? 'Enregistrement…' : '💾 Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
}
