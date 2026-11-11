import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { ResumeGuide } from './guides';
import { useProcedures, useSolutions } from './donneesProcedures';
import { ListeSolutions } from './Solutions';
import { ListeProcedures } from './Procedures';
import './guides.css';
import './animations.css';
import { t } from '../../lib/i18n';

/** Accueil Kiavik : les guides du compte côte à côte en haut, les procédures en dessous. */
export default function Guides() {
  const { liste: procedures, acces: accesProcedures } = useProcedures();
  const { liste: solutions } = useSolutions();
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
          <h1>{t('kiavik.accueil.logiciels')}</h1>
          {guides.length > 1 && (
            <div className="gx-chemin" aria-label="Le chemin d'une impression">
              <span>{t('kiavik.accueil.image')}</span>›<span>1. {guides[0].nom.split(' ')[0]}</span>›<span>{t('kiavik.accueil.fichierRip')}</span>›<span>2. {guides[1].nom.split(' ')[0]}</span>›<span>{t('kiavik.accueil.mur')}</span>
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
      {guides.some((g) => g.animations.length) && (
        <>
          <h2>{t('kiavik.accueil.animations')}</h2>
          <div className="an-cartes">
            {guides.flatMap((g) =>
              g.animations.map((a) => (
                <Link key={`${g.slug}/${a.id}`} to={`/guides/${g.slug}/animation/${a.id}`} className="carte an-carte">
                  <span className="an-img">{a.image && <img src={a.image} alt="" />}<span className="an-play">▶</span></span>
                  <b>{a.titre}</b>
                  {a.resume && <span className="muted petit">{a.resume}</span>}
                </Link>
              )),
            )}
          </div>
        </>
      )}
      {accesProcedures && solutions && solutions.length > 0 && (
        <>
          <h2>{t('kiavik.solutions.titre')}</h2>
          <ListeSolutions liste={solutions.slice(0, 3)} />
          {solutions.length > 3 && <p><Link to="/solutions" className="lien">{t('kiavik.solutions.toutes', { n: solutions.length })}</Link></p>}
        </>
      )}
      {accesProcedures && (
        <>
          <h2>{t('kiavik.accueil.procedures')}</h2>
          {!procedures ? (
            <Chargement />
          ) : procedures.length ? (
            <ListeProcedures liste={procedures} />
          ) : (
            <div className="carte"><span className="muted">{t('kiavik.accueil.aucuneProcedure')}</span></div>
          )}
        </>
      )}
      {!guides.length && !accesProcedures && <p className="muted">{t('kiavik.accueil.aucunGuide')}</p>}
    </div>
  );
}
