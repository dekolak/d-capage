import { useState } from 'react';
import { Erreur } from '../../components/Composants';
import { envoyerOuPlusTard } from '../../lib/api';
import { t } from '../../lib/i18n';

/** « ❓ Pas clair ? » : le client signale une étape difficile à comprendre (message facultatif). */
export function PasClair({ etape }: { etape: string }) {
  const [etat, setEtat] = useState<'' | 'ouvert' | 'envoi' | 'ok'>('');
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState<unknown>();
  if (etat === 'ok') return <span className="pc-merci">{t('kiavik.pasClair.merci')}</span>;
  if (!etat) return <button type="button" className="pc-lien" onClick={() => setEtat('ouvert')}>{t('kiavik.pasClair.bouton')}</button>;
  const envoyer = async () => {
    setEtat('envoi');
    try {
      await envoyerOuPlusTard(`/procedures/etapes/${etape}/signaler`, 'POST', { message: message.trim() || undefined }, `signaler:${etape}`);
      setEtat('ok');
    } catch (e) {
      setErreur(e);
      setEtat('ouvert');
    }
  };
  return (
    <div className="pc-form">
      <textarea rows={2} autoFocus value={message} placeholder={t('kiavik.pasClair.question')} aria-label={t('kiavik.pasClair.question')} onChange={(e) => setMessage(e.target.value)} />
      <Erreur e={erreur} />
      <span>
        <button type="button" className="btn prim petit" disabled={etat === 'envoi'} onClick={envoyer}>{t('kiavik.pasClair.envoyer')}</button>
        <button type="button" className="btn petit" onClick={() => setEtat('')}>{t('kiavik.pasClair.annuler')}</button>
      </span>
    </div>
  );
}
