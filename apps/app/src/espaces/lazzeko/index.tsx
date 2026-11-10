import { Route } from 'react-router-dom';
import Aide from '../../pages/Aide';
import Communaute from '../../pages/Communaute';
import FicheDetail from '../../pages/FicheDetail';
import FicheEditeur from '../../pages/FicheEditeur';
import Fiches from '../../pages/Fiches';
import Machines from '../../pages/Machines';
import Top from '../../pages/Top';
import { AppEspace, ICONES } from '../types';

/** Espace Lazzeko : réglages décapage (module reglages-decapage), communauté, aide aux réglages. */
export const lazzeko: AppEspace = {
  onglets: [
    { to: '/', label: 'Mes fiches', icone: ICONES.liste, end: true },
    { to: '/fiches/nouvelle', label: 'Nouvelle', plus: true },
    { to: '/communaute', label: 'Communauté', icone: ICONES.groupe },
    { to: '/aide', label: 'Aide', icone: ICONES.aide },
    { to: '/compte', label: 'Compte', icone: ICONES.compte },
  ],
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
    </>
  ),
};
