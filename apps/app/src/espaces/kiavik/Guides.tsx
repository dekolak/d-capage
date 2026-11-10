import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { ResumeGuide } from './guides';

/** Liste des guides du compte (selon ses modules). Un seul guide → ouvert directement. */
export default function Guides() {
  const [guides, setGuides] = useState<ResumeGuide[]>();
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    api<ResumeGuide[]>('/guides').then(setGuides).catch(setErreur);
  }, []);
  if (erreur) return <div className="page"><Erreur e={erreur} /></div>;
  if (!guides) return <Chargement />;
  if (guides.length === 1) return <Navigate to={`/guides/${guides[0].slug}`} replace />;
  return (
    <div className="page">
      <h1>Guides</h1>
      {guides.length ? (
        <div className="liste-modules">
          {guides.map((g) => (
            <Link key={g.slug} to={`/guides/${g.slug}`} className="carte gx-carte">
              <b>{g.nom}</b>
              {g.description && <span className="muted petit">{g.description}</span>}
              <span className="muted petit">{g.ecrans} écrans</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted">Aucun guide n'est activé sur votre compte.</p>
      )}
    </div>
  );
}
