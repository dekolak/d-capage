import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';
import { t } from '../lib/i18n';

/**
 * Partager la page affichée (admin seulement) : quand un client appelle, l'admin lui envoie le lien
 * de l'écran, du bouton, de la procédure ou de l'animation (SMS, WhatsApp, mail…).
 * Le lien utilise l'adresse de l'espace ouvert (ex. app.kiavikcopilot.ovh) ; après connexion, le client arrive sur la page.
 */
export function useLienPartage() {
  const { espace } = useEspace();
  const loc = useLocation();
  const local = ['localhost', '127.0.0.1'].includes(location.hostname) || !espace.domaines.length;
  const origine = local ? location.origin : `https://${espace.domaines[0]}`;
  return { url: origine + loc.pathname + loc.search, nomApp: espace.nomApp };
}

export function BoutonPartager({ titre, flottant }: { titre?: string; flottant?: boolean }) {
  const { moi } = useAuth();
  const { url, nomApp } = useLienPartage();
  const [menu, setMenu] = useState(false);
  const [copie, setCopie] = useState(false);
  if (moi?.role !== 'ADMIN') return null;

  const sujet = titre || document.querySelector('h1')?.textContent || nomApp;
  const texte = t('partage.texte', { titre: sujet, app: nomApp });
  const partager = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: sujet, text: texte, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return; // partage annulé
      }
    }
    setMenu(true); // ordinateur : WhatsApp, SMS ou copier
  };
  const message = encodeURIComponent(`${texte}\n${url}`);
  const copier = async () => {
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  return (
    <>
      <button type="button" className={flottant ? 'partage-flottant' : 'btn petit'} onClick={partager} aria-label={t('partage.bouton')} title={t('partage.bouton')}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
        </svg>
        {!flottant && <span>{t('partage.bouton')}</span>}
      </button>
      {menu && (
        <div className="partage-fond" onClick={() => setMenu(false)}>
          <div className="partage-menu carte" role="dialog" aria-label={t('partage.bouton')} onClick={(e) => e.stopPropagation()}>
            <b>{t('partage.bouton')}</b>
            <span className="muted petit">{sujet}</span>
            <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label={t('partage.lien')} />
            <a className="btn" href={`https://wa.me/?text=${message}`} target="_blank" rel="noreferrer">WhatsApp</a>
            <a className="btn" href={`sms:?&body=${message}`}>SMS</a>
            <button type="button" className="btn prim" onClick={copier}>{copie ? t('partage.copie') : t('partage.copier')}</button>
            <button type="button" className="btn-lien" onClick={() => setMenu(false)}>{t('commun.fermer')}</button>
          </div>
        </div>
      )}
    </>
  );
}
