import { Navigate, Route } from 'react-router-dom';
import { AppEspace, ICONES } from '../types';
import Bibliotheque from '../../bibliotheque/Bibliotheque';
import Animation from './Animation';
import GuideEcran from './GuideEcran';
import { AdminProcedures } from '../../bibliotheque/AdminProcedures';
import MesDiagnostics from '../../bibliotheque/MesDiagnostics';
import { AdminProcedure } from '../../bibliotheque/EditeurProcedure';
import { AdminDiagnostics } from '../../bibliotheque/AdminDiagnostics';
import { AdminCategories } from '../../bibliotheque/AdminCategories';
import { AdminSolution, AdminSolutions } from '../../bibliotheque/AdminSolutions';
import Solutions, { SolutionDetail } from '../../bibliotheque/Solutions';
import ProcedureDetail from '../../bibliotheque/ProcedureDetail';
import Procedures from '../../bibliotheque/Procedures';
import Recherche from '../../bibliotheque/Recherche';

/**
 * Espace Kiavik : brique propre = guides écran des logiciels (FlexiPRINT, DXonJet), dans ce dossier.
 * L'aide (accueil, pas-à-pas, recherche) est la Bibliothèque commune (apps/app/src/bibliotheque/). Pas de communauté.
 */
export const kiavik: AppEspace = {
  onglets: [
    { to: '/guides', label: 'onglets.accueil', icone: ICONES.accueil },
    { to: '/procedures', label: 'onglets.procedures', icone: ICONES.etapes },
    { to: '/recherche', label: 'onglets.rechercher', icone: ICONES.recherche },
    { to: '/academie', label: 'onglets.academie', icone: ICONES.academie, academie: true },
  ],
  routes: () => (
    <>
      <Route path="/" element={<Navigate to="/guides" replace />} />
      {/* accueil = Bibliothèque commune, avec les guides écran (brique propre à Kiavik) */}
      <Route path="/guides" element={<Bibliotheque avecGuides />} />
      <Route path="/guides/:slug/animation/:id" element={<Animation />} />
      <Route path="/guides/:slug/:ecran?" element={<GuideEcran />} />
      <Route path="/procedures" element={<Procedures />} />
      <Route path="/procedures/:id" element={<ProcedureDetail />} />
      <Route path="/diagnostics" element={<MesDiagnostics />} />
      <Route path="/solutions" element={<Solutions />} />
      <Route path="/solutions/:id" element={<SolutionDetail />} />
      <Route path="/admin/solutions" element={<AdminSolutions />} />
      <Route path="/admin/solutions/:id" element={<AdminSolution />} />
      <Route path="/admin/procedures" element={<AdminProcedures />} />
      <Route path="/admin/procedures/:id" element={<AdminProcedure />} />
      <Route path="/admin/diagnostics" element={<AdminDiagnostics />} />
      <Route path="/admin/categories" element={<AdminCategories />} />
      <Route path="/recherche" element={<Recherche avecGuides />} />
    </>
  ),
};
