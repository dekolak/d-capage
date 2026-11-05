import { useEffect, useState } from 'react';
import { CarteFiche } from '../components/CarteFiche';
import { Chargement, Erreur, FiltreTags } from '../components/Composants';
import { api, Fabricant, GroupeTag, MaMachine, PageFiches } from '../lib/api';

/** Réglages partagés : même machine + mêmes tags, triés par note. */
export default function Communaute() {
  const [catalogue, setCatalogue] = useState<Fabricant[]>([]);
  const [groupes, setGroupes] = useState<GroupeTag[]>([]);
  const [varianteId, setVariante] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tri, setTri] = useState<'note' | 'recent'>('note');
  const [q, setQ] = useState('');
  // Par défaut : seulement les réglages notés 4 étoiles et plus.
  const [meilleurs, setMeilleurs] = useState(true);
  const [ouverts, setOuverts] = useState(false);
  const [data, setData] = useState<PageFiches>();
  const [err, setErr] = useState<unknown>();

  useEffect(() => {
    Promise.all([api<Fabricant[]>('/catalogue'), api<GroupeTag[]>('/tags'), api<MaMachine[]>('/moi/machines')])
      .then(([c, g, m]) => {
        setCatalogue(c);
        setGroupes(g);
        if (m[0]) setVariante(m[0].varianteId); // par défaut : ma première machine
      })
      .catch(setErr);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams({ tri, parPage: '50' });
    if (varianteId) p.set('varianteId', varianteId);
    if (tags.length) p.set('tags', tags.join(','));
    if (q.trim()) p.set('q', q.trim());
    if (meilleurs) p.set('noteMin', '4');
    const h = setTimeout(() => api<PageFiches>(`/communaute?${p}`).then(setData).catch(setErr), 250);
    return () => clearTimeout(h);
  }, [varianteId, tags, tri, q, meilleurs]);


  return (
    <div className="page">
      <h1>Communauté</h1>
      <div className="filtres">
        <select value={varianteId} onChange={(e) => setVariante(e.target.value)}>
          <option value="">Toutes les machines</option>
          {catalogue.flatMap((f) =>
            f.modeles.flatMap((m) =>
              m.variantes.map((v) => (
                <option key={v.id} value={v.id}>{`${f.nom} ${m.nom} ${v.nom}`}</option>
              )),
            ),
          )}
        </select>
        <div className="seg">
          <button type="button" className={meilleurs ? 'on' : ''} onClick={() => setMeilleurs(true)}>★ 4 et plus</button>
          <button type="button" className={!meilleurs ? 'on' : ''} onClick={() => setMeilleurs(false)}>Tous les réglages</button>
        </div>
        <button type="button" className="btn petit" onClick={() => setOuverts(!ouverts)}>
          {ouverts ? 'Masquer les filtres' : `Filtres et tri${tags.length || q ? ` (${tags.length + (q ? 1 : 0)})` : ''}`}
        </button>
        {ouverts && (
          <>
        <div className="seg">
          <button type="button" className={tri === 'note' ? 'on' : ''} onClick={() => setTri('note')}>Mieux notés</button>
          <button type="button" className={tri === 'recent' ? 'on' : ''} onClick={() => setTri('recent')}>Récents</button>
        </div>
        <input className="recherche" placeholder="Rechercher (titre, commentaire)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <FiltreTags groupes={groupes} tags={tags} onChange={setTags} />
          </>
        )}
      </div>
      <Erreur e={err} />
      {!data ? (
        <Chargement />
      ) : data.fiches.length === 0 ? (
        <div className="vide-etat">
          <p>{meilleurs ? 'Aucun réglage noté 4 étoiles ou plus pour ces critères.' : 'Aucun réglage partagé pour ces critères.'}</p>
          {meilleurs && <button type="button" className="btn" onClick={() => setMeilleurs(false)}>Voir tous les réglages</button>}
        </div>
      ) : (
        <>
          <p className="muted petit">{data.total} réglage{data.total > 1 ? 's' : ''}</p>
          <div className="liste">{data.fiches.map((f) => <CarteFiche key={f.id} f={f} montrerAuteur />)}</div>
        </>
      )}
    </div>
  );
}
