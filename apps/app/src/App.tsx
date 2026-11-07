import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Annonces } from './components/Annonces';
import { Chargement } from './components/Composants';
import { useAuth } from './lib/auth';
import Accueil from './pages/Accueil';
import Admin from './pages/Admin';
import AdminAnnonces from './pages/AdminAnnonces';
import AdminAvis from './pages/AdminAvis';
import AdminCatalogue from './pages/AdminCatalogue';
import AdminFiches from './pages/AdminFiches';
import AdminWebhooks from './pages/AdminWebhooks';
import Aide from './pages/Aide';
import Communaute from './pages/Communaute';
import Compte from './pages/Compte';
import Conditions from './pages/Conditions';
import Connexion from './pages/Connexion';
import FicheDetail from './pages/FicheDetail';
import FicheEditeur from './pages/FicheEditeur';
import Fiches from './pages/Fiches';
import Machines from './pages/Machines';
import Top from './pages/Top';

export default function App() {
  const { moi, pret } = useAuth();
  if (!pret) return <Chargement />;
  if (!moi) return <Connexion />;
  if (!moi.conditionsAJour) return <Accueil />;

  return (
    <>
      <main>
        {moi.role !== 'ADMIN' && <Annonces />}
        <Routes>
          <Route path="/" element={<Fiches />} />
          <Route path="/fiches/nouvelle" element={<FicheEditeur />} />
          <Route path="/fiches/:id/modifier" element={<FicheEditeur />} />
          <Route path="/fiches/:id" element={<FicheDetail />} />
          <Route path="/communaute" element={<Communaute />} />
          <Route path="/top" element={<Top />} />
          <Route path="/machines" element={<Machines />} />
          <Route path="/compte" element={<Compte />} />
          <Route path="/conditions" element={<Conditions />} />
          <Route path="/aide" element={<Aide />} />
          {moi.role === 'ADMIN' && <Route path="/admin" element={<Admin />} />}
          {moi.role === 'ADMIN' && <Route path="/admin/fiches" element={<AdminFiches />} />}
          {moi.role === 'ADMIN' && <Route path="/admin/avis" element={<AdminAvis />} />}
          {moi.role === 'ADMIN' && <Route path="/admin/messages" element={<AdminAnnonces />} />}
          {moi.role === 'ADMIN' && <Route path="/admin/catalogue" element={<AdminCatalogue />} />}
          {moi.role === 'ADMIN' && <Route path="/admin/webhooks" element={<AdminWebhooks />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="onglets">
        <NavLink to="/" end>
          <Ic d="M4 6h16M4 12h16M4 18h10" />Mes fiches
        </NavLink>
        <NavLink to="/fiches/nouvelle" className="plus">
          <span>+</span>Nouvelle
        </NavLink>
        <NavLink to="/communaute">
          <Ic d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8" />Communauté
        </NavLink>
        <NavLink to="/aide">
          <Ic d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />Aide
        </NavLink>
        <NavLink to="/compte">
          <Ic d="M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />Compte
        </NavLink>
      </nav>
    </>
  );
}

function Ic({ d }: { d: string }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
