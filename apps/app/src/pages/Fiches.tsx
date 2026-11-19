import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CarteFiche } from '../components/CarteFiche';
import { Chargement, Erreur, FiltreTags } from '../components/Composants';
import { api, GroupeTag, MaMachine, PageFiches } from '../lib/api';
import { brouillonUtile, lireBrouillon } from '../lib/brouillon';
import { nomMachine } from '../lib/util';
import { noterRecherche } from '../lib/activite';
import { t, tn } from '../lib/i18n';

/** Mes réglages : recherche texte, machine (puces visibles si plusieurs machines, ?machine= depuis Ma machine) et tags, combinables. */
export default function Fiches() {
  const [data, setData] = useState<PageFiches>();
  const [groupes, setGroupes] = useState<GroupeTag[]>([]);
  const [machines, setMachines] = useState<MaMachine[]>([]);
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [params, setParams] = useSearchParams();
  const machine = params.get('machine') ?? '';
  const setMachine = (id: string) => setParams(id ? { machine: id } : {}, { replace: true });
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

  const nbFiltres = tags.length;
  const filtre = nbFiltres > 0 || !!machine || q.trim() !== '';

  // journal d'activité : recherche notée quand le client arrête de taper
  useEffect(() => {
    if (!data || q.trim().length < 2) return;
    const h = setTimeout(() => noterRecherche(q.trim(), data.total, '/'), 1500);
    return () => clearTimeout(h);
  }, [q, data]);

  return (
    <div className="page">
      <h1>{t('lazzeko.fiches.titre')}</h1>
      {brouillonUtile(lireBrouillon()) && (
        <Link to="/fiches/nouvelle" className="bandeau lien-bandeau">
          <span><b>{t('lazzeko.fiches.enCours')}</b>{t('lazzeko.fiches.reprendre')}</span>
          <span>›</span>
        </Link>
      )}
      {machines.length > 1 && (
        <div className="puces" role="group" aria-label={t('lazzeko.filtres.machine')}>
          <button type="button" className={`puce ${!machine ? 'on' : ''}`} onClick={() => setMachine('')}>{t('lazzeko.filtres.toutes')}</button>
          {machines.map((m) => (
            <button key={m.id} type="button" className={`puce ${machine === m.id ? 'on' : ''}`} onClick={() => setMachine(m.id)}>{m.surnom || nomMachine(m)}</button>
          ))}
        </div>
      )}
      <div className="filtres">
        <input className="recherche" placeholder={t('lazzeko.fiches.rechercher')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn petit" onClick={() => setOuverts(!ouverts)}>
          {ouverts ? t('lazzeko.filtres.masquer') : nbFiltres ? t('lazzeko.filtres.titreN', { n: nbFiltres }) : t('lazzeko.filtres.titre')}
        </button>
        {ouverts && (
          <>
            <FiltreTags groupes={groupes} tags={tags} onChange={setTags} />
            {nbFiltres > 0 && (
              <button type="button" className="lien btn-lien" onClick={() => setTags([])}>{t('lazzeko.filtres.effacer')}</button>
            )}
          </>
        )}
      </div>
      <Erreur e={err} />
      {!data ? (
        <Chargement />
      ) : data.fiches.length === 0 ? (
        filtre ? (
          <p className="vide-etat">{t('lazzeko.fiches.aucunResultat')}</p>
        ) : (
          <div className="vide-etat">
            <p>{t('lazzeko.fiches.aucune')}</p>
            <Link to="/fiches/nouvelle" className="btn prim">{t('lazzeko.fiches.premier')}</Link>
          </div>
        )
      ) : (
        <>
          {filtre && <p className="muted petit">{tn('lazzeko.reglages', data.total)}</p>}
          <div className="liste">{data.fiches.map((f) => <CarteFiche key={f.id} f={f} />)}</div>
        </>
      )}
    </div>
  );
}
