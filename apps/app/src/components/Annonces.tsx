import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useEspace } from '../lib/espace';
import { t, tn } from '../lib/i18n';

export type TypeQuestion = 'AUCUNE' | 'OUI_NON' | 'CHOIX' | 'NOTE' | 'TEXTE';
export interface Question {
  type: TypeQuestion; texte: string | null; options: string[]; autre: boolean; obligatoire: boolean;
  /** Oui / Non : demander ensuite une date après « non », « oui » ou « toujours ». */
  dateSi?: 'non' | 'oui' | 'toujours' | null; dateQuestion?: string | null;
}
/** Pas-à-pas lié (rappel d'entretien). */
export interface PasAPas { id: string; titre: string }
export interface Annonce {
  id: string; titre: string; texte: string; niveau: 'CONSEIL' | 'INFO' | 'IMPORTANT'; lienUrl: string | null; lienTexte: string | null;
  question?: Question;
  procedure?: PasAPas;
}
export const ICONE = { CONSEIL: '💡', INFO: 'ℹ️', IMPORTANT: '⚠️' } as const;

/** Réponse en un toucher (ou un champ court) : Oui / Non, choix, note, texte libre. */
function Repondre({ q, onRepondre, apercu }: { q: Question; onRepondre?: (v: string, autre?: string, date?: string) => void; apercu?: boolean }) {
  const [autre, setAutre] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  // Oui / Non suivi d'une date : la réponse choisie, en attendant la date
  const [choisi, setChoisi] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const { espace } = useEspace();
  const envoyer = (v: string, a?: string, d?: string) => !apercu && onRepondre?.(v, a, d);
  const ouiNon = (v: string) => (q.dateSi === 'toujours' || q.dateSi === v ? setChoisi(v) : envoyer(v));
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return (
    <div className="ba-question">
      <b>{q.texte || t('messages.votreQuestion')}</b>
      {q.type === 'OUI_NON' && choisi === null && (
        <div className="ba-choix deux-col">
          <button type="button" onClick={() => ouiNon('oui')}>{t('messages.oui')}</button>
          <button type="button" onClick={() => ouiNon('non')}>{t('messages.non')}</button>
        </div>
      )}
      {q.type === 'OUI_NON' && choisi !== null && (
        <div className="ba-date">
          <span className="petit">{choisi === 'oui' ? t('messages.oui') : t('messages.non')} · <button type="button" className="btn-lien petit" onClick={() => setChoisi(null)}>{t('messages.changer')}</button></span>
          <label>
            {q.dateQuestion || t('messages.dateQuestion')}
            <input type="date" value={date} max={aujourdhui} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="ba-choix deux-col">
            <button type="button" onClick={() => envoyer(choisi)}>{t('messages.jeNeSaisPlus')}</button>
            <button type="button" className="prim" disabled={!date} onClick={() => envoyer(choisi, undefined, date)}>{t('messages.envoyer')}</button>
          </div>
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
export function Bulle({ a, onCompris, onRepondre, onPasAPas, apercu }: {
  a: Pick<Annonce, 'titre' | 'texte' | 'niveau' | 'lienUrl' | 'lienTexte' | 'question' | 'procedure'>;
  onCompris?: () => void; onRepondre?: (v: string, autre?: string, date?: string) => void; onPasAPas?: () => void; apercu?: boolean;
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
          {/* pas-à-pas lié : bouton direct s'il n'y a pas de question (sinon proposé après « Non ») */}
          {a.procedure && !q && (
            <button type="button" className="btn petit prim" onClick={() => !apercu && onPasAPas?.()}>{t('messages.faireMaintenant')}</button>
          )}
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
  // rappel d'entretien répondu « Non » : on propose de faire le pas-à-pas tout de suite
  const [aFaire, setAFaire] = useState<{ annonce: string; procedure: PasAPas } | null>(null);
  const nav = useNavigate();
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
  const repondre = (id: string, valeur: string, autre?: string, dateFaite?: string) => {
    const a = liste.find((x) => x.id === id);
    retirer(id);
    if (valeur === 'non' && a?.procedure) setAFaire({ annonce: id, procedure: a.procedure });
    else {
      setMerci(true);
      setTimeout(() => setMerci(false), 2500);
    }
    api(`/annonces/${id}/reponse`, { method: 'POST', json: { valeur, autre, dateFaite } }).catch(() => {});
  };
  /** Ouvre le pas-à-pas ; à la fin, le téléphone dira qu'il est fait (historique d'entretien). */
  const faire = (annonce: string, procedure: PasAPas) => {
    // on repart de zéro : une ancienne progression ne doit pas compter comme faite
    for (const k of ['etapes', 'controles', 'reponses', 'envoye', 'envoyePlusTard', 'session', 'parcours']) localStorage.removeItem(`kiavik.${k}.${procedure.id}`);
    localStorage.setItem(`kiavik.rappel.${procedure.id}`, annonce);
    setAFaire(null);
    nav(`/procedures/${procedure.id}`);
  };

  const important = liste.find((a) => a.niveau === 'IMPORTANT');
  const autres = liste.filter((a) => a.niveau !== 'IMPORTANT');
  return (
    <>
      {merci && <div className="merci">{t('messages.merci')}</div>}
      {aFaire && (
        <div className="annonces">
          <div className="bulle-annonce conseil">
            <span className="ba-ic">🔧</span>
            <div className="ba-corps">
              <b>{t('messages.aFaire', { titre: aFaire.procedure.titre })}</b>
              <div className="ba-actions">
                <button type="button" className="btn petit prim" onClick={() => faire(aFaire.annonce, aFaire.procedure)}>{t('messages.faireMaintenant')}</button>
                <button type="button" className="btn petit" onClick={() => setAFaire(null)}>{t('messages.plusTard')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {autres.length > 0 && (
        <div className="annonces">
          {(tout ? autres : autres.slice(0, 2)).map((a) => (
            <Bulle key={a.id} a={a} onCompris={() => compris(a.id)} onRepondre={(v, x, d) => repondre(a.id, v, x, d)}
              onPasAPas={() => { compris(a.id); if (a.procedure) faire(a.id, a.procedure); }} />
          ))}
          {!tout && autres.length > 2 && (
            <button type="button" className="btn-lien petit" onClick={() => setTout(true)}>{tn('messages.voirAutres', autres.length - 2)}</button>
          )}
        </div>
      )}
      {important && (
        <div className="annonce-fond" role="dialog" aria-modal="true">
          <Bulle a={important} onCompris={() => compris(important.id)} onRepondre={(v, x, d) => repondre(important.id, v, x, d)}
            onPasAPas={() => { compris(important.id); if (important.procedure) faire(important.id, important.procedure); }} />
        </div>
      )}
    </>
  );
}
