import { Route } from 'react-router-dom';
import Aide from '../../pages/Aide';
import Communaute from '../../pages/Communaute';
import FicheDetail from '../../pages/FicheDetail';
import FicheEditeur from '../../pages/FicheEditeur';
import Fiches from '../../pages/Fiches';
import Machines from '../../pages/Machines';
import Top from '../../pages/Top';
import { AppEspace, ICONES } from '../types';
import { AdminDiagnostics } from '../../bibliotheque/AdminDiagnostics';
import { AdminCategories } from '../../bibliotheque/AdminCategories';
import { AdminProcedures } from '../../bibliotheque/AdminProcedures';
import { AdminSolution, AdminSolutions } from '../../bibliotheque/AdminSolutions';
import { AdminProcedure } from '../../bibliotheque/EditeurProcedure';
import MesDiagnostics from '../../bibliotheque/MesDiagnostics';
import ProcedureDetail from '../../bibliotheque/ProcedureDetail';
import Procedures from '../../bibliotheque/Procedures';
import Solutions, { SolutionDetail } from '../../bibliotheque/Solutions';
import Bibliotheque from '../../bibliotheque/Bibliotheque';
import Recherche from '../../bibliotheque/Recherche';
import { t } from '../../lib/i18n';
import { BlocReglages } from './BlocReglages';

/**
 * Espace Lazzeko : brique propre = fiches de réglage (décapage, soudure) et communauté.
 * L'aide (onglet Aide) est la Bibliothèque commune à toutes les sociétés (pas-à-pas, dépannages, Bon à savoir, recherche),
 * avec en tête le bloc « Comprendre les réglages ».
 */
export const lazzeko: AppEspace = {
  onglets: [
    { to: '/', label: 'onglets.mesFiches', icone: ICONES.liste, end: true },
    { to: '/communaute', label: 'onglets.communaute', icone: ICONES.groupe },
    { to: '/aide', label: 'onglets.aide', icone: ICONES.aide },
    { to: '/academie', label: 'onglets.academie', icone: ICONES.academie, academie: true },
  ],
  // nouvelle fiche : bouton flottant (caché sur une fiche et dans l'éditeur, où il y a « partager »)
  boutonPlus: { to: '/fiches/nouvelle', label: 'onglets.nouvelle', masquerSur: /^\/(fiches|academie)\// },
  routes: () => (
    <>
      <Route path="/" element={<Fiches />} />
      <Route path="/fiches/nouvelle" element={<FicheEditeur />} />
      <Route path="/fiches/:id/modifier" element={<FicheEditeur />} />
      <Route path="/fiches/:id" element={<FicheDetail />} />
      <Route path="/communaute" element={<Communaute />} />
      <Route path="/top" element={<Top />} />
      <Route path="/machines" element={<Machines />} />
      {/* Aide = Bibliothèque commune (même écran que l'accueil Kiavik), filtrée par les machines du client */}
      <Route path="/aide" element={<Bibliotheque titre={t('aide.titre')} entete={<BlocReglages />} />} />
      <Route path="/aide/reglages" element={<Aide />} />
      <Route path="/recherche" element={<Recherche />} />
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
