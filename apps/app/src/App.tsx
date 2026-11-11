import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Annonces } from './components/Annonces';
import { Chargement } from './components/Composants';
import { BandeauHorsLigne } from './components/HorsLigne';
import { BoutonPartager } from './components/Partager';
import { APPS } from './espaces';
import { useAuth } from './lib/auth';
import { useEspace } from './lib/espace';
import Accueil from './pages/Accueil';
import { noterPage, titrePage } from './lib/activite';
import Admin from './pages/Admin';
import AdminActivite from './pages/AdminActivite';
import AdminMotsDePasse from './pages/AdminMotsDePasse';
import AdminAnnonces from './pages/AdminAnnonces';
import AdminAvis from './pages/AdminAvis';
import AdminCatalogue from './pages/AdminCatalogue';
import AdminFiches from './pages/AdminFiches';
import AdminWebhooks from './pages/AdminWebhooks';
import Compte from './pages/Compte';
import Conditions from './pages/Conditions';
import Connexion from './pages/Connexion';
import { t } from './lib/i18n';

/**
 * Une seule app, plusieurs espaces (Lazzeko, Kiavik) : chaque espace a ses écrans et sa barre du bas (src/espaces/),
 * le compte, les conditions, les messages et l'administration sont communs.
 */
export default function App() {
  const { moi, pret, deconnexion } = useAuth();
  const { espace, choisir } = useEspace();
  const acces = moi?.espaces.find((e) => e.slug === espace.slug);
  const autre = moi?.espaces[0];

  // Compte sans accès à l'espace de cette adresse : on ouvre un espace auquel il a accès.
  useEffect(() => {
    if (moi && !acces && autre) choisir(autre.slug);
  }, [moi, acces, autre, choisir]);

  if (!pret) return <Chargement />;
  if (!moi) return <Connexion />;
  if (!acces)
    return autre ? <Chargement /> : (
      <div className="accueil">
        <h1>{t('app.aucunAcces.titre')}</h1>
        <p className="muted">{t('app.aucunAcces.texte', { societe: espace.nom })}</p>
        <button type="button" className="btn large" onClick={deconnexion}>{t('commun.deconnexion')}</button>
      </div>
    );
  if (!acces.conditionsAJour) return <Accueil key={espace.slug} />;

  const app = APPS[espace.slug] ?? APPS.lazzeko;
  const admin = moi.role === 'ADMIN';
  return (
    <div key={espace.slug} className="app-espace">
      <main>
        <BandeauHorsLigne />
        {!admin && <Annonces />}
        {!admin && <JournalPages />}
        <Routes>
          {app.routes()}
          <Route path="/compte" element={<Compte />} />
          <Route path="/conditions" element={<Conditions />} />
          {admin && <Route path="/admin" element={<Admin />} />}
          {admin && <Route path="/admin/comptes/:id/activite" element={<AdminActivite />} />}
          {admin && <Route path="/admin/mots-de-passe" element={<AdminMotsDePasse />} />}
          {admin && <Route path="/admin/fiches" element={<AdminFiches />} />}
          {admin && <Route path="/admin/avis" element={<AdminAvis />} />}
          {admin && <Route path="/admin/messages" element={<AdminAnnonces />} />}
          {admin && <Route path="/admin/catalogue" element={<AdminCatalogue />} />}
          {admin && <Route path="/admin/webhooks" element={<AdminWebhooks />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {admin && <BoutonPartager flottant />}
      <nav className="onglets">
        {app.onglets.map((o) =>
          o.plus ? (
            <NavLink key={o.to} to={o.to} className="plus">
              <span>+</span>{t(o.label)}
            </NavLink>
          ) : (
            <NavLink key={o.to} to={o.to} end={o.end}>
              <Ic d={o.icone!} />{t(o.label)}
            </NavLink>
          ),
        )}
      </nav>
    </div>
  );
}

/** Journal d'activité : chaque page ouverte par un client (titre lu une fois la page affichée). */
function JournalPages() {
  const loc = useLocation();
  useEffect(() => {
    // la page de recherche n'est notée qu'une fois : chaque recherche est notée à part
    const chemin = loc.pathname === '/recherche' ? loc.pathname : loc.pathname + loc.search;
    const h = setTimeout(() => noterPage(chemin, titrePage()), 1500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, loc.pathname === '/recherche' ? '' : loc.search]);
  return null;
}

function Ic({ d }: { d: string }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
