import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useEspace } from '../lib/espace';
import { t, tn } from '../lib/i18n';

interface Rappel {
  machine: { id: string; nom: string; surnom: string | null };
  tache: { id: string; titre: string; jours: number; photo: 'non' | 'facultative' | 'obligatoire'; photoConsigne: string | null; procedure: { id: string; titre: string } | null };
}
const DELAIS = [2, 7, 30] as const;

/**
 * Rappels du carnet d'entretien, à l'ouverture de l'app : une bulle par tâche à faire (jour J ou en retard).
 * Oui → date (la tâche est notée, l'échéance repart de là) ; Non → faire le pas-à-pas ; « Me le rappeler dans… ».
 */
export function RappelsEntretien() {
  const [liste, setListe] = useState<Rappel[]>([]);
  const charger = useCallback(() => api<Rappel[]>('/moi/carnet/rappels').then(setListe).catch(() => {}), []);
  useEffect(() => {
    charger();
    const f = () => document.visibilityState === 'visible' && charger();
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [charger]);
  const retirer = (r: Rappel) => setListe((l) => l.filter((x) => !(x.machine.id === r.machine.id && x.tache.id === r.tache.id)));
  if (!liste.length) return null;
  return (
    <div className="annonces">
      {liste.slice(0, 2).map((r) => <Bulle key={`${r.machine.id}:${r.tache.id}`} r={r} onFini={() => retirer(r)} />)}
      {liste.length > 2 && <Link to="/carnet" className="btn-lien petit">{tn('rappel.autres', liste.length - 2)}</Link>}
    </div>
  );
}

function Bulle({ r, onFini }: { r: Rappel; onFini: () => void }) {
  const [etape, setEtape] = useState<'question' | 'oui' | 'non'>('question');
  const [jour, setJour] = useState(new Date().toISOString().slice(0, 10));
  const [envoi, setEnvoi] = useState(false);
  const [merci, setMerci] = useState(false);
  const nav = useNavigate();
  const { espace } = useEspace();
  const machine = r.machine.surnom || r.machine.nom;

  const fait = async () => {
    setEnvoi(true);
    try {
      await api(`/moi/carnet/${r.machine.id}/faits`, { method: 'POST', json: { tacheId: r.tache.id, date: jour } });
      setMerci(true);
      setTimeout(onFini, 1500);
    } catch {
      setEnvoi(false);
    }
  };
  const reporter = (jours: number) => {
    api(`/moi/carnet/${r.machine.id}/reporter`, { method: 'POST', json: { tacheId: r.tache.id, jours } }).catch(() => {});
    onFini();
  };
  const pasAPas = () => {
    const p = r.tache.procedure!;
    for (const k of ['etapes', 'controles', 'reponses', 'envoye', 'envoyePlusTard', 'session', 'parcours']) localStorage.removeItem(`kiavik.${k}.${p.id}`);
    localStorage.setItem(`kiavik.carnet.${p.id}`, JSON.stringify({ machine: r.machine.id, tache: r.tache.id, photo: r.tache.photo === 'obligatoire' }));
    onFini();
    nav(`/procedures/${p.id}`, { state: { parcours: true } });
  };

  return (
    <div className="bulle-annonce conseil rappel-entretien">
      <span className="ba-ic">🔧</span>
      <div className="ba-corps">
        <b>{t('rappel.titre', { tache: r.tache.titre })}</b>
        <p className="petit muted">{machine}{r.tache.jours < 0 ? ` · ${tn('carnet.enRetard', -r.tache.jours)}` : ''}</p>
        {merci ? (
          <p className="succes">{t('rappel.merci')}</p>
        ) : etape === 'question' ? (
          <div className="ba-question">
            <b>{t('rappel.question')}</b>
            <div className="ba-choix deux-col">
              <button type="button" onClick={() => setEtape('oui')}>{t('messages.oui')}</button>
              <button type="button" onClick={() => setEtape('non')}>{t('messages.non')}</button>
            </div>
          </div>
        ) : etape === 'oui' ? (
          r.tache.photo === 'obligatoire' ? (
            <div className="ba-actions">
              <Link to={`/carnet/${r.machine.id}?noter=${r.tache.id}`} className="btn petit prim" onClick={onFini}>{t('carnet.noterAvecPhoto')}</Link>
            </div>
          ) : (
            <div className="ba-date">
              <label>{t('rappel.quand')}<input type="date" value={jour} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setJour(e.target.value)} /></label>
              <div className="ba-choix deux-col">
                <button type="button" onClick={() => setEtape('question')}>{t('carnet.annuler')}</button>
                <button type="button" className="prim" disabled={envoi || !jour} onClick={fait}>{t('carnet.enregistrer')}</button>
              </div>
            </div>
          )
        ) : (
          <div className="ba-actions">
            {r.tache.procedure && espace.slug === 'kiavik' ? (
              <button type="button" className="btn petit prim" onClick={pasAPas}>{t('messages.faireMaintenant')}</button>
            ) : (
              <Link to={`/carnet/${r.machine.id}`} className="btn petit" onClick={onFini}>{t('carnet.lien')}</Link>
            )}
          </div>
        )}
        {!merci && (
          <div className="rappel-plus-tard">
            <small className="muted">{t('rappel.plusTard')}</small>
            {DELAIS.map((j) => <button key={j} type="button" className="btn petit" onClick={() => reporter(j)}>{t(`rappel.dans.${j}`)}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}
