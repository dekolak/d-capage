import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement } from '../components/Composants';
import { api } from '../lib/api';

export default function Conditions() {
  const [c, setC] = useState<{ version: number; texte: string }>();
  useEffect(() => {
    api<{ version: number; texte: string }>('/conditions').then(setC).catch(() => {});
  }, []);
  return (
    <div className="page">
      <p className="petit"><Link to="/compte">‹ Compte</Link></p>
      <h1>Conditions d'utilisation</h1>
      {!c ? <Chargement /> : <><p className="muted petit">Version {c.version}</p><div className="texte-conditions">{c.texte}</div></>}
    </div>
  );
}
