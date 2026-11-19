import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CarteFiche } from '../components/CarteFiche';
import { Chargement, Erreur } from '../components/Composants';
import { api, Fabricant, Fiche, MaMachine } from '../lib/api';
import { t } from '../lib/i18n';
import { BasculeUnivers, universMachine, useUnivers } from '../lib/univers';
import { universTechnologie } from '@decapage/machine-kit';

interface GroupeTop { slug: string; nom: string; tags: { id: string; nom: string; fiches: Fiche[] }[] }

/** Les 3 meilleurs réglages pour chaque matériau, chaque chose à enlever, chaque application. */
export default function Top() {
  const [catalogue, setCatalogue] = useState<Fabricant[]>([]);
  const [varianteId, setVariante] = useState('');
  const [groupe, setGroupe] = useState('materiau');
  const [data, setData] = useState<GroupeTop[]>();
  const [err, setErr] = useState<unknown>();
  const [machines, setMachines] = useState<MaMachine[]>();
  const u = useUnivers(machines);

  useEffect(() => {
    Promise.all([api<Fabricant[]>('/catalogue'), api<MaMachine[]>('/moi/machines')])
      .then(([c, m]) => { setCatalogue(c); setMachines(m); })
      .catch(setErr);
  }, []);
  useEffect(() => {
    if (machines) setVariante(machines.find((m) => universMachine(m) === u.univers)?.varianteId ?? '');
  }, [machines, u.univers]);
  useEffect(() => {
    if (!u.pret) return;
    setData(undefined);
    const p = new URLSearchParams({ univers: u.univers });
    if (varianteId) p.set('varianteId', varianteId);
    api<GroupeTop[]>(`/top?${p}`).then(setData).catch(setErr);
  }, [varianteId, u.pret, u.univers]);
  useEffect(() => {
    if (data?.length && !data.some((x) => x.slug === groupe)) setGroupe(data[0].slug);
  }, [data, groupe]);

  const g = data?.find((x) => x.slug === groupe);
  return (
    <div className="page">
      <p className="petit"><Link to="/communaute">‹ {t('lazzeko.communaute.titre')}</Link></p>
      <h1>{t('lazzeko.top.titre')}</h1>
      <BasculeUnivers {...u} />
      <p className="muted petit">{t('lazzeko.top.intro')}</p>
      <div className="filtres">
        <select value={varianteId} onChange={(e) => setVariante(e.target.value)}>
          <option value="">{t('lazzeko.top.toutesMachines')}</option>
          {catalogue.flatMap((f) => f.modeles.filter((m) => universTechnologie(m.technologie) === u.univers).flatMap((m) => m.variantes.map((v) => <option key={v.id} value={v.id}>{`${f.nom} ${m.nom} ${v.nom}`}</option>)))}
        </select>
        {data && data.length > 0 && (
          <div className="seg">
            {data.map((x) => (
              <button key={x.slug} type="button" className={groupe === x.slug ? 'on' : ''} onClick={() => setGroupe(x.slug)}>{x.nom}</button>
            ))}
          </div>
        )}
      </div>
      <Erreur e={err} />
      {!data ? (
        <Chargement />
      ) : !g ? (
        <p className="vide-etat">{varianteId ? t('lazzeko.top.aucunMachine') : t('lazzeko.top.aucun')}</p>
      ) : (
        g.tags.map((tag) => (
          <section key={tag.id} className="top-tag">
            <h2>{tag.nom}</h2>
            <div className="liste">
              {tag.fiches.map((f, i) => (
                <div key={f.id} className="top-ligne">
                  <span className={'podium p' + (i + 1)}>{i + 1}</span>
                  <CarteFiche f={f} montrerAuteur />
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
