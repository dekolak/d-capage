import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t, tn } from '../../lib/i18n';
import { useProcedures, useSolutions } from './donneesProcedures';
import { ResumeGuide } from './guides';
import { ListeProcedures } from './Procedures';
import { ListeSolutions } from './Solutions';
import './guides.css';
import './accueil.css';

/**
 * Accueil Kiavik : recherche, les logiciels (miniature de l'écran, dans l'ordre du travail),
 * les procédures guidées (animations), les astuces & solutions et les procédures.
 */
export default function Guides() {
  const { moi } = useAuth();
  const { liste: procedures, acces: accesProcedures } = useProcedures();
  const { liste: solutions } = useSolutions();
  const [guides, setGuides] = useState<ResumeGuide[]>();
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    api<ResumeGuide[]>('/guides').then(setGuides).catch(setErreur);
  }, []);
  if (erreur) return <div className="page"><Erreur e={erreur} /></div>;
  if (!guides) return <Chargement />;
  const prenom = moi?.nom?.split(' ')[0];
  const guidees = guides.flatMap((g) => g.animations.map((a) => ({ ...a, guide: g.slug })));

  return (
    <div className="page kh">
      <header className="kh-tete">
        <h1>{prenom ? t('kiavik.accueil.bonjour', { nom: prenom }) : t('kiavik.accueil.bonjourSans')}</h1>
        <p className="muted">{t('kiavik.accueil.question')}</p>
        <Link to="/recherche" className="kh-recherche">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3" /></svg>
          <span>{t('kiavik.accueil.rechercher')}</span>
        </Link>
      </header>

      {guides.length > 0 && (
        <section>
          <h2>{t('kiavik.accueil.vosLogiciels')}</h2>
          <div className={`kh-logiciels ${guides.length === 1 ? 'un' : ''}`}>
            {guides.map((g, i) => (
              <Link key={g.slug} to={`/guides/${g.slug}`} className="kh-logiciel">
                <span className="kh-ecran">
                  {g.miniature ? <img src={g.miniature} alt="" loading="lazy" /> : <span className="kh-vide" />}
                  {guides.length > 1 && <span className="kh-num">{i + 1}</span>}
                </span>
                <span className="kh-nom">
                  <b>{g.nomCourt}</b>
                  {g.role && <small>{g.role}</small>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {guidees.length > 0 && (
        <section>
          <div className="kh-titre">
            <h2>{t('kiavik.accueil.proceduresGuidees')}</h2>
            <span className="muted petit">{t('kiavik.accueil.proceduresGuideesIntro')}</span>
          </div>
          <div className="kh-defile">
            {guidees.map((a) => (
              <Link key={`${a.guide}/${a.id}`} to={`/guides/${a.guide}/animation/${a.id}`} className="kh-guidee">
                <span className="kh-image">
                  {a.image && <img src={a.image} alt="" loading="lazy" />}
                  <span className="kh-play">▶</span>
                </span>
                <b>{a.titre}</b>
                {a.nbScenes ? <small className="muted">{tn('kiavik.accueil.scenes', a.nbScenes)}</small> : null}
              </Link>
            ))}
          </div>
        </section>
      )}

      {accesProcedures && solutions && solutions.length > 0 && (
        <section>
          <div className="kh-titre">
            <h2>{t('kiavik.solutions.titre')}</h2>
            {solutions.length > 3 && <Link to="/solutions" className="lien petit">{t('kiavik.accueil.toutVoir')}</Link>}
          </div>
          <ListeSolutions liste={solutions.slice(0, 3)} />
        </section>
      )}

      {accesProcedures && (
        <section>
          <div className="kh-titre">
            <h2>{t('kiavik.accueil.procedures')}</h2>
            {procedures && procedures.length > 4 && <Link to="/procedures" className="lien petit">{t('kiavik.accueil.toutVoir')}</Link>}
          </div>
          {!procedures ? (
            <Chargement />
          ) : procedures.length ? (
            <ListeProcedures liste={procedures.slice(0, 4)} />
          ) : (
            <div className="carte"><span className="muted">{t('kiavik.accueil.aucuneProcedure')}</span></div>
          )}
        </section>
      )}
      {!guides.length && !accesProcedures && <p className="muted">{t('kiavik.accueil.aucunGuide')}</p>}
    </div>
  );
}
