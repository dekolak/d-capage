import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { ChoixCategorie, Etape, ImageApi, Procedure, ResumeProcedure, viderProcedures } from '../espaces/kiavik/donneesProcedures';
import { api } from '../lib/api';
import { useEspace } from '../lib/espace';
import { compresser } from '../lib/image';
import { BadgeZone } from './Admin';
import { BlocEtiquettes, EspaceContenu } from '../espaces/kiavik/Etiquettes';
import './terrain.css';

/*
 * Administration → 🎥 Mode terrain (admin, en français) : capturer un pas-à-pas sur le terrain, téléphone sur trépied.
 * Une étape = une ou plusieurs photos (retardateur réglable) + ce que l'on fait (dicté ou tapé) + ⚠️ si point de vigilance.
 * Tout part tout de suite dans un pas-à-pas NON PUBLIÉ ; on le met au propre ensuite sur PC (éditeur habituel).
 */

const MAX_PHOTOS = 8;
const RETARDATEURS = [0, 3, 5, 10] as const;
const CLE_RETARDATEUR = 'terrain.retardateur';
/** Texte d'une étape encore vide (l'API demande au moins 2 caractères). */
const vide = (n: number) => `Étape ${n} (à rédiger)`;
const estVide = (t: string) => /^Étape \d+ \(à rédiger\)$/.test(t);

