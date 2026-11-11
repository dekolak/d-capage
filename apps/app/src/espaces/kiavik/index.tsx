import { Navigate, Route } from 'react-router-dom';
import { AppEspace, ICONES } from '../types';
import Animation from './Animation';
import GuideEcran from './GuideEcran';
import Guides from './Guides';
import { AdminProcedures } from './AdminProcedures';
import { AdminProcedure } from './EditeurProcedure';
import { AdminDiagnostics } from './AdminDiagnostics';
import { AdminSolution, AdminSolutions } from './AdminSolutions';
import Solutions, { SolutionDetail } from './Solutions';
import ProcedureDetail from './ProcedureDetail';
import Procedures from './Procedures';
import Recherche from './Recherche';

/**
 * Espace Kiavik : guides logiciels (FlexiPRINT, DXonJet) et procédures. Pas de communauté.
 * Le code propre à Kiavik va dans ce dossier.
 */
export const kiavik: AppEspace = {
  onglets: [
    { to: '/guides', label: 'onglets.accueil', icone: ICONES.accueil },
    { to: '/procedures', label: 'onglets.procedures', icone: ICONES.etapes },
    { to: '/recherche', label: 'onglets.rechercher', icone: ICONES.recherche },
    { to: '/compte', label: 'onglets.compte', icone: ICONES.compte },
  ],
  routes: () => (
    <>
      <Route path="/" element={<Navigate to="/guides" replace />} />
      <Route path="/guides" element={<Guides />} />
      <Route path="/guides/:slug/animation/:id" element={<Animation />} />
      <Route path="/guides/:slug/:ecran?" element={<GuideEcran />} />
      <Route path="/procedures" element={<Procedures />} />
      <Route path="/procedures/:id" element={<ProcedureDetail />} />
      <Route path="/solutions" element={<Solutions />} />
      <Route path="/solutions/:id" element={<SolutionDetail />} />
      <Route path="/admin/solutions" element={<AdminSolutions />} />
      <Route path="/admin/solutions/:id" element={<AdminSolution />} />
      <Route path="/admin/procedures" element={<AdminProcedures />} />
      <Route path="/admin/procedures/:id" element={<AdminProcedure />} />
      <Route path="/admin/diagnostics" element={<AdminDiagnostics />} />
      <Route path="/recherche" element={<Recherche />} />
    </>
  ),
};
