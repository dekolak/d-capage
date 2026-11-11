import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { t } from '../../lib/i18n';
import { Avancement } from './avancement';
import { decouperEtape } from './ProcedureDetail';
import { estDiagnostic, Procedure, useProcedures, useSolutions } from './donneesProcedures';

/** Questions répondues sur le chemin : « question : réponse ». */
export function resumeReponses(av: Avancement) {
  return av.chemin.pas.flatMap(({ e }) => {
    const c = e.choix.find((x) => x.id === av.reponses[e.id]);
    return c ? [{ question: decouperEtape(e.texte).texte, reponse: c.libelle }] : [];
  });
}

/** Fin d'un parcours : résultat (résolu, à contacter, terminé), conclusion, astuce ou procédure proposée, envoi du résultat. */
export function FinDiagnostic({ p, av, children }: { p: Procedure; av: Avancement; children?: React.ReactNode }) {
  const fin = av.chemin.fin;
  const choix = fin && fin.type !== 'termine' ? fin.choix : null;
  const { liste: astuces } = useSolutions();
  const { liste: procedures } = useProcedures();
  const astuce = choix?.solutionId ? astuces?.find((s) => s.id === choix.solutionId) : undefined;
  const autre = choix?.procedureCibleId ? procedures?.find((x) => x.id === choix.procedureCibleId) : undefined;
  const lignes = resumeReponses(av);
  if (!fin) return null;
  const type = fin.type;
  return (
    <div className={`dg-fin dg-${type}`}>
      <span className="dg-fin-icone" aria-hidden="true">{type === 'resolu' ? '✅' : type === 'contact' ? '📞' : '🎉'}</span>
      <b>{t(`kiavik.diagnostic.fin.${type}`)}</b>
      {choix?.conclusion && <p>{choix.conclusion}</p>}
      {type === 'termine' && !estDiagnostic(p) && <p className="muted">{t('kiavik.parcours.termineTexte', { fait: av.nbFaites, n: av.chemin.pas.length })}</p>}
      {astuce && <Link to={`/solutions/${astuce.id}`} className="btn petit">💡 {astuce.titre}</Link>}
      {autre && <Link to={`/procedures/${autre.id}`} className="btn petit">📋 {autre.titre}</Link>}
      {lignes.length > 0 && (
        <div className="dg-resume">
          <small>{t('kiavik.diagnostic.vosReponses')}</small>
          <ul>
            {lignes.map((l, k) => (
              <li key={k}>{l.question} <b>{l.reponse}</b></li>
            ))}
          </ul>
          <Envoyer p={p} av={av} contact={type === 'contact'} />
        </div>
      )}
      {children}
    </div>
  );
}

/** « Envoyer le résultat à Kiavik » : réponses + message facultatif. */
function Envoyer({ p, av, contact }: { p: Procedure; av: Avancement; contact: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState('');
  const [etat, setEtat] = useState<'' | 'envoi'>('');
  const [erreur, setErreur] = useState<unknown>();
  if (av.envoye)
    return (
      <p className="succes">
        {t('kiavik.diagnostic.envoye')} <Link to="/diagnostics">{t('kiavik.diagnostic.mesDiagnostics')}</Link>
      </p>
    );
  if (!ouvert)
    return (
      <button type="button" className={`btn ${contact ? 'prim' : ''}`} onClick={() => setOuvert(true)}>
        {t('kiavik.diagnostic.envoyer')}
      </button>
    );
  const envoyer = async () => {
    setEtat('envoi');
    setErreur(undefined);
    try {
      await api(`/procedures/${p.id}/diagnostic`, { method: 'POST', json: { reponses: av.reponses, message: message.trim() || undefined } });
      setEtat('');
      av.marquerEnvoye();
    } catch (e) {
      setErreur(e);
      setEtat('');
    }
  };
  return (
    <div className="dg-envoi">
      <textarea rows={3} value={message} placeholder={t('kiavik.diagnostic.message')} aria-label={t('kiavik.diagnostic.message')} onChange={(e) => setMessage(e.target.value)} />
      <Erreur e={erreur} />
      <button type="button" className="btn prim" disabled={etat === 'envoi'} onClick={envoyer}>
        {etat === 'envoi' ? t('kiavik.diagnostic.envoi') : t('kiavik.diagnostic.confirmer')}
      </button>
    </div>
  );
}
