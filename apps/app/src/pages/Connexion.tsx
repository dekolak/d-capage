import { FormEvent, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';

export default function Connexion() {
  const { connexion } = useAuth();
  const { espace } = useEspace();
  const [identifiant, setId] = useState('');
  const [motDePasse, setMdp] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

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

  return (
    <div className="connexion">
      <img src={`${espace.icones}icone.svg`} alt="" width={72} height={72} />
      <h1>{espace.nomApp}</h1>
      <form onSubmit={soumettre} className="form">
        <label>
          Identifiant
          <input autoComplete="username" autoCapitalize="none" value={identifiant} onChange={(e) => setId(e.target.value)} required />
        </label>
        <label>
          Mot de passe
          <input type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMdp(e.target.value)} required />
        </label>
        {erreur && <div className="alerte">{erreur}</div>}
        <button className="btn prim large" disabled={envoi}>{envoi ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </div>
  );
}
