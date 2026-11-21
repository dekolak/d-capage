import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useEspace } from '../../lib/espace';
import { t } from '../../lib/i18n';

/**
 * Bouton « Comprendre les réglages » (propre à Lazzeko, décapage) : chaque réglage de l'écran de la machine expliqué.
 * Affiché en tête de la Bibliothèque (onglet Aide) et de l'Académie. `lazzekoSeul` : ne rien montrer hors Lazzeko
 * (l'Académie est partagée avec Kiavik).
 */
export function BlocReglages({ lazzekoSeul = false }: { lazzekoSeul?: boolean }) {
  const { moi } = useAuth();
  const { espace } = useEspace();
  if (lazzekoSeul && espace.slug !== 'lazzeko') return null;
  if (!moi || (moi.role !== 'ADMIN' && !moi.modules.includes('reglages-decapage'))) return null;
  return (
    <Link to="/aide/reglages" className="carte bouton-carte bc-reglages">
      <span className="bc-icone" aria-hidden="true">🎛</span>
      <span className="bc-texte">
        <b>{t('aide.reglagesLien')}</b>
        <small>{t('aide.reglagesResume')}</small>
      </span>
      <span className="bc-chevron" aria-hidden="true">›</span>
    </Link>
  );
}
