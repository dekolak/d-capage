import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CarteFiche } from '../components/CarteFiche';
import { Chargement, Erreur, FiltreTags } from '../components/Composants';
import { api, Fabricant, GroupeTag, MaMachine, PageFiches } from '../lib/api';
import { noterRecherche } from '../lib/activite';
import { t, tn } from '../lib/i18n';
import { BasculeUnivers, groupesDu, universMachine, useUnivers } from '../lib/univers';
import { universTechnologie } from '@decapage/machine-kit';

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
  const [machines, setMachines] = useState<MaMachine[]>();
  const u = useUnivers(machines);

  useEffect(() => {
    Promise.all([api<Fabricant[]>('/catalogue'), api<GroupeTag[]>('/tags'), api<MaMachine[]>('/moi/machines')])
      .then(([c, g, m]) => {
        setCatalogue(c);
        setGroupes(g);
        setMachines(m);
      })
      .catch(setErr);
  }, []);
  // par défaut : ma première machine du métier choisi
  useEffect(() => {
    if (!machines) return;
    setVariante(machines.find((m) => universMachine(m) === u.univers)?.varianteId ?? '');
    setTags([]);
  }, [machines, u.univers]);

  useEffect(() => {
    if (!u.pret) return;
    const p = new URLSearchParams({ tri, parPage: '50', univers: u.univers });
    if (varianteId) p.set('varianteId', varianteId);
    if (tags.length) p.set('tags', tags.join(','));
    if (q.trim()) p.set('q', q.trim());
    if (meilleurs) p.set('noteMin', '4');
    const h = setTimeout(() => api<PageFiches>(`/communaute?${p}`).then(setData).catch(setErr), 250);
    return () => clearTimeout(h);
  }, [varianteId, tags, tri, q, meilleurs, u.pret, u.univers]);


  // journal d'activité : recherche notée quand le client arrête de taper
  useEffect(() => {
    if (!data || q.trim().length < 2) return;
    const h = setTimeout(() => noterRecherche(q.trim(), data.total, '/communaute'), 1500);
    return () => clearTimeout(h);
  }, [q, data]);

  return (
    <div className="page">
      <h1>{t('lazzeko.communaute.titre')}</h1>
      <BasculeUnivers {...u} />
      <Link to="/top" className="bandeau lien-bandeau lien-top">
        <span><b>{t('lazzeko.top.titre')}</b>{t('lazzeko.communaute.top')}</span>
        <span>›</span>
      </Link>
      <div className="filtres">
        <input className="recherche" placeholder={t('lazzeko.communaute.rechercher')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={varianteId} onChange={(e) => setVariante(e.target.value)}>
          <option value="">{t('lazzeko.top.toutesMachines')}</option>
          {catalogue.flatMap((f) =>
            f.modeles.filter((m) => universTechnologie(m.technologie) === u.univers).flatMap((m) =>
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
          {ouverts ? t('lazzeko.filtres.masquer') : tags.length ? t('lazzeko.communaute.filtresTriN', { n: tags.length }) : t('lazzeko.communaute.filtresTri')}
        </button>
        {ouverts && (
          <>
        <div className="seg">
          <button type="button" className={tri === 'note' ? 'on' : ''} onClick={() => setTri('note')}>{t('lazzeko.communaute.mieuxNotes')}</button>
          <button type="button" className={tri === 'recent' ? 'on' : ''} onClick={() => setTri('recent')}>{t('lazzeko.communaute.recents')}</button>
        </div>
        <FiltreTags groupes={groupesDu(groupes, u.univers)} tags={tags} onChange={setTags} />
          </>
        )}
      </div>
      <Erreur e={err} />
      {!data ? (
        <Chargement />
      ) : (
        <>
          {data.fiches.length === 0 ? (
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
          {/* recherche précise (ex. « 6082 ») : les réglages de la même famille (Aluminium) juste après */}
          {data.apparentees && (
            <section className="apparentees">
              <h2>{t('lazzeko.communaute.memeFamille', { familles: data.apparentees.familles.map((x) => x.nom).join(', ') })}</h2>
              <div className="liste">{data.apparentees.fiches.map((f) => <CarteFiche key={f.id} f={f} montrerAuteur />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
