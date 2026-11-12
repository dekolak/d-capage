import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t, tn } from '../../lib/i18n';
import { trierCategories, useCategories, useProcedures, useSolutions } from './donneesProcedures';
import { ResumeGuide } from './guides';
import { ListeProcedures } from './Procedures';
import { ListeSolutions } from './Solutions';
import './guides.css';
import './accueil.css';

const CLE_OUVERTES = 'kiavik.accueil.ouvertes';

/**
 * Accueil Kiavik : recherche, les logiciels (miniature de l'écran, dans l'ordre du travail, toujours visibles),
 * puis une section repliable par catégorie (Mise en route, Diagnostic, Impression…) avec ses procédures guidées
 * (animations), procédures, diagnostics et astuces. Une seule section ouverte à la fois, gardée sur le téléphone.
 */
export default function Guides() {
  const { moi } = useAuth();
  const { liste: procedures, acces: accesProcedures } = useProcedures();
  const { liste: solutions } = useSolutions();
  const cats = useCategories();
  const [guides, setGuides] = useState<ResumeGuide[]>();
  const [erreur, setErreur] = useState<unknown>();
  const [ouvertes, setOuvertes] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CLE_OUVERTES) ?? '[]');
    } catch {
      return [];
    }
  });
  useEffect(() => {
    api<ResumeGuide[]>('/guides').then(setGuides).catch(setErreur);
  }, []);
  if (erreur) return <div className="page"><Erreur e={erreur} /></div>;
  if (!guides) return <Chargement />;
  const prenom = moi?.nom?.split(' ')[0];
  // démos animées de tous les logiciels, dans l'ordre choisi par l'admin
  const guidees = guides.flatMap((g) => g.animations.map((a) => ({ ...a, guide: g.slug }))).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  // sections par catégorie : procédures guidées (animations), procédures et diagnostics, astuces
  // ordre, icônes et sections masquées : Administration → Accueil et catégories
  const masquees = (cats ?? []).filter((c) => c.masquee).map((c) => c.nom);
  const categories = trierCategories([
    ...guidees.map((a) => a.categorie ?? ''),
    ...(accesProcedures ? [...(procedures ?? []).map((p) => p.categorie), ...(solutions ?? []).map((x) => x.categorie)] : []),
  ], cats).filter((c) => !masquees.includes(c));
  const basculer = (cat: string) => {
    // une seule section ouverte à la fois : en ouvrir une ferme les autres
    const l = ouvertes.includes(cat) ? [] : [cat];
    setOuvertes(l);
    localStorage.setItem(CLE_OUVERTES, JSON.stringify(l));
  };

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

      {categories.map((cat) => {
        const anims = guidees.filter((a) => (a.categorie ?? '') === cat);
        const procs = (procedures ?? []).filter((p) => p.categorie === cat);
        const astuces = (solutions ?? []).filter((s) => s.categorie === cat);
        const ouverte = ouvertes.includes(cat);
        return (
          <section key={cat} className={`kh-cat ${ouverte ? 'ouverte' : ''}`}>
            <button type="button" className="kh-cat-tete" aria-expanded={ouverte} onClick={() => basculer(cat)}>
              <span className="kh-cat-icone" aria-hidden="true">{cats?.find((c) => c.nom === cat)?.icone ?? '📁'}</span>
              <span className="kh-cat-nom">
                <b>{cat || t('kiavik.accueil.autres')}</b>
                <small>
                  {[
                    anims.length && tn('kiavik.accueil.nbAnimations', anims.length),
                    procs.length && tn('kiavik.accueil.nbProcedures', procs.length),
                    astuces.length && tn('kiavik.accueil.nbAstuces', astuces.length),
                  ].filter(Boolean).join(' · ')}
                </small>
              </span>
              <span className="kh-cat-chevron" aria-hidden="true">›</span>
            </button>
            {ouverte && (
              <div className="kh-cat-corps">
                {anims.length > 0 && (
                  <div className="kh-defile">
                    {anims.map((a) => (
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
                )}
                {procs.length > 0 && <ListeProcedures liste={procs} />}
                {astuces.length > 0 && <ListeSolutions liste={astuces} />}
              </div>
            )}
          </section>
        );
      })}

      {accesProcedures && (
        <nav className="kh-tout">
          <Link to="/procedures" className="lien petit">{t('kiavik.accueil.toutesProcedures')}</Link>
          {solutions && solutions.length > 0 && <Link to="/solutions" className="lien petit">{t('kiavik.accueil.toutesAstuces')}</Link>}
        </nav>
      )}
      {accesProcedures && procedures && !procedures.length && !guidees.length && (
        <div className="carte"><span className="muted">{t('kiavik.accueil.aucuneProcedure')}</span></div>
      )}
      {!guides.length && !accesProcedures && <p className="muted">{t('kiavik.accueil.aucunGuide')}</p>}
    </div>
  );
}
