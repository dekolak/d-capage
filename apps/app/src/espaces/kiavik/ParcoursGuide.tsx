import { TouchEvent, useEffect, useRef, useState } from 'react';
import { t } from '../../lib/i18n';
import { CaptureBouton } from './CaptureBouton';
import { AideNon } from './Controle';
import { useVoix } from './voix';
import { ImageApi, Procedure } from './donneesProcedures';
import { decouperEtape } from './ProcedureDetail';
import './parcours.css';

/**
 * Parcours guidé d'une procédure : une étape à la fois, en plein écran, avec la capture du logiciel
 * (bouton entouré) ou la photo de l'étape. « Fait, suivant » coche l'étape dans la liste.
 * On peut glisser au doigt ; le parcours reprend là où on s'était arrêté.
 */
export function ParcoursGuide({ p, faites, setFaites, non, repondre, recommencer, onFermer }: {
  p: Procedure; faites: string[]; setFaites(f: string[]): void; non: string[]; repondre(e: string, oui: boolean): void; recommencer(): void; onFermer(): void;
}) {
  const cle = `kiavik.parcours.${p.id}`;
  const n = p.etapes.length;
  const [i, setI] = useState(() => {
    const garde = Number(localStorage.getItem(cle));
    if (Number.isInteger(garde) && garde > 0 && garde < n) return garde;
    const premiere = p.etapes.findIndex((e) => !faites.includes(e.id));
    return premiere < 0 ? n : premiere;
  });
  const debut = useRef<{ x: number; y: number } | null>(null);
  const voix = useVoix();
  const [lecture, setLecture] = useState(() => localStorage.getItem('kiavik.parcours.voix') === '1');

  // l'écran reste allumé pendant le parcours (si le téléphone le permet)
  useEffect(() => {
    let verrou: WakeLockSentinel | null = null;
    let fini = false;
    const demander = () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      navigator.wakeLock.request('screen').then((v) => { if (fini) v.release(); else verrou = v; }).catch(() => undefined);
    };
    demander();
    document.addEventListener('visibilitychange', demander);
    return () => {
      fini = true;
      document.removeEventListener('visibilitychange', demander);
      verrou?.release().catch(() => undefined);
    };
  }, []);

  // lecture à voix haute de la consigne à chaque étape (bouton 🔊)
  const etapeLue = p.etapes[i];
  const { dire, arreter } = voix;
  useEffect(() => {
    if (!lecture || !etapeLue) return;
    const { texte } = decouperEtape(etapeLue.texte);
    dire([texte, etapeLue.avertissement].filter(Boolean).join('. '), 1);
    return () => arreter();
  }, [lecture, etapeLue, dire, arreter]);
  const basculerLecture = () => {
    const b = !lecture;
    if (b) voix.activer(true);
    setLecture(b);
    localStorage.setItem('kiavik.parcours.voix', b ? '1' : '0');
  };

  useEffect(() => {
    localStorage.setItem(cle, String(i));
  }, [cle, i]);
  useEffect(() => {
    const touche = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onFermer();
      if (ev.key === 'ArrowRight') setI((x) => Math.min(n, x + 1));
      if (ev.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [n, onFermer]);

  const faitEtSuivant = () => {
    const e = p.etapes[i];
    if (e && !faites.includes(e.id)) setFaites([...faites, e.id]);
    setI(i + 1);
  };
  // glisser au doigt : gauche = étape suivante, droite = précédente
  const auDebut = (ev: TouchEvent) => (debut.current = { x: ev.touches[0].clientX, y: ev.touches[0].clientY });
  const aLaFin = (ev: TouchEvent) => {
    const d = debut.current;
    debut.current = null;
    if (!d) return;
    const dx = ev.changedTouches[0].clientX - d.x;
    const dy = ev.changedTouches[0].clientY - d.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx)) return;
    setI((x) => (dx < 0 ? Math.min(n, x + 1) : Math.max(0, x - 1)));
  };

  const e = p.etapes[i];
  const { partie, texte } = e ? decouperEtape(e.texte) : { partie: null, texte: '' };
  const fait = p.etapes.filter((x) => faites.includes(x.id)).length;

  return (
    <div className="pg" role="dialog" aria-modal="true" aria-label={p.titre}>
      <div className="pg-tete">
        <button type="button" className="gx-ic" aria-label={t('commun.fermer')} onClick={onFermer}>✕</button>
        <div className="pg-num">
          {e ? <b>{t('kiavik.parcours.etape', { i: i + 1, n })}</b> : <b>{p.titre}</b>}
          {partie && <small>{partie}</small>}
          <div className="gx-progres"><i style={{ width: `${(fait / n) * 100}%` }} /></div>
        </div>
        {voix.dispo && (
          <button type="button" className="gx-ic pg-voix" aria-pressed={lecture} aria-label={t('kiavik.parcours.lireVoix')} onClick={basculerLecture}>🔊</button>
        )}
      </div>

      {e ? (
        <>
          <div className="pg-corps" onTouchStart={auDebut} onTouchEnd={aLaFin}>
            <p className="pg-consigne">{texte}</p>
            {e.avertissement && <div className="gx-warn">⚠️ {e.avertissement}</div>}
            {e.controle && non.includes(e.id) && <AideNon e={e} />}
            {e.photo ? (
              <ImageApi chemin={e.photo} className="pg-photo" />
            ) : e.guide && e.ecran ? (
              <CaptureBouton key={e.id} guide={e.guide} ecran={e.ecran} pastille={e.pastille} zoomDepart />
            ) : null}
            {e.photo && e.guide && e.ecran && <CaptureBouton key={`${e.id}-c`} guide={e.guide} ecran={e.ecran} pastille={e.pastille} />}
          </div>
          {e.controle ? (
            <div className="pg-pied ct-oui-non grand">
              <button type="button" className="btn" aria-label={t('kiavik.parcours.precedente')} disabled={i === 0} onClick={() => setI(i - 1)}>◀</button>
              <button type="button" className={`btn ct-oui ${faites.includes(e.id) ? 'choisi' : ''}`} onClick={() => { repondre(e.id, true); setI(i + 1); }}>{t('kiavik.controle.oui')}</button>
              <button type="button" className={`btn ct-non ${non.includes(e.id) ? 'choisi' : ''}`} onClick={() => repondre(e.id, false)}>{t('kiavik.controle.non')}</button>
            </div>
          ) : (
            <div className="pg-pied">
              <button type="button" className="btn" aria-label={t('kiavik.parcours.precedente')} disabled={i === 0} onClick={() => setI(i - 1)}>◀</button>
              <button type="button" className="btn prim" onClick={faitEtSuivant}>
                {faites.includes(e.id) ? t('kiavik.parcours.suivante') : t('kiavik.parcours.faitSuivant')}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="pg-corps">
          <div className="pg-fin">
            <span>🎉</span>
            <b>{t('kiavik.parcours.termine')}</b>
            <p className="muted">{t('kiavik.parcours.termineTexte', { fait, n })}</p>
            <button type="button" className="btn prim large" onClick={onFermer}>{t('kiavik.parcours.retourListe')}</button>
            <button type="button" className="btn" onClick={() => { recommencer(); setI(0); }}>{t('kiavik.procedures.recommencer')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
