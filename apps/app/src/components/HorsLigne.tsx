import { useEnLigne } from '../lib/horsLigne';
import { t, tn } from '../lib/i18n';

/** Bandeau « hors ligne » et envois en attente (repartent tout seuls au retour du réseau). */
export function BandeauHorsLigne() {
  const { enLigne, attente } = useEnLigne();
  if (enLigne && !attente) return null;
  return (
    <div className="bandeau hors-ligne" role="status">
      {!enLigne && <span>{t('horsLigne.bandeau')}</span>}
      {attente > 0 && <span>{tn('horsLigne.attente', attente)}</span>}
    </div>
  );
}
