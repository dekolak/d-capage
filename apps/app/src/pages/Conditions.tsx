import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement } from '../components/Composants';
import { api } from '../lib/api';
import { useEspace } from '../lib/espace';

export default function Conditions() {
  const { espace } = useEspace();
  const [c, setC] = useState<{ version: number; texte: string }>();
  useEffect(() => {
    api<{ version: number; texte: string }>(`/conditions?espace=${espace.slug}`).then(setC).catch(() => {});
  }, [espace.slug]);
  return (
    <div className="page">
      <p className="petit"><Link to="/compte">‹ Compte</Link></p>
      <h1>Conditions d'utilisation</h1>
      <p className="muted">{espace.nomApp}</p>
      {!c ? <Chargement /> : <><p className="muted petit">Version {c.version}</p><div className="texte-conditions">{c.texte}</div></>}
    </div>
  );
}
