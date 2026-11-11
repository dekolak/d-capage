import { FormEvent, useState } from 'react';
import { api, jeton } from '../lib/api';
import { useEspace } from '../lib/espace';
import { t } from '../lib/i18n';

/**
 * Mot de passe oublié (sans email) : 1. le client demande, l'équipe est prévenue sur son téléphone ;
 * 2. elle lui donne un code à 6 chiffres (valable 1 h) ; 3. le client le saisit avec son nouveau mot de passe et est connecté.
 */
export default function MotDePasseOublie({ identifiantInitial, onRetour }: { identifiantInitial: string; onRetour(): void }) {
  const { espace } = useEspace();
  const [etape, setEtape] = useState<'demande' | 'envoyee' | 'code'>('demande');
  const [identifiant, setIdentifiant] = useState(identifiantInitial);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const demander = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur('');
    try {
      await api('/auth/mot-de-passe-oublie', { method: 'POST', json: { identifiant, message: message || undefined } });
      setEtape('envoyee');
    } catch (x) {
      setErreur((x as Error).message);
    } finally {
      setEnvoi(false);
    }
  };
  const versCode = () => {
    if (identifiant.includes('@')) setIdentifiant('');
    setEtape('code');
  };
  const valider = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur('');
    try {
      const r = await api<{ jeton: string }>('/auth/reinitialiser', { method: 'POST', json: { identifiant, code, nouveau } });
      jeton.set(r.jeton);
      location.reload(); // connecté avec le nouveau mot de passe
    } catch (x) {
      setErreur((x as Error).message);
      setEnvoi(false);
    }
  };

  return (
    <div className="connexion">
      <img src={`${espace.icones}icone.svg`} alt="" width={64} height={64} />
      <h1>{t('mdp.titre')}</h1>
      {etape === 'demande' && (
        <form onSubmit={demander} className="form">
          <p className="muted petit">{t('mdp.explication', { societe: espace.nom })}</p>
          <label>
            {t('mdp.identifiantOuEmail')}
            <input autoComplete="username" autoCapitalize="none" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} required />
          </label>
          <label>
            {t('mdp.message')}
            <input value={message} maxLength={300} placeholder={t('mdp.messageExemple')} onChange={(e) => setMessage(e.target.value)} />
          </label>
          {erreur && <div className="alerte">{erreur}</div>}
          <button className="btn prim large" disabled={envoi || !identifiant.trim()}>{envoi ? t('commun.envoi') : t('mdp.demander')}</button>
          <button type="button" className="btn-lien" onClick={versCode}>{t('mdp.dejaCode')}</button>
        </form>
      )}
      {etape === 'envoyee' && (
        <div className="form">
          <div className="succes">{t('mdp.envoyee', { societe: espace.nom })}</div>
          <button type="button" className="btn prim large" onClick={versCode}>{t('mdp.recuCode')}</button>
        </div>
      )}
      {etape === 'code' && (
        <form onSubmit={valider} className="form">
          <label>
            {t('mdp.identifiantCode')}
            <input autoComplete="username" autoCapitalize="none" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} required />
          </label>
          <label>
            {t('mdp.code')}
            <input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required className="mdp-code" />
          </label>
          <label>
            {t('mdp.nouveau')}
            <input type="password" autoComplete="new-password" minLength={8} value={nouveau} onChange={(e) => setNouveau(e.target.value)} required />
          </label>
          {erreur && <div className="alerte">{erreur}</div>}
          <button className="btn prim large" disabled={envoi || code.length !== 6 || nouveau.length < 8}>{envoi ? t('commun.envoi') : t('mdp.valider')}</button>
        </form>
      )}
      <button type="button" className="btn-lien petit" style={{ marginTop: 14 }} onClick={onRetour}>{t('mdp.retour')}</button>
    </div>
  );
}
