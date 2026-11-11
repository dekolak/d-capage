import { TouchEvent, useEffect, useRef, useState } from 'react';
import { t } from '../../lib/i18n';
import { Avancement } from './avancement';
import { CaptureBouton } from './CaptureBouton';
import { AideNon } from './Controle';
import { FinDiagnostic } from './FinDiagnostic';
import { Procedure } from './donneesProcedures';
import { Galerie } from './Galerie';
import { PasClair } from './PasClair';
import { decouperEtape } from './ProcedureDetail';
import { useVoix } from './voix';
import './parcours.css';

/**
 * Parcours guidé d'une procédure : une étape à la fois, en plein écran, avec la capture du logiciel
 * (bouton entouré) ou la photo de l'étape. « Fait, suivant » coche l'étape dans la liste.
 * Questions (diagnostic) : une réponse par bouton ; le chemin suit le détour de la réponse, puis revient
 * sur la route principale (ou s'arrête sur une fin). On peut glisser au doigt ; le parcours reprend là où on s'était arrêté.
 */
export function ParcoursGuide({ p, av, onFermer }: { p: Procedure; av: Avancement; onFermer(): void }) {
  const cle = `kiavik.parcours.${p.id}`;
  const { pas, fin } = av.chemin;
  const n = pas.length;
  // on ne dépasse pas une question sans réponse ; après la dernière étape : écran de fin
  const max = fin ? n : Math.max(0, n - 1);
  const [i, setI] = useState(() => {
    const garde = Number(localStorage.getItem(cle));
    if (Number.isInteger(garde) && garde > 0 && garde <= max) return garde;
    const premiere = pas.findIndex(({ e }) => (e.choix.length ? !av.reponses[e.id] : !av.faites.includes(e.id)));
    return premiere < 0 ? max : premiere;
  });
  const debut = useRef<{ x: number; y: number } | null>(null);
  const voix = useVoix();
  const [lecture, setLecture] = useState(() => localStorage.getItem('kiavik.parcours.voix') === '1');
  const ici = Math.min(i, max);

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

  // lecture à voix haute de la consigne (et des réponses possibles) à chaque étape (bouton 🔊)
  const etapeLue = pas[ici]?.e;
  const { dire, arreter } = voix;
  useEffect(() => {
    if (!lecture || !etapeLue) return;
    const { texte } = decouperEtape(etapeLue.texte);
    const reponses = etapeLue.choix.map((c) => c.libelle).join(', ');
    dire([texte, etapeLue.avertissement, reponses].filter(Boolean).join('. '), 1);
    return () => arreter();
  }, [lecture, etapeLue, dire, arreter]);
  const basculerLecture = () => {
    const b = !lecture;
    if (b) voix.activer(true);
    setLecture(b);
    localStorage.setItem('kiavik.parcours.voix', b ? '1' : '0');
  };

  useEffect(() => {
    localStorage.setItem(cle, String(ici));
  }, [cle, ici]);
  useEffect(() => {
    const touche = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onFermer();
      if (ev.key === 'ArrowRight') setI((x) => Math.min(max, x + 1));
      if (ev.key === 'ArrowLeft') setI((x) => Math.max(0, Math.min(x, max) - 1));
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [max, onFermer]);

  const suivant = () => setI(Math.min(ici + 1, n));
  const precedent = () => setI(Math.max(0, ici - 1));
  // glisser au doigt : gauche = étape suivante, droite = précédente
  const auDebut = (ev: TouchEvent) => (debut.current = { x: ev.touches[0].clientX, y: ev.touches[0].clientY });
  const aLaFin = (ev: TouchEvent) => {
    const d = debut.current;
    debut.current = null;
    if (!d) return;
    const dx = ev.changedTouches[0].clientX - d.x;
    const dy = ev.changedTouches[0].clientY - d.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) setI(Math.min(max, ici + 1));
    else precedent();
  };

  const nbPrincipales = p.etapes.filter((x) => !x.brancheId).length || 1;
  const pasIci = ici < n ? pas[ici] : undefined;
  const e = pasIci?.e;
  const { partie, texte } = e ? decouperEtape(e.texte) : { partie: null, texte: '' };
  const progres = pasIci ? pasIci.principal / nbPrincipales : 1;
  const reponse = e?.choix.find((c) => c.id === av.reponses[e.id]);

  return (
    <div className="pg" role="dialog" aria-modal="true" aria-label={p.titre}>
      <div className="pg-tete">
        <button type="button" className="gx-ic" aria-label={t('commun.fermer')} onClick={onFermer}>✕</button>
        <div className="pg-num">
          {pasIci ? <b>{t('kiavik.parcours.etape', { i: pasIci.principal + 1, n: nbPrincipales })}</b> : <b>{p.titre}</b>}
          {pasIci && pasIci.profondeur > 0 ? <small className="dg-etiquette">{t('kiavik.diagnostic.verification')}</small> : partie && <small>{partie}</small>}
          <div className="gx-progres"><i style={{ width: `${progres * 100}%` }} /></div>
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
            {e.controle && av.non.includes(e.id) && <AideNon e={e} />}
            {e.photos.length ? (
              <Galerie key={e.id} photos={e.photos} className="pg-photo" />
            ) : e.guide && e.ecran ? (
              <CaptureBouton key={e.id} guide={e.guide} ecran={e.ecran} pastille={e.pastille} zoomDepart />
            ) : null}
            {e.photo && e.guide && e.ecran && <CaptureBouton key={`${e.id}-c`} guide={e.guide} ecran={e.ecran} pastille={e.pastille} />}
            <PasClair key={`${e.id}-pc`} etape={e.id} />
          </div>
          {e.choix.length > 0 ? (
            <div className="pg-pied dg-pied">
              <button type="button" className="btn" aria-label={t('kiavik.parcours.precedente')} disabled={ici === 0} onClick={precedent}>◀</button>
              <div className={`dg-reponses n${Math.min(e.choix.length, 4)}`}>
                {e.choix.map((c) => (
                  <button key={c.id} type="button" className={`btn ${reponse?.id === c.id ? 'prim' : ''}`}
                    onClick={() => { av.repondre(e.id, c.id); setI(ici + 1); }}>
                    {c.libelle}
                  </button>
                ))}
              </div>
            </div>
          ) : e.controle ? (
            <div className="pg-pied ct-oui-non grand">
              <button type="button" className="btn" aria-label={t('kiavik.parcours.precedente')} disabled={ici === 0} onClick={precedent}>◀</button>
              <button type="button" className={`btn ct-oui ${av.faites.includes(e.id) ? 'choisi' : ''}`} onClick={() => { av.controler(e.id, true); suivant(); }}>{t('kiavik.controle.oui')}</button>
              <button type="button" className={`btn ct-non ${av.non.includes(e.id) ? 'choisi' : ''}`} onClick={() => av.controler(e.id, false)}>{t('kiavik.controle.non')}</button>
            </div>
          ) : (
            <div className="pg-pied">
              <button type="button" className="btn" aria-label={t('kiavik.parcours.precedente')} disabled={ici === 0} onClick={precedent}>◀</button>
              <button type="button" className="btn prim" onClick={() => { av.cocher(e.id); suivant(); }}>
                {av.faites.includes(e.id) ? t('kiavik.parcours.suivante') : t('kiavik.parcours.faitSuivant')}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="pg-corps">
          <FinDiagnostic p={p} av={av} guide>
            <button type="button" className="btn prim large" onClick={onFermer}>{t('kiavik.parcours.retourListe')}</button>
            <button type="button" className="btn" onClick={() => { av.recommencer(); setI(0); }}>{t('kiavik.procedures.recommencer')}</button>
            {n > 0 && <button type="button" className="btn-lien petit" onClick={precedent}>{t('kiavik.diagnostic.revenir')}</button>}
          </FinDiagnostic>
        </div>
      )}
    </div>
  );
}
