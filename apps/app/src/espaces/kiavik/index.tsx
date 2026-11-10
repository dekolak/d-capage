import { Route } from 'react-router-dom';
import { AppEspace, ICONES } from '../types';
import Guides from './Guides';
import Procedures from './Procedures';

/**
 * Espace Kiavik : guides machines (Flexiprint, DXonJet) et procédures. Pas de communauté.
 * Le code propre à Kiavik va dans ce dossier.
 */
export const kiavik: AppEspace = {
  onglets: [
    { to: '/', label: 'Guides', icone: ICONES.livre, end: true },
    { to: '/procedures', label: 'Procédures', icone: ICONES.etapes },
    { to: '/compte', label: 'Compte', icone: ICONES.compte },
  ],
  routes: () => (
    <>
      <Route path="/" element={<Guides />} />
      <Route path="/procedures" element={<Procedures />} />
    </>
  ),
};
