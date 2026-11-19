import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { t, tn } from '../lib/i18n';
import type { CarnetMachine } from '../pages/Carnet';
import { BoutonPartager } from './Partager';

/**
 * En haut à droite : n° client et 👤. Le menu donne Ma machine (guides, carnet, réglages), Mon compte,
 * les pas-à-pas reçus et, pour l'admin, l'administration et « partager cette page ».
 * Pastille rouge : entretiens en retard.
 */
export function MenuCompte() {
  const { moi } = useAuth();
  const loc = useLocation();
  const [ouvert, setOuvert] = useState(false);
  const [retard, setRetard] = useState(0);
  const admin = moi?.role === 'ADMIN';
  useEffect(() => {
    if (admin) return;
    const charger = () =>
      api<CarnetMachine[]>('/moi/carnet').then((l) => setRetard(l.flatMap((m) => m.taches).filter((x) => x.etat === 'retard').length)).catch(() => {});
    charger();
    const f = () => document.visibilityState === 'visible' && charger();
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [admin, loc.pathname]);
  useEffect(() => setOuvert(false), [loc.pathname]);
  if (!moi) return null;
  return (
    <>
      <div className="haut-droite">
        {!admin && moi.numero ? (
          <span className="numero-client" title={t('maMachine.numeroAide')}>
            <span>{t('numeroClient.libelle')}</span> <b>{moi.numero}</b>
          </span>
        ) : null}
        <button type="button" className="menu-compte" aria-label={t('menu.ouvrir')} onClick={() => setOuvert(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
          </svg>
          {retard > 0 && <span className="pastille-rouge">{retard}</span>}
        </button>
      </div>
      {ouvert && (
        <>
          <div className="gx-masque" onClick={() => setOuvert(false)} />
          <div className="gx-fiche menu-compte-fiche" role="dialog" aria-label={t('menu.ouvrir')}>
            <button type="button" className="gx-fermer" aria-label={t('commun.fermer')} onClick={() => setOuvert(false)}>✕</button>
            <b>{moi.nom || moi.identifiant}</b>
            <Link to="/ma-machine" className="carte lien-bloc">
              <b>{t('menu.maMachine')}</b>
              <small className="muted">{t('menu.maMachineDetail')}</small>
              {retard > 0 && <small className="alerte">🔴 {tn('menu.retard', retard)}</small>}
            </Link>
            <Link to="/compte" className="carte lien-bloc"><b>{t('menu.compte')}</b></Link>
            <Link to="/recus" className="carte lien-bloc"><b>{t('menu.recus')}</b></Link>
            {admin && <Link to="/admin" className="carte lien-bloc"><b>{t('menu.administration')}</b></Link>}
            {admin && (
              <div className="menu-partage">
                <span>{t('menu.partager')}</span>
                <BoutonPartager />
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
