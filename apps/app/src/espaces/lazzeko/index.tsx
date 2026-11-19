import { Route } from 'react-router-dom';
import Aide from '../../pages/Aide';
import Communaute from '../../pages/Communaute';
import FicheDetail from '../../pages/FicheDetail';
import FicheEditeur from '../../pages/FicheEditeur';
import Fiches from '../../pages/Fiches';
import Machines from '../../pages/Machines';
import Top from '../../pages/Top';
import { AppEspace, ICONES } from '../types';
import { AdminDiagnostics } from '../kiavik/AdminDiagnostics';
import { AdminCategories } from '../kiavik/AdminCategories';
import { AdminProcedures } from '../kiavik/AdminProcedures';
import { AdminSolution, AdminSolutions } from '../kiavik/AdminSolutions';
import { AdminProcedure } from '../kiavik/EditeurProcedure';
import MesDiagnostics from '../kiavik/MesDiagnostics';
import ProcedureDetail from '../kiavik/ProcedureDetail';
import Procedures from '../kiavik/Procedures';
import Solutions, { SolutionDetail } from '../kiavik/Solutions';

/** Espace Lazzeko : réglages décapage (module reglages-decapage), communauté, aide aux réglages, pas-à-pas et Bon à savoir (module procedures-lazzeko). */
export const lazzeko: AppEspace = {
  onglets: [
    { to: '/', label: 'onglets.mesFiches', icone: ICONES.liste, end: true },
    { to: '/communaute', label: 'onglets.communaute', icone: ICONES.groupe },
    { to: '/aide', label: 'onglets.aide', icone: ICONES.aide },
    { to: '/academie', label: 'onglets.academie', icone: ICONES.academie, academie: true },
  ],
  // nouvelle fiche : bouton flottant (caché sur une fiche et dans l'éditeur, où il y a « partager »)
  boutonPlus: { to: '/fiches/nouvelle', label: 'onglets.nouvelle', masquerSur: /^\/fiches\// },
  routes: () => (
    <>
      <Route path="/" element={<Fiches />} />
      <Route path="/fiches/nouvelle" element={<FicheEditeur />} />
      <Route path="/fiches/:id/modifier" element={<FicheEditeur />} />
      <Route path="/fiches/:id" element={<FicheDetail />} />
      <Route path="/communaute" element={<Communaute />} />
      <Route path="/top" element={<Top />} />
      <Route path="/machines" element={<Machines />} />
      <Route path="/aide" element={<Aide />} />
      {/* Pas-à-pas, Bon à savoir, dépannages guidés : même moteur que Kiavik (contenus de l'espace Lazzeko) */}
      <Route path="/procedures" element={<Procedures />} />
      <Route path="/procedures/:id" element={<ProcedureDetail />} />
      <Route path="/solutions" element={<Solutions />} />
      <Route path="/solutions/:id" element={<SolutionDetail />} />
      <Route path="/diagnostics" element={<MesDiagnostics />} />
      <Route path="/admin/procedures" element={<AdminProcedures />} />
      <Route path="/admin/procedures/:id" element={<AdminProcedure />} />
      <Route path="/admin/solutions" element={<AdminSolutions />} />
      <Route path="/admin/solutions/:id" element={<AdminSolution />} />
      <Route path="/admin/diagnostics" element={<AdminDiagnostics />} />
      <Route path="/admin/categories" element={<AdminCategories />} />
    </>
  ),
};
