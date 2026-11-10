import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ResumeGuide } from './guides';
import './guides.css';

/** Accueil Kiavik : les guides du compte côte à côte en haut, les procédures en dessous. */
export default function Guides() {
  const { moi } = useAuth();
  const [guides, setGuides] = useState<ResumeGuide[]>();
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    api<ResumeGuide[]>('/guides').then(setGuides).catch(setErreur);
  }, []);
  const procedures = moi?.role === 'ADMIN' || moi?.modules.includes('procedures-kiavik');
  if (erreur) return <div className="page"><Erreur e={erreur} /></div>;
  if (!guides) return <Chargement />;
  return (
    <div className="page">
      {guides.length > 0 && (
        <>
          <h1>Logiciels</h1>
          <div className={`gx-tuiles ${guides.length === 1 ? 'une' : ''}`}>
            {guides.map((g, i) => (
              <Link key={g.slug} to={`/guides/${g.slug}`} className="carte gx-tuile">
                {guides.length > 1 && <span className="gx-etape">{i + 1}</span>}
                <b>{g.nom}</b>
                {g.description && <span className="muted petit">{g.description}</span>}
              </Link>
            ))}
          </div>
        </>
      )}
      {procedures && (
        <>
          <h2>Procédures</h2>
          <div className="carte"><span className="muted">Les procédures arrivent bientôt.</span></div>
        </>
      )}
      {!guides.length && !procedures && <p className="muted">Aucun guide n'est activé sur votre compte.</p>}
    </div>
  );
}
