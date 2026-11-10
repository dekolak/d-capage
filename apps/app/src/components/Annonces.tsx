import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useEspace } from '../lib/espace';
import { t, tn } from '../lib/i18n';

export type TypeQuestion = 'AUCUNE' | 'OUI_NON' | 'CHOIX' | 'NOTE' | 'TEXTE';
export interface Question { type: TypeQuestion; texte: string | null; options: string[]; autre: boolean; obligatoire: boolean }
export interface Annonce {
  id: string; titre: string; texte: string; niveau: 'CONSEIL' | 'INFO' | 'IMPORTANT'; lienUrl: string | null; lienTexte: string | null;
  question?: Question;
}
export const ICONE = { CONSEIL: '💡', INFO: 'ℹ️', IMPORTANT: '⚠️' } as const;

/** Réponse en un toucher (ou un champ court) : Oui / Non, choix, note, texte libre. */
function Repondre({ q, onRepondre, apercu }: { q: Question; onRepondre?: (v: string, autre?: string) => void; apercu?: boolean }) {
  const [autre, setAutre] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  const { espace } = useEspace();
  const envoyer = (v: string, a?: string) => !apercu && onRepondre?.(v, a);
  return (
    <div className="ba-question">
      <b>{q.texte || t('messages.votreQuestion')}</b>
      {q.type === 'OUI_NON' && (
        <div className="ba-choix deux-col">
          <button type="button" onClick={() => envoyer('oui')}>{t('messages.oui')}</button>
          <button type="button" onClick={() => envoyer('non')}>{t('messages.non')}</button>
        </div>
      )}
      {q.type === 'CHOIX' && autre === null && (
        <div className="ba-choix">
          {(q.options.length ? q.options : [t('messages.reponseN', { n: 1 }), t('messages.reponseN', { n: 2 })]).map((o, i) => (
            <button key={i} type="button" onClick={() => envoyer(o)}>{o || t('messages.reponseN', { n: i + 1 })}</button>
          ))}
          {q.autre && <button type="button" onClick={() => setAutre('')}>{t('messages.autre')}</button>}
        </div>
      )}
      {q.type === 'CHOIX' && autre !== null && (
        <div className="ba-libre">
          <input autoFocus value={autre} maxLength={300} onChange={(e) => setAutre(e.target.value)} placeholder={t('messages.precisez')} />
          <button type="button" className="btn petit prim" disabled={!autre.trim()} onClick={() => envoyer('Autre', autre)}>{t('messages.envoyer')}</button>
        </div>
      )}
      {q.type === 'NOTE' && (
        <div className="ba-etoiles">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={tn('commun.etoiles', n)} onClick={() => envoyer(String(n))}>★</button>
          ))}
        </div>
      )}
      {q.type === 'TEXTE' && (
        <div className="ba-libre">
          <input value={texte} maxLength={1000} onChange={(e) => setTexte(e.target.value)} placeholder={t('messages.votreReponse')} />
          <button type="button" className="btn petit prim" disabled={!texte.trim()} onClick={() => envoyer(texte.trim())}>{t('messages.envoyer')}</button>
        </div>
      )}
      <small className="muted">{t('messages.visiblePar', { societe: espace.nom })}</small>
    </div>
  );
}

/** Une bulle de message (aussi utilisée pour l'aperçu dans l'admin). */
export function Bulle({ a, onCompris, onRepondre, apercu }: {
  a: Pick<Annonce, 'titre' | 'texte' | 'niveau' | 'lienUrl' | 'lienTexte' | 'question'>;
  onCompris?: () => void; onRepondre?: (v: string, autre?: string) => void; apercu?: boolean;
}) {
  const q = a.question && a.question.type !== 'AUCUNE' ? a.question : null;
  return (
    <div className={'bulle-annonce ' + a.niveau.toLowerCase()}>
      <span className="ba-ic">{ICONE[a.niveau]}</span>
      <div className="ba-corps">
        <b>{a.titre || t('messages.titreExemple')}</b>
        <p>{a.texte || t('messages.texteExemple')}</p>
        {q && <Repondre q={q} onRepondre={onRepondre} apercu={apercu} />}
        <div className="ba-actions">
          {a.lienUrl && a.lienUrl.startsWith('/') && (
            <Link to={a.lienUrl} onClick={apercu ? (e) => e.preventDefault() : onCompris} className="btn petit">{a.lienTexte || t('messages.voir')}</Link>
          )}
          {a.lienUrl && !a.lienUrl.startsWith('/') && (
            <a href={a.lienUrl} target="_blank" rel="noreferrer" className="btn petit">{a.lienTexte || t('messages.enSavoirPlus')}</a>
          )}
          {(!q || !q.obligatoire) && (
            <button type="button" className={'btn petit' + (q ? '' : ' prim')} onClick={() => !apercu && onCompris?.()}>
              {q ? t('messages.passer') : t('messages.compris')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Messages de l'admin (Lazzeko ou Kiavik selon l'espace) à l'ouverture de l'app : bulles en haut de l'écran,
 * message « Important » en grand (à fermer pour continuer). Pas de réponse libre au-delà de la question posée.
 */
export function Annonces() {
  const [liste, setListe] = useState<Annonce[]>([]);
  const [tout, setTout] = useState(false);
  const [merci, setMerci] = useState(false);
  const charger = useCallback(() => api<Annonce[]>('/annonces').then(setListe).catch(() => {}), []);
  useEffect(() => {
    charger();
    // L'app revient au premier plan (téléphone déverrouillé…) : on vérifie s'il y a du nouveau.
    const f = () => document.visibilityState === 'visible' && charger();
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [charger]);

  const retirer = (id: string) => setListe((l) => l.filter((x) => x.id !== id));
  const compris = (id: string) => {
    retirer(id);
    api(`/annonces/${id}/compris`, { method: 'POST' }).catch(() => {});
  };
  const repondre = (id: string, valeur: string, autre?: string) => {
    retirer(id);
    setMerci(true);
    setTimeout(() => setMerci(false), 2500);
    api(`/annonces/${id}/reponse`, { method: 'POST', json: { valeur, autre } }).catch(() => {});
  };

  const important = liste.find((a) => a.niveau === 'IMPORTANT');
  const autres = liste.filter((a) => a.niveau !== 'IMPORTANT');
  return (
    <>
      {merci && <div className="merci">{t('messages.merci')}</div>}
      {autres.length > 0 && (
        <div className="annonces">
          {(tout ? autres : autres.slice(0, 2)).map((a) => (
            <Bulle key={a.id} a={a} onCompris={() => compris(a.id)} onRepondre={(v, x) => repondre(a.id, v, x)} />
          ))}
          {!tout && autres.length > 2 && (
            <button type="button" className="btn-lien petit" onClick={() => setTout(true)}>{tn('messages.voirAutres', autres.length - 2)}</button>
          )}
        </div>
      )}
      {important && (
        <div className="annonce-fond" role="dialog" aria-modal="true">
          <Bulle a={important} onCompris={() => compris(important.id)} onRepondre={(v, x) => repondre(important.id, v, x)} />
        </div>
      )}
    </>
  );
}
