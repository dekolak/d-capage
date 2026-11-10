import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { ResumeGuide } from './guides';
import { useProcedures } from './donneesProcedures';
import { ListeProcedures } from './Procedures';
import './guides.css';

/** Accueil Kiavik : les guides du compte côte à côte en haut, les procédures en dessous. */
export default function Guides() {
  const { liste: procedures, acces: accesProcedures } = useProcedures();
  const [guides, setGuides] = useState<ResumeGuide[]>();
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    api<ResumeGuide[]>('/guides').then(setGuides).catch(setErreur);
  }, []);
  if (erreur) return <div className="page"><Erreur e={erreur} /></div>;
  if (!guides) return <Chargement />;
  return (
    <div className="page">
      {guides.length > 0 && (
        <>
          <h1>Logiciels</h1>
          {guides.length > 1 && (
            <div className="gx-chemin" aria-label="Le chemin d'une impression">
              <span>🖼️ Image</span>›<span>1. {guides[0].nom.split(' ')[0]}</span>›<span>Fichier RIPé</span>›<span>2. {guides[1].nom.split(' ')[0]}</span>›<span>🧱 Mur</span>
            </div>
          )}
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
      {accesProcedures && (
        <>
          <h2>Procédures</h2>
          {!procedures ? (
            <Chargement />
          ) : procedures.length ? (
            <ListeProcedures liste={procedures} />
          ) : (
            <div className="carte"><span className="muted">Aucune procédure pour l'instant.</span></div>
          )}
        </>
      )}
      {!guides.length && !accesProcedures && <p className="muted">Aucun guide n'est activé sur votre compte.</p>}
    </div>
  );
}
