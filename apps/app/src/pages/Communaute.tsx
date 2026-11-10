import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CarteFiche } from '../components/CarteFiche';
import { Chargement, Erreur, FiltreTags } from '../components/Composants';
import { api, Fabricant, GroupeTag, MaMachine, PageFiches } from '../lib/api';
import { t, tn } from '../lib/i18n';

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
      <h1>{t('lazzeko.communaute.titre')}</h1>
      <Link to="/top" className="bandeau lien-bandeau lien-top">
        <span><b>{t('lazzeko.top.titre')}</b>{t('lazzeko.communaute.top')}</span>
        <span>›</span>
      </Link>
      <div className="filtres">
        <select value={varianteId} onChange={(e) => setVariante(e.target.value)}>
          <option value="">{t('lazzeko.top.toutesMachines')}</option>
          {catalogue.flatMap((f) =>
            f.modeles.flatMap((m) =>
              m.variantes.map((v) => (
                <option key={v.id} value={v.id}>{`${f.nom} ${m.nom} ${v.nom}`}</option>
              )),
            ),
          )}
        </select>
        <div className="seg">
          <button type="button" className={meilleurs ? 'on' : ''} onClick={() => setMeilleurs(true)}>{t('lazzeko.communaute.quatreEtPlus')}</button>
          <button type="button" className={!meilleurs ? 'on' : ''} onClick={() => setMeilleurs(false)}>{t('lazzeko.communaute.tous')}</button>
        </div>
        <button type="button" className="btn petit" onClick={() => setOuverts(!ouverts)}>
          {ouverts ? t('lazzeko.filtres.masquer') : tags.length || q ? t('lazzeko.communaute.filtresTriN', { n: tags.length + (q ? 1 : 0) }) : t('lazzeko.communaute.filtresTri')}
        </button>
        {ouverts && (
          <>
        <div className="seg">
          <button type="button" className={tri === 'note' ? 'on' : ''} onClick={() => setTri('note')}>{t('lazzeko.communaute.mieuxNotes')}</button>
          <button type="button" className={tri === 'recent' ? 'on' : ''} onClick={() => setTri('recent')}>{t('lazzeko.communaute.recents')}</button>
        </div>
        <input className="recherche" placeholder={t('lazzeko.fiches.rechercher')} value={q} onChange={(e) => setQ(e.target.value)} />
        <FiltreTags groupes={groupes} tags={tags} onChange={setTags} />
          </>
        )}
      </div>
      <Erreur e={err} />
      {!data ? (
        <Chargement />
      ) : data.fiches.length === 0 ? (
        <div className="vide-etat">
          <p>{meilleurs ? t('lazzeko.communaute.aucunQuatre') : t('lazzeko.communaute.aucun')}</p>
          {meilleurs && <button type="button" className="btn" onClick={() => setMeilleurs(false)}>{t('lazzeko.communaute.voirTous')}</button>}
        </div>
      ) : (
        <>
          <p className="muted petit">{tn('lazzeko.reglages', data.total)}</p>
          <div className="liste">{data.fiches.map((f) => <CarteFiche key={f.id} f={f} montrerAuteur />)}</div>
        </>
      )}
    </div>
  );
}
