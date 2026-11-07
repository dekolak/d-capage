import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface Annonce { id: string; titre: string; texte: string; niveau: 'CONSEIL' | 'INFO' | 'IMPORTANT'; lienUrl: string | null; lienTexte: string | null }
export const ICONE = { CONSEIL: '💡', INFO: 'ℹ️', IMPORTANT: '⚠️' } as const;

/** Une bulle de message (aussi utilisée pour l'aperçu dans l'admin). */
export function Bulle({ a, onCompris }: { a: Pick<Annonce, 'titre' | 'texte' | 'niveau' | 'lienUrl' | 'lienTexte'>; onCompris?: () => void }) {
  return (
    <div className={'bulle-annonce ' + a.niveau.toLowerCase()}>
      <span className="ba-ic">{ICONE[a.niveau]}</span>
      <div className="ba-corps">
        <b>{a.titre || 'Titre du message'}</b>
        <p>{a.texte || 'Texte du message…'}</p>
        <div className="ba-actions">
          {a.lienUrl && (
            <a href={a.lienUrl} target="_blank" rel="noreferrer" className="btn petit">{a.lienTexte || 'En savoir plus'}</a>
          )}
          <button type="button" className="btn petit prim" onClick={onCompris}>J'ai compris</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Messages de Lazzeko à l'ouverture de l'app : bulles en haut de l'écran,
 * message « Important » en grand (à fermer pour continuer). Pas de réponse possible.
 */
export function Annonces() {
  const [liste, setListe] = useState<Annonce[]>([]);
  const [tout, setTout] = useState(false);
  const charger = useCallback(() => api<Annonce[]>('/annonces').then(setListe).catch(() => {}), []);
  useEffect(() => {
    charger();
    // L'app revient au premier plan (téléphone déverrouillé…) : on vérifie s'il y a du nouveau.
    const f = () => document.visibilityState === 'visible' && charger();
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [charger]);

  const compris = (id: string) => {
    setListe((l) => l.filter((x) => x.id !== id));
    api(`/annonces/${id}/compris`, { method: 'POST' }).catch(() => {});
  };

  const important = liste.find((a) => a.niveau === 'IMPORTANT');
  const autres = liste.filter((a) => a.niveau !== 'IMPORTANT');
  return (
    <>
      {autres.length > 0 && (
        <div className="annonces">
          {(tout ? autres : autres.slice(0, 2)).map((a) => <Bulle key={a.id} a={a} onCompris={() => compris(a.id)} />)}
          {!tout && autres.length > 2 && (
            <button type="button" className="btn-lien petit" onClick={() => setTout(true)}>Voir les {autres.length - 2} autres messages</button>
          )}
        </div>
      )}
      {important && (
        <div className="annonce-fond" role="dialog" aria-modal="true">
          <Bulle a={important} onCompris={() => compris(important.id)} />
        </div>
      )}
    </>
  );
}