/** Accueil : nouveau brouillon (titre, catégorie, trame facultative) ou reprendre un brouillon non publié. */
export function TerrainAccueil() {
  const nav = useNavigate();
  const [brouillons, setBrouillons] = useState<ResumeProcedure[]>();
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState('');
  const [trame, setTrame] = useState('');
  const { espace: ouvert } = useEspace();
  const [cible, setCible] = useState<{ espace: EspaceContenu; etiquettes: string[] }>({ espace: ouvert.slug as EspaceContenu, etiquettes: [] });
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState<unknown>();
  useEffect(() => {
    viderProcedures();
    api<ResumeProcedure[]>('/procedures').then((l) => setBrouillons(l.filter((p) => !p.publiee))).catch(setErr);
  }, []);

  const demarrer = async () => {
    setEnvoi(true);
    setErr(undefined);
    try {
      const p = await api<Procedure>('/admin/procedures', { method: 'POST', json: { titre: titre.trim(), ...(categorie ? { categorie } : {}), espace: cible.espace, etiquettes: cible.etiquettes } });
      // trame : une étape par ligne (on les remplit ensuite une par une, rien n'est oublié)
      const lignes = trame.split('\n').map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter((l) => l.length >= 2);
      for (const [i, texte] of lignes.entries()) await api(`/admin/procedures/${p.id}/etapes`, { method: 'POST', json: { texte, position: i } });
      if (!lignes.length) await api(`/admin/procedures/${p.id}/etapes`, { method: 'POST', json: { texte: vide(1), position: 0 } });
      viderProcedures();
      nav(`/admin/terrain/${p.id}`);
    } catch (e) {
      setErr(e);
      setEnvoi(false);
    }
  };

  return (
    <div className="page">
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>🎥 Mode terrain <BadgeZone zone="commun" /></h1>
      <p className="muted petit">
        Téléphone sur trépied : une étape = des photos + ce que vous faites (dicté ou tapé). Tout est enregistré au fur et à mesure
        dans un pas-à-pas <b>non publié</b> ; vous le mettez au propre ensuite sur PC.
      </p>
      <Erreur e={err} />
      <div className="carte form">
        <label>Titre<input value={titre} maxLength={120} placeholder="ex. Changer les filtres F1080" onChange={(e) => setTitre(e.target.value)} /></label>
        <label>Catégorie<ChoixCategorie valeur={categorie} onChange={setCategorie} /></label>
        <BlocEtiquettes espace={cible.espace} etiquettes={cible.etiquettes} onChange={setCible} />
        <label>
          Trame (facultatif) : les étapes prévues, une par ligne
          <textarea rows={6} value={trame} onChange={(e) => setTrame(e.target.value)}
            placeholder={'Couper le courant\nRetirer le capot\nSortir le filtre\n…'} />
          <small className="muted">Pour ne rien oublier : vous remplirez chaque étape sur place (et pourrez en ajouter).</small>
        </label>
        <button type="button" className="btn prim large" disabled={envoi || titre.trim().length < 2} onClick={demarrer}>{envoi ? 'Création…' : '▶ Démarrer'}</button>
      </div>

      <h2>Reprendre un brouillon</h2>
      {!brouillons ? <Chargement /> : !brouillons.length ? <p className="muted">Aucun pas-à-pas non publié.</p> : (
        <div className="liste">
          {brouillons.map((p) => (
            <Link key={p.id} to={`/admin/terrain/${p.id}`} className="carte lien-bloc cn-machine">
              <b>{p.titre} <BadgeZone zone={p.espace} /></b>
              <span className="muted petit">{p.categorie} · {p.nbEtapes} étape{p.nbEtapes > 1 ? 's' : ''}{p.etiquettes.length ? ` · 🏷 ${p.etiquettes.join(', ')}` : ''}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Capture : caméra en direct + retardateur, dictée, ⚠️, étape suivante, bande des étapes. */
export function TerrainCapture() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { espaces, espace, choisir } = useEspace();
  const [p, setP] = useState<Procedure>();
  const [err, setErr] = useState<unknown>();
  const [ici, setIci] = useState(0);
  const [texte, setTexte] = useState('');
  const [vigilance, setVigilance] = useState('');
  const [envois, setEnvois] = useState(0);
  const [fini, setFini] = useState(false);

  const route = (p?.etapes ?? []).filter((e) => !e.brancheId);
  const e: Etape | undefined = route[ici];

  const appliquer = useCallback((x: Procedure) => setP(x), []);
  useEffect(() => {
    api<Procedure>(`/procedures/${id}`).then(appliquer).catch(setErr);
  }, [id, appliquer]);
  // étape affichée : son texte et son avertissement
  useEffect(() => {
    if (!e) return;
    setTexte(estVide(e.texte) ? '' : e.texte);
    setVigilance(e.avertissement ?? '');
  }, [e?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // écran gardé allumé
  useEffect(() => {
    let verrou: WakeLockSentinel | null = null;
    let fin = false;
    const prendre = () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      navigator.wakeLock.request('screen').then((v) => { if (fin) v.release(); else verrou = v; }).catch(() => undefined);
    };
    prendre();
    document.addEventListener('visibilitychange', prendre);
    return () => {
      fin = true;
      document.removeEventListener('visibilitychange', prendre);
      verrou?.release().catch(() => undefined);
    };
  }, []);

  /** Enregistre le texte et l'avertissement de l'étape affichée s'ils ont changé. */
  const sauver = async () => {
    if (!e) return;
    const t = texte.trim().length >= 2 ? texte.trim() : estVide(e.texte) ? e.texte : vide(ici + 1);
    const a = vigilance.trim() || null;
    if (t === e.texte && a === (e.avertissement ?? null)) return;
    try {
      appliquer(await api<Procedure>(`/admin/procedures/etapes/${e.id}`, { method: 'PATCH', json: { texte: t, avertissement: a } }));
    } catch (x) {
      setErr(x);
    }
  };
  const aller = async (n: number) => {
    await sauver();
    setIci(n);
  };
  /** Étape suivante : la prochaine de la trame, sinon une nouvelle à la fin. */
  const suivante = async () => {
    await sauver();
    if (ici < route.length - 1) return setIci(ici + 1);
    try {
      appliquer(await api<Procedure>(`/admin/procedures/${id}/etapes`, { method: 'POST', json: { texte: vide(route.length + 1), position: route.length } }));
      setIci(route.length);
    } catch (x) {
      setErr(x);
    }
  };
  /** Insérer une étape oubliée juste après celle-ci. */
  const inserer = async () => {
    await sauver();
    try {
      appliquer(await api<Procedure>(`/admin/procedures/${id}/etapes`, { method: 'POST', json: { texte: vide(ici + 2), position: ici + 1 } }));
      setIci(ici + 1);
    } catch (x) {
      setErr(x);
    }
  };
  const supprimer = async () => {
    if (!e || !confirm('Supprimer cette étape et ses photos ?')) return;
    try {
      appliquer(await api<Procedure>(`/admin/procedures/etapes/${e.id}`, { method: 'DELETE' }));
      setIci(Math.max(0, ici - 1));
    } catch (x) {
      setErr(x);
    }
  };
  /** Photo : réduite sur le téléphone, envoyée tout de suite (plusieurs envois peuvent se suivre). */
  const photo = async (b: Blob) => {
    if (!e) return;
    const etapeId = e.id;
    setEnvois((n) => n + 1);
    try {
      const c = await compresser(b);
      const fd = new FormData();
      fd.append('photo', c.fichier, 'photo.jpg');
      appliquer(await api<Procedure>(`/admin/procedures/etapes/${etapeId}/photo`, { method: 'POST', body: fd }));
    } catch (x) {
      setErr(x);
    } finally {
      setEnvois((n) => n - 1);
    }
  };
  const terminer = async () => {
    await sauver();
    setFini(true);
  };
  /** L'éditeur des pas-à-pas, dans l'espace du pas-à-pas (Lazzeko ou Kiavik). */
  const editeur = () => {
    if (p && espace.slug !== p.espace && espaces.some((x) => x.slug === p.espace)) choisir(p.espace);
    nav(`/admin/procedures/${id}`);
  };

  if (!p) return err ? <div className="page"><Erreur e={err} /></div> : <Chargement />;

  if (fini) {
    const notes = [
      `NOUVELLE PROCÉDURE`,
      `Titre : ${p.titre}`,
      `Catégorie : ${p.categorie}`,
      '',
      'Étapes (dans l\'ordre, une par ligne) :',
      ...route.map((x, i) => `- ${i + 1}. ${estVide(x.texte) ? '(à rédiger)' : x.texte}${x.photos.length ? ` [${x.photos.length} photo${x.photos.length > 1 ? 's' : ''}]` : ''}${x.avertissement ? `\n  ⚠️ ${x.avertissement}` : ''}`),
    ].join('\n');
    const aRediger = route.filter((x) => estVide(x.texte)).length;
    const sansPhoto = route.filter((x) => !x.photos.length).length;
    return (
      <div className="page tr-fin">
        <h1>✅ Brouillon enregistré</h1>
        <p><b>{p.titre}</b> · {route.length} étape{route.length > 1 ? 's' : ''} · {route.reduce((n, x) => n + x.photos.length, 0)} photos</p>
        {(aRediger > 0 || sansPhoto > 0) && (
          <p className="muted">À vérifier : {aRediger > 0 && `${aRediger} étape(s) sans texte`}{aRediger > 0 && sansPhoto > 0 && ' · '}{sansPhoto > 0 && `${sansPhoto} sans photo`}</p>
        )}
        <p className="muted petit">Il reste non publié (invisible pour les clients). Sur PC : ouvrez-le pour le mettre au propre, ou copiez les notes pour Claude.</p>
        <div className="actions-avis">
          <button type="button" className="btn" onClick={() => setFini(false)}>◀ Continuer la capture</button>
          <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(notes)}>📋 Copier les notes (pour Claude)</button>
          <button type="button" className="btn prim" onClick={editeur}>✏️ Ouvrir dans l'éditeur</button>
        </div>
        <pre className="tr-notes">{notes}</pre>
      </div>
    );
  }

  return (
    <div className="tr">
      <header className="tr-tete">
        <Link to="/admin/terrain" className="btn petit" aria-label="Quitter">✕</Link>
        <span className="tr-titre"><b>{p.titre}</b><small>Étape {ici + 1}/{route.length}{envois > 0 ? ` · ⬆ envoi de ${envois} photo${envois > 1 ? 's' : ''}…` : ''}</small></span>
        <button type="button" className="btn petit prim" onClick={terminer}>Terminé</button>
      </header>
      <Erreur e={err} />

      {e && (
        <>
          <Camera pleine={e.photos.length >= MAX_PHOTOS} onPhoto={photo} />
          <Galerie reste={MAX_PHOTOS - e.photos.length} onPhoto={photo} />

          {e.photos.length > 0 && (
            <div className="tr-photos">
              {e.photos.map((ph) => (
                <span key={ph.id} className="tr-photo">
                  <ImageApi chemin={ph.url} />
                  <button type="button" aria-label="Retirer la photo"
                    onClick={() => confirm('Retirer cette photo ?') && api<Procedure>(`/admin/procedures/photos/${ph.id}`, { method: 'DELETE' }).then(appliquer).catch(setErr)}>✕</button>
                </span>
              ))}
            </div>
          )}

          <div className="tr-texte">
            <textarea rows={3} value={texte} placeholder="Ce que je fais à cette étape…" onChange={(x) => setTexte(x.target.value)} onBlur={sauver} />
            <Dictee onTexte={(t) => setTexte((v) => (v.trim() ? `${v.trim()} ${t}` : t))} />
          </div>
          <label className={`tr-vigilance ${vigilance ? 'on' : ''}`}>
            ⚠️
            <input value={vigilance} placeholder="Point de vigilance (facultatif)" onChange={(x) => setVigilance(x.target.value)} onBlur={sauver} />
          </label>

          <div className="tr-actions">
            <button type="button" className="btn" disabled={ici === 0} onClick={() => aller(ici - 1)}>◀</button>
            <button type="button" className="btn" onClick={inserer} title="Insérer une étape oubliée après celle-ci">＋ Insérer</button>
            <button type="button" className="btn prim large" onClick={suivante}>Étape suivante ▶</button>
          </div>
          <button type="button" className="btn-lien petit" onClick={supprimer}>🗑 Supprimer cette étape</button>
        </>
      )}

      <nav className="tr-bande" aria-label="Étapes">
        {route.map((x, i) => (
          <button key={x.id} type="button" className={`tr-vignette ${i === ici ? 'on' : ''} ${estVide(x.texte) && !x.photos.length ? 'vide' : ''}`} onClick={() => aller(i)}>
            {x.photos[0] ? <ImageApi chemin={x.photos[0].url} /> : <span className="tr-num">{i + 1}</span>}
            <small>{i + 1}{x.photos.length ? ` · ${x.photos.length}📷` : ''}{x.avertissement ? ' ⚠️' : ''}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}

/**
 * Caméra en direct (arrière) : déclencheur avec retardateur réglable (0, 3, 5, 10 s), bip à chaque seconde.
 * Si la caméra n'est pas accessible : bouton « Prendre une photo » de l'appareil.
 */
function Camera({ onPhoto, pleine }: { onPhoto: (b: Blob) => void; pleine: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [actif, setActif] = useState<boolean | null>(null);
  const [delai, setDelai] = useState<number>(() => Number(localStorage.getItem(CLE_RETARDATEUR) ?? 3));
  const [compte, setCompte] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let flux: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        flux = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => undefined);
        }
        setActif(true);
      })
      .catch(() => setActif(false));
    return () => flux?.getTracks().forEach((t) => t.stop());
  }, []);

  const bip = (aigu = false) => {
    try {
      const a = new AudioContext();
      const o = a.createOscillator();
      o.frequency.value = aigu ? 1320 : 880;
      o.connect(a.destination);
      o.start();
      o.stop(a.currentTime + (aigu ? 0.25 : 0.1));
      o.onended = () => a.close();
    } catch {
      /* pas de son */
    }
  };
  const capturer = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => b && onPhoto(b), 'image/jpeg', 0.92);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
  };
  const declencher = () => {
    if (compte) return;
    if (!delai) {
      bip(true);
      return capturer();
    }
    let n = delai;
    setCompte(n);
    bip();
    const t = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(t);
        setCompte(0);
        bip(true);
        capturer();
      } else {
        setCompte(n);
        bip();
      }
    }, 1000);
  };
  const choisirDelai = (d: number) => {
    setDelai(d);
    localStorage.setItem(CLE_RETARDATEUR, String(d));
  };

  if (actif === false)
    return (
      <label className={`btn prim large tr-secours ${pleine ? 'desactive' : ''}`}>
        📷 Prendre une photo
        <input type="file" accept="image/*" capture="environment" hidden disabled={pleine} onChange={(x) => { const f = x.target.files?.[0]; if (f) onPhoto(f); x.target.value = ''; }} />
      </label>
    );
  return (
    <div className="tr-camera">
      <video ref={video} playsInline muted />
      {flash && <div className="tr-flash" />}
      {compte > 0 && <div className="tr-compte">{compte}</div>}
      <div className="tr-commandes">
        <span className="tr-delais">
          {RETARDATEURS.map((d) => (
            <button key={d} type="button" className={delai === d ? 'on' : ''} onClick={() => choisirDelai(d)}>{d ? `${d}s` : 'Direct'}</button>
          ))}
        </span>
        <button type="button" className="tr-declencheur" aria-label="Prendre la photo" disabled={pleine || !!compte || !actif} onClick={declencher}>
          {pleine ? '8 max' : compte ? compte : '📷'}
        </button>
      </div>
    </div>
  );
}

