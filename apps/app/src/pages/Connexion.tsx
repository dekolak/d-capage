import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';
import { t } from '../lib/i18n';
import MotDePasseOublie from './MotDePasseOublie';

export default function Connexion() {
  const { connexion } = useAuth();
  const { espace } = useEspace();
  const [identifiant, setId] = useState('');
  const [motDePasse, setMdp] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [oubli, setOubli] = useState(false);

  const soumettre = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur('');
    try {
      await connexion(identifiant, motDePasse);
    } catch (err) {
      setErreur((err as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  if (oubli) return <MotDePasseOublie identifiantInitial={identifiant} onRetour={() => setOubli(false)} />;

  return (
    <div className="connexion">
      <img src={`${espace.icones}icone.svg`} alt="" width={72} height={72} />
      <h1>{espace.nomApp}</h1>
      <form onSubmit={soumettre} className="form">
        <label>
          {t('connexion.identifiant')}
          <input autoComplete="username" autoCapitalize="none" value={identifiant} onChange={(e) => setId(e.target.value)} required />
        </label>
        <label>
          {t('connexion.motDePasse')}
          <input type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMdp(e.target.value)} required />
        </label>
        {erreur && <div className="alerte">{erreur}</div>}
        <button className="btn prim large" disabled={envoi}>{envoi ? t('connexion.enCours') : t('connexion.bouton')}</button>
        <button type="button" className="btn-lien petit" onClick={() => setOubli(true)}>{t('mdp.lien')}</button>
      </form>
    </div>
  );
}
