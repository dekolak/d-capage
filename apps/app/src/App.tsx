import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Chargement } from './components/Composants';
import { useAuth } from './lib/auth';
import Admin from './pages/Admin';
import Communaute from './pages/Communaute';
import Compte from './pages/Compte';
import Connexion from './pages/Connexion';
import FicheDetail from './pages/FicheDetail';
import FicheEditeur from './pages/FicheEditeur';
import Fiches from './pages/Fiches';
import Machines from './pages/Machines';

export default function App() {
  const { moi, pret } = useAuth();
  if (!pret) return <Chargement />;
  if (!moi) return <Connexion />;

  return (
    <>
      <main>
        <Routes>
          <Route path="/" element={<Fiches />} />
          <Route path="/fiches/nouvelle" element={<FicheEditeur />} />
          <Route path="/fiches/:id/modifier" element={<FicheEditeur />} />
          <Route path="/fiches/:id" element={<FicheDetail />} />
          <Route path="/communaute" element={<Communaute />} />
          <Route path="/machines" element={<Machines />} />
          <Route path="/compte" element={<Compte />} />
          {moi.role === 'ADMIN' && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="onglets">
        <NavLink to="/" end>
          <span>☰</span>Mes fiches
        </NavLink>
        <NavLink to="/fiches/nouvelle" className="plus">
          <span>+</span>Nouvelle
        </NavLink>
        <NavLink to="/communaute">
          <span>★</span>Communauté
        </NavLink>
        <NavLink to="/compte">
          <span>●</span>Compte
        </NavLink>
      </nav>
    </>
  );
}