/** Ajouter des photos déjà prises (galerie du téléphone, ou fichiers sur PC), plusieurs à la fois. */
function Galerie({ reste, onPhoto }: { reste: number; onPhoto: (b: Blob) => Promise<void> }) {
  return (
    <label className={`btn tr-galerie ${reste <= 0 ? 'desactive' : ''}`}>
      🖼 Ajouter depuis la galerie
      <input type="file" accept="image/*" multiple hidden disabled={reste <= 0}
        onChange={async (x) => {
          const l = [...(x.target.files ?? [])].slice(0, reste);
          x.target.value = '';
          // une par une, dans l'ordre choisi
          for (const f of l) await onPhoto(f);
        }} />
    </label>
  );
}

type Reconnaissance = {
  lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};

/** Dictée (Chrome Android, avec Internet) : le texte reconnu s'ajoute à l'étape. */
function Dictee({ onTexte }: { onTexte: (t: string) => void }) {
  const R = (window as unknown as { SpeechRecognition?: new () => Reconnaissance; webkitSpeechRecognition?: new () => Reconnaissance }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => Reconnaissance }).webkitSpeechRecognition;
  const rec = useRef<Reconnaissance | null>(null);
  const [ecoute, setEcoute] = useState(false);
  const [provisoire, setProvisoire] = useState('');
  useEffect(() => () => rec.current?.stop(), []);
  if (!R) return null;
  const basculer = () => {
    if (ecoute) {
      rec.current?.stop();
      setEcoute(false);
      return;
    }
    const r = new R();
    r.lang = 'fr-FR';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let p = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const x = e.results[i];
        if (x.isFinal) onTexte(x[0].transcript.trim());
        else p += x[0].transcript;
      }
      setProvisoire(p);
    };
    r.onend = () => {
      setEcoute(false);
      setProvisoire('');
    };
    r.onerror = () => setEcoute(false);
    rec.current = r;
    r.start();
    setEcoute(true);
  };
  return (
    <div className="tr-dictee">
      <button type="button" className={`btn ${ecoute ? 'danger' : ''}`} onClick={basculer}>{ecoute ? '⏹ Arrêter' : '🎙 Dicter'}</button>
      {provisoire && <small className="muted">{provisoire}</small>}
    </div>
  );
}
