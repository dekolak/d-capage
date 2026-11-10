import { CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { Fenetre } from './Fenetres';
import { Animation as Anim, EtapeAnim, EtatAnim, TexteAnim, Guide, ModeBlanc, SceneBlanc, SceneEcrans, useGuide } from './guides';
import { useVoix } from './voix';
import './animations.css';
import './guides.css';
import { t } from '../../lib/i18n';

/**
 * Animations explicatives (reprises du prototype) : un curseur parcourt les écrans du guide, avec sous-titres et voix off.
 * La voix pilote le temps : l'étape suivante attend la fin de la phrase (reprise de sécurité après une durée estimée).
 * Adresse : /guides/<guide>/animation/<id>.
 */
export default function Animation() {
  const { slug = '', id } = useParams();
  const { guide, erreur } = useGuide(slug);
  if (erreur) return <div className="page"><Erreur e={erreur} /><Link to="/guides">{t('kiavik.anim.retour')}</Link></div>;
  if (!guide) return <Chargement />;
  const a = guide.animations?.find((x) => x.id === id);
  if (!a) return <Navigate to="/guides" replace />;
  return <Lecteur key={a.id} guide={guide} a={a} />;
}

interface Temps { scene: number; etape: number; cap?: string; d: number; click?: boolean }

function aplatir(a: Anim): Temps[] {
  if (a.type === 'blanc') return (a.scenes as SceneBlanc[]).map((s, i) => ({ scene: i, etape: 0, cap: s.cap, d: 8000 }));
  return (a.scenes as SceneEcrans[]).flatMap((s, i) => s.etapes.map((e, k) => ({ scene: i, etape: k, cap: e.cap, d: e.d ?? 1500, click: !!e.click })));
}

function Lecteur({ guide, a }: { guide: Guide; a: Anim }) {
  const temps = useMemo(() => aplatir(a), [a]);
  const voix = useVoix();
  const [pos, setPos] = useState(0);
  const [clicFait, setClicFait] = useState(true);
  const [lecture, setLecture] = useState(false);
  const [fini, setFini] = useState(false);
  const [vitesse, setVitesse] = useState(1);
  const relire = useRef(false);
  const haut = useRef<HTMLHeadingElement>(null);
  const tp = temps[pos];

  // sous-titre visible : dernière phrase de la scène jusqu'à l'étape en cours
  const sousTitre = useMemo(() => {
    for (let i = pos; i >= 0 && temps[i].scene === tp.scene; i--) if (temps[i].cap) return temps[i].cap!;
    return '';
  }, [pos, tp, temps]);

  // moteur : une étape après l'autre, la voix pilote le temps
  useEffect(() => {
    if (!lecture) return;
    let annule = false;
    const minuteurs: number[] = [];
    const attendre = (ms: number) => new Promise<void>((ok) => minuteurs.push(window.setTimeout(ok, ms)));
    (async () => {
      setClicFait(!tp.click);
      if (tp.click) attendre(250 / vitesse).then(() => !annule && setClicFait(true));
      const phrase = tp.cap ?? (relire.current ? sousTitre : undefined);
      relire.current = false;
      const parole = phrase ? voix.dire(phrase, vitesse) : Promise.resolve();
      await attendre(tp.d / vitesse);
      await parole;
      if (annule) return;
      if (pos + 1 >= temps.length) {
        setLecture(false);
        setFini(true);
        return;
      }
      if (temps[pos + 1].scene !== tp.scene) await attendre(500 / vitesse);
      if (!annule) setPos(pos + 1);
    })();
    return () => {
      annule = true;
      minuteurs.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, lecture]);

  const aller = (i: number, jouer: boolean) => {
    voix.arreter();
    setFini(false);
    setClicFait(true);
    setPos(i);
    setLecture(jouer);
  };
  const debutScene = (s: number) => temps.findIndex((x) => x.scene === s);
  const lire = () => {
    if (fini) return aller(0, true);
    relire.current = true; // Lecture relit la phrase en cours
    setLecture(true);
  };
  const pause = () => {
    voix.arreter();
    setLecture(false);
  };

  return (
    <div className="page gx an">
      <Link to="/guides" className="btn-lien">{t('kiavik.anim.retour')}</Link>
      <h1 ref={haut} className="gx-proc-titre">🎬 {a.titre}</h1>
      {a.resume && <p className="muted">{a.resume}</p>}

      {a.type === 'ecrans' ? (
        <VueEcrans guide={guide} a={a} t={tp} clicFait={clicFait} vitesse={vitesse} />
      ) : (
        <VueBlanc key={pos} guide={guide} scene={(a.scenes as SceneBlanc[])[tp.scene]} vitesse={vitesse} />
      )}
      <div className="an-cap" aria-live="polite">{sousTitre}</div>

      <div className="an-ctl">
        <button type="button" className="btn prim" onClick={lecture ? pause : lire}>{lecture ? t('kiavik.anim.pause') : fini ? t('kiavik.anim.revoir') : t('kiavik.anim.lecture')}</button>
        <button type="button" className="btn" aria-label={t('kiavik.anim.precedente')} onClick={() => aller(debutScene(Math.max(0, tp.scene - 1)), lecture)}>⏮</button>
        <button type="button" className="btn" aria-label={t('kiavik.anim.suivante')} onClick={() => aller(debutScene(Math.min(a.scenes.length - 1, tp.scene + 1)), lecture)}>⏭</button>
        <button type="button" className="btn" onClick={() => aller(0, true)}>{t('kiavik.anim.recommencer')}</button>
      </div>
      <div className="an-reglages">
        <label>
          {t('kiavik.anim.vitesse', { v: vitesse })}
          <input type="range" min={0.25} max={2} step={0.25} value={vitesse} onChange={(e) => setVitesse(+e.target.value)} />
        </label>
        <label className="an-case">
          <input type="checkbox" checked={voix.active} onChange={(e) => voix.activer(e.target.checked)} /> {t('kiavik.anim.voixOff')}
        </label>
        {voix.active && voix.voix.length > 1 && (
          <select value={voix.choisie?.name ?? ''} onChange={(e) => voix.choisir(e.target.value)} aria-label={t('kiavik.anim.voix')}>
            {voix.voix.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        )}
      </div>
      {voix.active && (voix.sansVoix || !voix.dispo) && <p className="muted petit">{t('kiavik.anim.sansVoix')}</p>}

      <h4>{t('kiavik.anim.etapes')}</h4>
      <ol className="an-scenes">
        {a.scenes.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              className={i === tp.scene ? 'on' : ''}
              onClick={() => {
                aller(debutScene(i), true);
                haut.current?.scrollIntoView({ behavior: 'smooth' }); // revenir au lecteur
              }}
            >
              {s.titre}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------- animations sur les écrans du guide ----------
interface Etat { f: string | null; j: number; a: number; wm: string; t9: number; o: number; hl: number; pop: string | null; ecran: string; textes: TexteAnim[] }

function appliquer(st: Etat, e: EtapeAnim) {
  switch (e.eff) {
    case 'f': st.f = 'smiley.jpg'; break;
    case 'j': st.j = 1; break;
    case 'a': st.a = 1; st.o = 0; st.wm = e.val ?? 'Aucun'; break;
    case 'o': st.o = 1; st.hl = e.hl ?? 0; break;
    case 't9': st.t9 = 1; break;
    case 't9w': st.t9 = 2; break;
    case 'pop': st.pop = e.val ?? null; break;
    case 'popclose': st.pop = null; break;
    case 'texte': if (e.zone) st.textes = [...st.textes.filter((x) => x.zone.join() !== e.zone!.join()), { zone: e.zone, val: e.val ?? '' }]; break;
  }
  if (e.go) st.ecran = e.go;
}

const CURSEUR = (
  <svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#000" strokeWidth="1.6" strokeLinejoin="round" /></svg>
);

function VueEcrans({ guide, a, t: tp, clicFait, vitesse }: { guide: Guide; a: Anim; t: Temps; clicFait: boolean; vitesse: number }) {
  const scene = (a.scenes as SceneEcrans[])[tp.scene];
  const ref = useRef<HTMLDivElement>(null);
  const [posSel, setPosSel] = useState<[number, number] | null>(null);

  const etat = useMemo(() => {
    const e0: EtatAnim = scene.etat;
    const st: Etat = { f: e0.f ?? null, j: e0.j ?? 0, a: e0.a ?? 0, wm: e0.wm ?? 'Aucun', t9: e0.t9 ?? 0, o: 0, hl: 0, pop: null, ecran: scene.ecran, textes: e0.textes ?? [] };
    scene.etapes.forEach((e, k) => {
      if (k < tp.etape || (k === tp.etape && (!e.click || clicFait))) appliquer(st, e);
    });
    return st;
  }, [scene, tp.etape, clicFait]);

  const ecran = guide.ecrans.find((x) => x.id === etat.ecran);
  // une scène peut se passer sur une photo (ex. la mire imprimée sur le mur) : ecran « photo:<clé> »
  const photo = etat.ecran.startsWith('photo:') ? a.photos?.[etat.ecran.slice(6)] : undefined;
  const W = photo?.largeur ?? ecran?.largeur ?? 1210;
  const H = photo?.hauteur ?? ecran?.hauteur ?? 600;
  const pc = (x: number, y: number, w?: number, h?: number): CSSProperties => ({
    left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, ...(w !== undefined ? { width: `${(w / W) * 100}%` } : {}), ...(h !== undefined ? { height: `${(h / H) * 100}%` } : {}),
  });

  // curseur : dernière position donnée dans la scène
  const source = useMemo(() => {
    for (let k = tp.etape; k >= 0; k--) if (scene.etapes[k].cur || scene.etapes[k].sel) return scene.etapes[k];
    return null;
  }, [scene, tp.etape]);
  useLayoutEffect(() => {
    if (!source?.sel || !ref.current) {
      setPosSel(null);
      return;
    }
    const el = ref.current.querySelector(source.sel);
    if (!el) return;
    const R1 = ref.current.getBoundingClientRect();
    const R2 = el.getBoundingClientRect();
    setPosSel([((R2.left + R2.width * (source.fx ?? 0.5) - R1.left) / R1.width) * 100, ((R2.top + R2.height * (source.fy ?? 0.5) - R1.top) / R1.height) * 100]);
  }, [source, etat]);
  const curseur: [number, number] | null = source?.cur ? [(source.cur[0] / W) * 100, (source.cur[1] / H) * 100] : source?.sel ? posSel : null;
  const etape = scene.etapes[tp.etape];
  const duree = Math.round(700 / vitesse);
  const modes = guide.modesBlanc?.modes ?? [];
  const mode = (nom: string) => modes.find((m) => m.nom === nom);

  return (
    <div ref={ref} className="an-ecran" style={{ aspectRatio: etat.ecran === 'end' ? '1210 / 600' : `${W} / ${H}` }}>
      {etat.ecran === 'end' ? (
        <div className="aend">
          <div><b>{t('kiavik.anim.fin.fichier')}</b><span>smiley</span></div><i>→</i>
          <div><b>{t('kiavik.anim.fin.logiciel')}</b><span>{t('kiavik.anim.fin.ouvre')}</span></div><i>→</i>
          <div><b>{t('kiavik.anim.fin.mur')}</b><span>{t('kiavik.anim.fin.impression')}</span></div>
        </div>
      ) : photo ? (
        <img src={photo.image} alt="" draggable={false} />
      ) : ecran?.type === 'capture' && ecran.image ? (
        <img src={ecran.image} alt="" draggable={false} />
      ) : ecran ? (
        <div className="an-fenetre"><Fenetre fenetre={ecran.fenetre ?? ''} largeur={W} hauteur={H} fichier={etat.f} onFermer={() => {}} /></div>
      ) : null}

      {etat.ecran === 'm0' && etat.j > 0 && <Travail images={guide} />}
      {etat.ecran === 't4' && etat.o > 0 && (
        <>
          <div className="aaucun" style={{ ...pc(188, 357, 160, 20), boxShadow: 'none' }}>Couleur d'accompagnement</div>
          <div className="alst" style={{ ...pc(188, 377), minWidth: `${(160 / W) * 100}%` }}>
            {modes.map((m, i) => <div key={m.nom} className={i === etat.hl ? 'h' : ''}>{m.nom}</div>)}
          </div>
        </>
      )}
      {etat.ecran === 't4' && etat.a > 0 && <div className="aaucun" style={pc(188, 357, 160, 20)}>{etat.wm}</div>}
      {etat.ecran === 't9' && etat.t9 > 0 && (
        <div className="aaucun an-coche" style={pc(104, 180, 14, 14)}>✓</div>
      )}
      {etat.ecran === 't9' && etat.t9 === 2 && (
        <>
          <div className="t9pv" style={pc(666, 332, 517, 389)}>
            <img src={mode(etat.wm)?.image_canal.replace('/pw_', '/w_')} alt="" />
            <span>{t('kiavik.anim.t9')}</span>
          </div>
          <div className="aaucun" style={{ ...pc(104, 296, 314, 17), background: '#1f6feb33', border: 0, boxShadow: 'none' }} />
          <div className="aaucun an-coche" style={pc(106, 298, 12, 12)}>✓</div>
        </>
      )}
      {etat.textes.map((x) => (
        <div key={x.zone.join()} className="aaucun" style={pc(x.zone[0], x.zone[1], x.zone[2], x.zone[3])}>{x.val}</div>
      ))}
      {etat.pop && <FenetreBlanc guide={guide} onglet={etat.pop} mode={mode(etat.pop)} />}

      {etape?.ring && curseur && (
        <div key={`r${tp.scene}-${tp.etape}`} className="aring" style={{ left: `${curseur[0]}%`, top: `${curseur[1]}%`, animationDelay: `${duree}ms, ${duree}ms` }} />
      )}
      {curseur && (
        <div
          key={`c${tp.scene}`}
          className={`acur ${etape?.click && !clicFait ? 'clk' : ''}`}
          style={{ left: `${curseur[0]}%`, top: `${curseur[1]}%`, transition: `left ${duree}ms ease, top ${duree}ms ease` }}
        >
          {CURSEUR}
        </div>
      )}
    </div>
  );
}

/** Ligne du travail dans la file (écran M0). */
function Travail({ images }: { images: Guide }) {
  const smiley = images.ecrans.find((e) => e.id === 'm0')?.image?.replace(/[^/]+$/, 'smiley.png');
  const c = (x: number, txt: string) => <span style={{ left: `${((x - 64) / 1082) * 100}%` }}>{txt}</span>;
  return (
    <div className="job">
      {smiley && <img src={smiley} style={{ left: '3%' }} alt="" />}
      {c(210, 'DXonJet-XHS-VP4')}{c(320, 'smiley.jpg')}{c(430, t('kiavik.anim.enAttente'))}{c(540, 'PC-atelier')}{c(650, '90,3 × 67,7 cm')}{c(760, '1')}{c(870, 'JPEG')}{c(980, '415,7K')}{c(1090, 'F1 12PASS')}
    </div>
  );
}

/** Fenêtre « Quel blanc choisir ? » (Sous-uni / Support). */
function FenetreBlanc({ guide, onglet, mode }: { guide: Guide; onglet: string; mode?: ModeBlanc }) {
  const txt = guide.fenetreBlanc?.[onglet];
  const onglets = Object.keys(guide.fenetreBlanc ?? {}).sort().reverse(); // Sous-uni, Support
  return (
    <div className="wpop">
      <div className="wph"><b>{t('kiavik.guide.quelBlanc')}</b><span className="wclose">✕</span></div>
      <div className="wtabs">{onglets.map((x) => <button type="button" key={x} data-tab={x} className={x === onglet ? 'on' : ''}>{x}</button>)}</div>
      <div className="wbody">
        <div className="wcol"><img src={mode?.image_canal} alt="" /><small>{t('kiavik.anim.pop.apercu')}<br />{t('kiavik.anim.pop.noirBlanc')}</small></div>
        <div className="wcol"><img src={mode?.image_mur} alt="" /><small>{t('kiavik.guide.resultatMur')}</small></div>
        <div className="wtxt"><b>{onglet}</b><p>{txt?.titre}</p><p className="wr">{txt?.resultat}</p><p className="wu">👉 {txt?.usage}</p></div>
      </div>
    </div>
  );
}

// ---------- les réglages du blanc ----------
function VueBlanc({ guide, scene, vitesse }: { guide: Guide; scene: SceneBlanc; vitesse: number }) {
  const mb = guide.modesBlanc;
  const modes = mb?.modes ?? [];
  const parCle = (k: string) => modes.find((m) => m.image_canal.includes(`/pw_${k}.`));
  const aucun = parCle('aucun');
  const balayage = { animationDuration: `${Math.round(2600 / vitesse)}ms` };
  if (!scene.mode)
    return (
      <div className="wa">
        <div className="wintro">
          <div className="wl"><span className="l1">{t('kiavik.anim.blanc.couleur')}</span><span className="l2">{t('kiavik.anim.blanc.sousCouche')}</span><span className="l3">{t('kiavik.anim.blanc.murFonce')}</span></div>
          <div className="wcmp">
            <figure><img src={aucun?.image_mur} alt="" /><figcaption>{t('kiavik.anim.blanc.sans')}</figcaption></figure>
            <figure><img src={parCle('sousuni')?.image_mur} alt="" /><figcaption>{t('kiavik.anim.blanc.avec')}</figcaption></figure>
          </div>
        </div>
      </div>
    );
  const m = parCle(scene.mode);
  const origine = m?.image_canal.replace(/[^/]+$/, 'o_smiley.png');
  return (
    <div className="wa">
      <figure><img src={origine} alt="" className="wo1" /><figcaption>{t('kiavik.anim.blanc.origine')}</figcaption></figure>
      <span className="warr">→</span>
      <figure><div className="wwipe"><img src={m?.image_canal} alt="" style={balayage} /></div><figcaption>{t('kiavik.anim.blanc.apercu')}<br /><small>{t('kiavik.anim.blanc.noirBlanc')}</small></figcaption></figure>
      <span className="warr">→</span>
      <figure><div className="wwipe wres"><img src={aucun?.image_mur} alt="" /><img src={m?.image_mur} alt="" className="top" style={balayage} /></div><figcaption>{t('kiavik.anim.blanc.resultat')}</figcaption></figure>
      <div className="wname">
        {m?.nom ?? scene.titre}
        {mb?.plus_utilises?.includes(m?.nom ?? '') && <i className="wt">{t('kiavik.guide.plusUtilise')}</i>}
      </div>
    </div>
  );
}
