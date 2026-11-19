import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { ImageApi } from '../espaces/kiavik/donneesProcedures';
import { api, ErreurApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';
import { t } from '../lib/i18n';
import { Blocs } from './Blocs';
import { Cours, Lecon, ResumeCours, useAccesAcademie } from './donnees';
import './academie.css';

/** Vignette d'un cours : couverture envoyée (protégée), sinon vignette de la première vidéo, sinon 🎓. */
function Vignette({ c }: { c: { couverture?: string; vignette?: string } }) {
  if (c.couverture) return <ImageApi chemin={c.couverture.replace(/^\/api/, '')} className="ac-vignette" />;
  if (c.vignette) return <img src={c.vignette} alt="" loading="lazy" className="ac-vignette" />;
  return <span className="ac-vignette ac-vignette-vide">🎓</span>;
}

/** Bandeau « 🎓 Académie » (accueil Lazzeko et Kiavik) : seul lien entre l'app et l'Académie. */
export function LienAcademie() {
  const acces = useAccesAcademie();
  if (!acces) return null;
  return (
    <Link to="/academie" className="bandeau lien-bandeau ac-lien">
      <span><b>{t('academie.titre')}</b> : {t('academie.resume')}</span>
      <span>›</span>
    </Link>
  );
}

/** Accueil de l'Académie : « Mes outils » (pages : simulateurs, fiches…) puis « Parcours » (formations en leçons). */
export function PageAcademie() {
  const [l, setL] = useState<ResumeCours[]>();
  const [err, setErr] = useState<unknown>();
  const { espace } = useEspace();
  const { moi } = useAuth();
  useEffect(() => {
    api<ResumeCours[]>('/academie').then(setL).catch(setErr);
  }, [espace.slug]);
  if (err) return <div className="page"><Erreur e={err} /></div>;
  if (!l) return <Chargement />;
  const pages = l.filter((c) => c.type === 'page');
  const parcours = l.filter((c) => c.type !== 'page');
  return (
    <div className="page ac">
      <h1>{t('academie.titre')}</h1>
      <p className="muted">{t('academie.intro')}</p>
      {moi?.role === 'ADMIN' && <Link to="/admin/academie" className="btn petit">⚙️ Gérer l'Académie (admin)</Link>}
      {!l.length && <p className="muted">{t('academie.aucun')}</p>}
      {pages.length > 0 && (
        <>
          <h2>{t('academie.outils')}</h2>
          <div className="ac-outils">
            {pages.map((c) => (
              <Link key={c.id} to={`/academie/${c.id}`} className="carte ac-outil">
                <Vignette c={c} />
                <span><b>{c.titre}{!c.publie && <span className="gx-brouillon"> · brouillon</span>}</b>{c.description && <small className="muted">{c.description}</small>}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      {parcours.length > 0 && (
        <>
          <h2>{t('academie.parcours')}</h2>
          <div className="ac-liste">
            {parcours.map((c) => (
              <Link key={c.id} to={`/academie/${c.id}`} className="carte ac-cours">
                <Vignette c={c} />
                <Infos c={c} />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Infos({ c }: { c: ResumeCours }) {
  const pct = c.nbLecons ? Math.round((c.faites / c.nbLecons) * 100) : 0;
  return (
    <span className="ac-infos">
      <b>{c.titre}{!c.publie && <span className="gx-brouillon"> · brouillon</span>}</b>
      {c.description && <small className="muted">{c.description}</small>}
      <small className="muted">
        {t('academie.nbLecons', { n: c.nbLecons })}
        {c.faites ? ` · ${t('academie.avancement', { n: c.faites, total: c.nbLecons })}` : ''}
      </small>
      {c.faites > 0 && <span className="gx-progres"><i style={{ width: `${pct}%` }} /></span>}
    </span>
  );
}

/** Page de l'Académie (un contenu seul) : affichée directement ; un simulateur seul occupe tout l'écran. */
function PageSeule({ c }: { c: Cours }) {
  const [l, setL] = useState<Lecon>();
  const [err, setErr] = useState<unknown>();
  const { moi } = useAuth();
  const premiere = c.lecons[0]?.id;
  useEffect(() => {
    if (premiere) api<Lecon>(`/academie/lecons/${premiere}`).then(setL).catch(setErr);
  }, [premiere]);
  return (
    <div className="page ac ac-page-seule">
      <div className="ac-page-tete">
        <Link to="/academie" className="btn-lien">← {t('academie.titre')}</Link>
        <b>{c.titre}</b>
        {moi?.role === 'ADMIN' && <Link to={`/admin/academie/cours/${c.id}`} className="btn-lien petit">✏️</Link>}
      </div>
      <Erreur e={err} />
      {!premiere ? <p className="muted">{t('academie.aucuneLecon')}</p> : !l ? <Chargement /> : <Blocs blocs={l.blocs} pleinePage />}
    </div>
  );
}

/** Sommaire d'un cours : leçons (✓ faites), « Commencer » ou « Reprendre ». */
export function PageCours() {
  const { coursId = '' } = useParams();
  const [c, setC] = useState<Cours>();
  const [err, setErr] = useState<unknown>();
  useEffect(() => {
    api<Cours>(`/academie/cours/${coursId}`).then(setC).catch(setErr);
  }, [coursId]);
  if (err) return <div className="page"><Link to="/academie" className="btn-lien">← {t('academie.titre')}</Link><Erreur e={err} /></div>;
  if (!c) return <Chargement />;
  if (c.type === 'page') return <PageSeule c={c} />;
  const faites = c.lecons.filter((l) => l.faite).length;
  const suite = c.lecons.find((l) => !l.faite) ?? c.lecons[0];
  return (
    <div className="page ac">
      <Link to="/academie" className="btn-lien">← {t('academie.titre')}</Link>
      <div className="ac-entete">
        <Vignette c={c} />
        <div>
          <h1>{c.titre}</h1>
          {c.description && <p className="muted">{c.description}</p>}
          <small className="muted">{t('academie.avancement', { n: faites, total: c.lecons.length })}</small>
        </div>
      </div>
      {suite && (
        <Link to={`/academie/lecons/${suite.id}`} className="btn prim">
          {faites === 0 ? t('academie.commencer') : faites === c.lecons.length ? t('academie.revoir') : t('academie.reprendre')}
        </Link>
      )}
      <ol className="ac-sommaire">
        {c.lecons.map((l, i) => (
          <li key={l.id}>
            <Link to={`/academie/lecons/${l.id}`} className={`carte lien-bloc ${l.faite ? 'faite' : ''}`}>
              <span className="ac-num">{l.faite ? '✓' : i + 1}</span>
              <span>{l.titre}</span>
            </Link>
          </li>
        ))}
      </ol>
      {!c.lecons.length && <p className="muted">{t('academie.aucuneLecon')}</p>}
    </div>
  );
}

/** Une leçon : ses blocs, « ✓ Terminée », leçon suivante (marque la leçon comme terminée). */
export function PageLecon() {
  const { leconId = '' } = useParams();
  const nav = useNavigate();
  const { moi } = useAuth();
  const [l, setL] = useState<Lecon>();
  const [err, setErr] = useState<unknown>();
  useEffect(() => {
    setL(undefined);
    window.scrollTo(0, 0);
    api<Lecon>(`/academie/lecons/${leconId}`).then(setL).catch(setErr);
  }, [leconId]);
  if (err) return <div className="page"><Link to="/academie" className="btn-lien">← {t('academie.titre')}</Link><Erreur e={err} />{err instanceof ErreurApi && err.status === 403 && <p className="muted">{t('academie.horsCible')}</p>}</div>;
  if (!l) return <Chargement />;
  const marquer = (terminee: boolean) => api(`/academie/lecons/${l.id}/terminee`, { method: 'POST', json: { terminee } }).catch(() => {});
  const basculer = async () => {
    await marquer(!l.faite);
    setL({ ...l, faite: !l.faite });
  };
  const suivante = async () => {
    if (!l.faite) await marquer(true);
    nav(l.suivante ? `/academie/lecons/${l.suivante}` : `/academie/${l.cours.id}`);
  };
  return (
    <div className="page ac ac-lecon">
      <Link to={`/academie/${l.cours.id}`} className="btn-lien">← {l.cours.titre}</Link>
      <small className="muted">{t('academie.leconN', { n: l.cours.rang, total: l.cours.nbLecons })}</small>
      <h1>{l.titre}</h1>
      {moi?.role === 'ADMIN' && <Link to={`/admin/academie/lecons/${l.id}`} className="btn petit">✏️ Modifier (admin)</Link>}
      <Blocs blocs={l.blocs} />
      <div className="ac-fin">
        <button type="button" className={`btn ${l.faite ? 'ok' : ''}`} onClick={basculer}>{l.faite ? `✓ ${t('academie.terminee')}` : t('academie.marquer')}</button>
        <div className="ac-nav">
          {l.precedente ? <Link to={`/academie/lecons/${l.precedente}`} className="btn petit">← {t('academie.precedente')}</Link> : <span />}
          <button type="button" className="btn prim" onClick={suivante}>{l.suivante ? `${t('academie.suivante')} →` : `${t('academie.finCours')} ✓`}</button>
        </div>
      </div>
    </div>
  );
}

/** Ma machine : raccourcis vers les pages de l'Académie faites pour cette machine (ou sa catégorie). */
export function OutilsMachine({ modeleId, categorie }: { modeleId: string; categorie: string | null }) {
  const acces = useAccesAcademie();
  const [l, setL] = useState<ResumeCours[]>([]);
  useEffect(() => {
    if (acces) api<ResumeCours[]>('/academie').then(setL).catch(() => setL([]));
  }, [acces]);
  const cat = categorie?.trim().toLowerCase();
  const pages = l.filter((c) => c.type === 'page' && (c.cibleModeles.includes(modeleId) || (!!cat && c.cibleCategories.some((x) => x.trim().toLowerCase() === cat))));
  if (!pages.length) return null;
  return (
    <div className="ac-outils ac-outils-machine">
      {pages.map((c) => (
        <Link key={c.id} to={`/academie/${c.id}`} className="bandeau lien-bandeau">
          <span>🎓 <b>{c.titre}</b></span>
          <span>›</span>
        </Link>
      ))}
    </div>
  );
}
