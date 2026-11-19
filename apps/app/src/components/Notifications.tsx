import { useState } from 'react';
import { t, tn } from '../lib/i18n';
import { Annonces } from './Annonces';
import { EnvoisRecus } from './EnvoisRecus';
import { RappelsEntretien } from './RappelsEntretien';

/**
 * Notifications de l'écran principal (messages, rappels d'entretien, pas-à-pas reçus) :
 * rien s'il n'y a rien ; une seule = affichée directement ; plusieurs = « 🔔 3 notifications à regarder » à déplier.
 * Les trois listes restent chargées (cachées) pour compter.
 */
export function Notifications() {
  const [n, setN] = useState({ annonces: 0, rappels: 0, envois: 0 });
  const [ouvert, setOuvert] = useState(false);
  const total = n.annonces + n.rappels + n.envois;
  const replie = total > 1 && !ouvert;
  return (
    <div className="notifications">
      {replie && (
        <button type="button" className="bandeau lien-bandeau notif-bandeau" onClick={() => setOuvert(true)}>
          <span><b>{tn('notif.n', total)}</b></span>
          <span>›</span>
        </button>
      )}
      <div hidden={replie}>
        <Annonces onCompte={(x) => setN((v) => (v.annonces === x ? v : { ...v, annonces: x }))} />
        <RappelsEntretien onCompte={(x) => setN((v) => (v.rappels === x ? v : { ...v, rappels: x }))} />
        <EnvoisRecus onCompte={(x) => setN((v) => (v.envois === x ? v : { ...v, envois: x }))} />
        {total > 1 && ouvert && <button type="button" className="btn-lien petit" onClick={() => setOuvert(false)}>{t('notif.masquer')}</button>}
      </div>
    </div>
  );
}
