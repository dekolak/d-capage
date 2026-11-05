import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CarteFiche } from '../components/CarteFiche';
import { Chargement, Erreur, FiltreTags } from '../components/Composants';
import { api, GroupeTag, MaMachine, PageFiches } from '../lib/api';
import { nomMachine } from '../lib/util';

/** Mes réglages : recherche texte + filtres machine et tags (combinables). */
export default function Fiches() {
  const [data, setData] = useState<PageFiches>();
  const [groupes, setGroupes] = useState<GroupeTag[]>([]);
  const [machines, setMachines] = useState<MaMachine[]>([]);
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [machine, setMachine] = useState('');
  const [ouverts, setOuverts] = useState(false);
  const [err, setErr] = useState<unknown>();

  useEffect(() => {
    Promise.all([api<GroupeTag[]>('/tags'), api<MaMachine[]>('/moi/machines')])
      .then(([g, m]) => { setGroupes(g); setMachines(m); })
      .catch(setErr);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams({ parPage: '50' });
    if (q.trim()) p.set('q', q.trim());
    if (tags.length) p.set('tags', tags.join(','));
    if (machine) p.set('userMachineId', machine);
    const h = setTimeout(() => api<PageFiches>(`/fiches?${p}`).then(setData).catch(setErr), 250);
    return () => clearTimeout(h);
  }, [q, tags, machine]);

  const nbFiltres = tags.length + (machine ? 1 : 0);
  const filtre = nbFiltres > 0 || q.trim() !== '';

  return (
    <div className="page">
      <h1>Mes réglages</h1>
      <div className="filtres">
        <input className="recherche" placeholder="Rechercher (titre, commentaire)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn petit" onClick={() => setOuverts(!ouverts)}>
          {ouverts ? 'Masquer les filtres' : `Filtres${nbFiltres ? ` (${nbFiltres})` : ''}`}
        </button>
        {ouverts && (
          <>
            {machines.length > 1 && (
              <label className="champ-tag">
                <span>Machine</span>
                <select value={machine} onChange={(e) => setMachine(e.target.value)}>
                  <option value="">Toutes</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{nomMachine(m)}</option>)}
                </select>
              </label>
            )}
            <FiltreTags groupes={groupes} tags={tags} onChange={setTags} />
            {nbFiltres > 0 && (
              <button type="button" className="lien btn-lien" onClick={() => { setTags([]); setMachine(''); }}>Effacer les filtres</button>
            )}
          </>
        )}
      </div>
      <Erreur e={err} />
      {!data ? (
        <Chargement />
      ) : data.fiches.length === 0 ? (
        filtre ? (
          <p className="vide-etat">Aucun réglage ne correspond.</p>
        ) : (
          <div className="vide-etat">
            <p>Aucune fiche pour l'instant.</p>
            <Link to="/fiches/nouvelle" className="btn prim">Enregistrer un premier réglage</Link>
          </div>
        )
      ) : (
        <>
          {filtre && <p className="muted petit">{data.total} réglage{data.total > 1 ? 's' : ''}</p>}
          <div className="liste">{data.fiches.map((f) => <CarteFiche key={f.id} f={f} />)}</div>
        </>
      )}
    </div>
  );
}
