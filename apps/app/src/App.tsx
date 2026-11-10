import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Annonces } from './components/Annonces';
import { Chargement } from './components/Composants';
import { APPS } from './espaces';
import { useAuth } from './lib/auth';
import { useEspace } from './lib/espace';
import Accueil from './pages/Accueil';
import Admin from './pages/Admin';
import AdminAnnonces from './pages/AdminAnnonces';
import AdminAvis from './pages/AdminAvis';
import AdminCatalogue from './pages/AdminCatalogue';
import AdminFiches from './pages/AdminFiches';
import AdminWebhooks from './pages/AdminWebhooks';
import Compte from './pages/Compte';
import Conditions from './pages/Conditions';
import Connexion from './pages/Connexion';

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
        <h1>Aucun accès</h1>
        <p className="muted">Votre compte n'a encore accès à aucune fonction. Contactez {espace.nom}.</p>
        <button type="button" className="btn large" onClick={deconnexion}>Se déconnecter</button>
      </div>
    );
  if (!acces.conditionsAJour) return <Accueil key={espace.slug} />;

  const app = APPS[espace.slug] ?? APPS.lazzeko;
  const admin = moi.role === 'ADMIN';
  return (
    <div key={espace.slug} className="app-espace">
      <main>
        {!admin && <Annonces />}
        <Routes>
          {app.routes()}
          <Route path="/compte" element={<Compte />} />
          <Route path="/conditions" element={<Conditions />} />
          {admin && <Route path="/admin" element={<Admin />} />}
          {admin && <Route path="/admin/fiches" element={<AdminFiches />} />}
          {admin && <Route path="/admin/avis" element={<AdminAvis />} />}
          {admin && <Route path="/admin/messages" element={<AdminAnnonces />} />}
          {admin && <Route path="/admin/catalogue" element={<AdminCatalogue />} />}
          {admin && <Route path="/admin/webhooks" element={<AdminWebhooks />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="onglets">
        {app.onglets.map((o) =>
          o.plus ? (
            <NavLink key={o.to} to={o.to} className="plus">
              <span>+</span>{o.label}
            </NavLink>
          ) : (
            <NavLink key={o.to} to={o.to} end={o.end}>
              <Ic d={o.icone!} />{o.label}
            </NavLink>
          ),
        )}
      </nav>
    </div>
  );
}

function Ic({ d }: { d: string }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
