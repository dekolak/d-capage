import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { langue, t } from '../../lib/i18n';
import './guides.css';
import './parcours.css';

interface MonDiagnostic {
  id: string; message: string | null; createdAt: string;
  resultat: { chemin: { question: string; reponse: string }[]; fin: { type: 'termine' | 'resolu' | 'contact' | 'en_cours'; conclusion?: string } };
  procedure: { id: string; titre: string };
}
const ICONE = { termine: '🎉', resolu: '✅', contact: '📞', en_cours: '⏳' } as const;

/** « Mes diagnostics » : les résultats que le client a envoyés à Kiavik. */
export default function MesDiagnostics() {
  const [liste, setListe] = useState<MonDiagnostic[]>();
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    api<MonDiagnostic[]>('/procedures/diagnostics/miens').then(setListe).catch(setErreur);
  }, []);
  if (erreur) return <div className="page"><Erreur e={erreur} /></div>;
  if (!liste) return <Chargement />;
  return (
    <div className="page gx">
      <Link to="/procedures" className="btn-lien">{t('kiavik.procedures.retourListe')}</Link>
      <h1>{t('kiavik.diagnostic.mesDiagnostics')}</h1>
      {liste.length === 0 ? (
        <p className="muted">{t('kiavik.diagnostic.aucunEnvoi')}</p>
      ) : (
        <div className="gx-resultats">
          {liste.map((d) => {
            const fin = d.resultat.fin;
            return (
              <div key={d.id} className="carte md-carte">
                <div className="gx-etape-tete">
                  <Link to={`/procedures/${d.procedure.id}`}><b>{d.procedure.titre}</b></Link>
                  <small className="muted">{new Date(d.createdAt).toLocaleDateString(langue(), { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                </div>
                <b className={`md-fin md-${fin.type}`}>
                  {ICONE[fin.type] ?? '🩺'} {fin.type === 'en_cours' ? t('kiavik.diagnostic.nonTermine') : t(`kiavik.diagnostic.fin.${fin.type}`)}
                </b>
                {fin.conclusion && <p className="petit">{fin.conclusion}</p>}
                <ul className="md-reponses">
                  {d.resultat.chemin.map((l, k) => (
                    <li key={k}>{l.question} <b>{l.reponse}</b></li>
                  ))}
                </ul>
                {d.message && <p className="petit muted">💬 {d.message}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
