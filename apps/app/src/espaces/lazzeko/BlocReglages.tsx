import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';

/** Bloc propre à Lazzeko en tête de la Bibliothèque : comprendre chaque réglage de l'écran de sa machine. */
export function BlocReglages() {
  const { moi } = useAuth();
  if (!moi || (moi.role !== 'ADMIN' && !moi.modules.includes('reglages-decapage'))) return null;
  return (
    <Link to="/aide/reglages" className="bandeau lien-bandeau">
      <span><b>{t('aide.reglagesLien')}</b> {t('aide.reglagesResume')}</span>
      <span>›</span>
    </Link>
  );
}
