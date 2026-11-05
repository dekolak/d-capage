import { useEffect, useState } from 'react';
import { CarteFiche } from '../components/CarteFiche';
import { Chargement, Erreur } from '../components/Composants';
import { api, Fabricant, GroupeTag, MaMachine, PageFiches } from '../lib/api';

/** Réglages partagés : même machine + mêmes tags, triés par note. */
export default function Communaute() {
  const [catalogue, setCatalogue] = useState<Fabricant[]>([]);
  const [groupes, setGroupes] = useState<GroupeTag[]>([]);
  const [varianteId, setVariante] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tri, setTri] = useState<'note' | 'recent'>('note');
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
    setData(undefined);
    const p = new URLSearchParams({ tri, parPage: '50' });
    if (varianteId) p.set('varianteId', varianteId);
    if (tags.length) p.set('tags', tags.join(','));
    api<PageFiches>(`/communaute?${p}`).then(setData).catch(setErr);
  }, [varianteId, tags, tri]);


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
          <button type="button" className={tri === 'note' ? 'on' : ''} onClick={() => setTri('note')}>Mieux notés</button>
          <button type="button" className={tri === 'recent' ? 'on' : ''} onClick={() => setTri('recent')}>Récents</button>
        </div>
        {groupes.map((g) => {
          const actuel = g.tags.find((t) => tags.includes(t.id))?.id ?? '';
          return (
            <label key={g.id} className="champ-tag">
              <span>{g.nom}</span>
              <select
                value={actuel}
                onChange={(e) => {
                  const autres = tags.filter((id) => !g.tags.some((t) => t.id === id));
                  setTags(e.target.value ? [...autres, e.target.value] : autres);
                }}
              >
                <option value="">Tous</option>
                {g.tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.nom}</option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <Erreur e={err} />
      {!data ? (
        <Chargement />
      ) : data.fiches.length === 0 ? (
        <p className="vide-etat">Aucun réglage partagé pour ces critères.</p>
      ) : (
        <>
          <p className="muted petit">{data.total} réglage{data.total > 1 ? 's' : ''}</p>
          <div className="liste">{data.fiches.map((f) => <CarteFiche key={f.id} f={f} montrerAuteur />)}</div>
        </>
      )}
    </div>
  );
}
