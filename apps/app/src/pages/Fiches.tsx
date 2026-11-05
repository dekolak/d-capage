import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CarteFiche } from '../components/CarteFiche';
import { Chargement, Erreur } from '../components/Composants';
import { api, PageFiches } from '../lib/api';

export default function Fiches() {
  const [data, setData] = useState<PageFiches>();
  const [q, setQ] = useState('');
  const [err, setErr] = useState<unknown>();

  useEffect(() => {
    const h = setTimeout(() => {
      api<PageFiches>(`/fiches?parPage=50${q ? '&q=' + encodeURIComponent(q) : ''}`).then(setData).catch(setErr);
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  return (
    <div className="page">
      <h1>Mes réglages</h1>
      <input className="recherche" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Erreur e={err} />
      {!data ? (
        <Chargement />
      ) : data.fiches.length === 0 ? (
        <div className="vide-etat">
          <p>Aucune fiche pour l'instant.</p>
          <Link to="/fiches/nouvelle" className="btn prim">Enregistrer un premier réglage</Link>
        </div>
      ) : (
        <div className="liste">{data.fiches.map((f) => <CarteFiche key={f.id} f={f} />)}</div>
      )}
    </div>
  );
}
