import { Navigate, Route } from 'react-router-dom';
import { AppEspace, ICONES } from '../types';
import GuideEcran from './GuideEcran';
import Guides from './Guides';
import Procedures from './Procedures';
import Recherche from './Recherche';

/**
 * Espace Kiavik : guides logiciels (FlexiPRINT, DXonJet) et procédures. Pas de communauté.
 * Le code propre à Kiavik va dans ce dossier.
 */
export const kiavik: AppEspace = {
  onglets: [
    { to: '/guides', label: 'Accueil', icone: ICONES.accueil },
    { to: '/procedures', label: 'Procédures', icone: ICONES.etapes },
    { to: '/recherche', label: 'Rechercher', icone: ICONES.recherche },
    { to: '/compte', label: 'Compte', icone: ICONES.compte },
  ],
  routes: () => (
    <>
      <Route path="/" element={<Navigate to="/guides" replace />} />
      <Route path="/guides" element={<Guides />} />
      <Route path="/guides/:slug/:ecran?" element={<GuideEcran />} />
      <Route path="/procedures" element={<Procedures />} />
      <Route path="/recherche" element={<Recherche />} />
    </>
  ),
};
