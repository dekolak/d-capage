import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { MiniatureMachine } from '../components/MiniatureMachine';
import { pourModele, trierCategories, useAccesProcedures, useCategories, useProcedures, useSolutions } from '../espaces/kiavik/donneesProcedures';
import { SectionCategorie, useSectionOuverte } from '../espaces/kiavik/SectionCategorie';
import { EnvoiRecu, ListeRecus } from '../components/EnvoisRecus';
import { ListeProcedures } from '../espaces/kiavik/Procedures';
import { ListeSolutions } from '../espaces/kiavik/Solutions';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';
import { t, tn } from '../lib/i18n';
import { date } from '../lib/util';
import { CarnetMachine, ICONE_ETAT } from './Carnet';

type Onglet = 'guides' | 'recus' | 'entretien' | 'reglages';
/** Ce qui vise cette machine précisément passe avant ce qui vise sa catégorie, puis le reste. */
const precision = (c: { cibleModeles: string[]; cibleCategories: string[] }, modeleId: string) =>
  c.cibleModeles.includes(modeleId) ? 0 : c.cibleCategories.length ? 1 : 2;

/**
 * Ma machine : tout ce qui concerne UNE machine du client (filtre « Pour qui ? » : modèle, catégorie, étiquettes).
 * Onglets : Guides (pas-à-pas, dépannages, Bon à savoir, rangés par catégorie de l'accueil comme l'accueil Kiavik),
 * Reçus, Entretien (carnet), Réglages (Lazzeko : fiches de réglage).
 */
export default function MaMachine() {
  const { id } = useParams();
  const nav = useNavigate();
  const { moi } = useAuth();
  const { espace } = useEspace();
  const acces = useAccesProcedures();
  const [machines, setMachines] = useState<CarnetMachine[]>();
  const [err, setErr] = useState<unknown>();
  const [onglet, setOnglet] = useState<Onglet>('guides');
  const { liste: procedures } = useProcedures();
  const { liste: solutions } = useSolutions();
  const [recus, setRecus] = useState<EnvoiRecu[]>([]);
  const cats = useCategories();
  const { ouverte, basculer } = useSectionOuverte('maMachine.ouvertes');
  useEffect(() => {
    api<CarnetMachine[]>('/moi/carnet').then(setMachines).catch(setErr);
  }, []);
  useEffect(() => {
    if (acces) api<EnvoiRecu[]>('/procedures/envois/miens').then(setRecus).catch(() => {});
  }, [acces]);

  if (err) return <div className="page"><Erreur e={err} /></div>;
  if (!machines) return <Chargement />;
  if (!machines.length)
    return (
      <div className="page">
        <h1>{t('maMachine.titre')}</h1>
        <p className="muted">{moi?.role === 'ADMIN' ? t('maMachine.admin') : t('maMachine.aucune')}</p>
      </div>
    );
  const m = machines.find((x) => x.id === id) ?? machines[0];
  const reglages = espace.slug === 'lazzeko' && !!moi?.modules.includes('reglages-decapage');
  const recusIci = recus;
  const onglets: { o: Onglet; l: string }[] = [
    ...(acces ? [{ o: 'guides' as const, l: t('maMachine.guides') }] : []),
    ...(recusIci.length ? [{ o: 'recus' as const, l: t('maMachine.recus') }] : []),
    { o: 'entretien', l: t('maMachine.entretien') },
    ...(reglages ? [{ o: 'reglages' as const, l: t('maMachine.reglages') }] : []),
  ];
  const actif = onglets.some((x) => x.o === onglet) ? onglet : onglets[0].o;

  const parPrecision = <T extends { cibleModeles: string[]; cibleCategories: string[] }>(l: T[]) =>
    l.map((x, i) => ({ x, i })).sort((a, b) => precision(a.x, m.modeleId) - precision(b.x, m.modeleId) || a.i - b.i).map((y) => y.x);
  const pas = parPrecision((procedures ?? []).filter((p) => pourModele(p, m)));
  const astuces = parPrecision((solutions ?? []).filter((s) => pourModele(s, m)));
  // sections comme l'accueil : ordre, icônes et sections masquées dans Administration → Catégories
  const masquees = (cats ?? []).filter((c) => c.masquee).map((c) => c.nom);
  const categories = trierCategories([...pas.map((p) => p.categorie), ...astuces.map((x) => x.categorie)], cats).filter((c) => !masquees.includes(c));
  const retard = m.taches.filter((x) => x.etat === 'retard').length;

  return (
    <div className="page mm">
      <h1>{t('maMachine.titre')}</h1>
      {machines.length > 1 && (
        <div className="mm-choix">
          {machines.map((x) => (
            <button key={x.id} type="button" className={`mm-machine ${x.id === m.id ? 'on' : ''}`} onClick={() => nav(`/ma-machine/${x.id}`, { replace: true })}>
              <MiniatureMachine url={x.imageUrl} taille={44} />
              <span>{x.surnom || x.nom}</span>
            </button>
          ))}
        </div>
      )}
      <div className="carte mm-tete">
        <MiniatureMachine url={m.imageUrl} taille={64} />
        <span>
          <b>{m.surnom || m.nom}</b>
          {m.surnom && <small className="muted"> · {m.nom}</small>}
          <br />
          <small className="muted">
            {m.numeroSerie && t('machines.numeroSerie', { n: m.numeroSerie })}
            {m.numeroSerie && m.miseEnService && ' · '}
            {m.miseEnService && t('carnet.miseEnService', { date: date(m.miseEnService) })}
          </small>
        </span>
      </div>

      <div className="seg mm-onglets">
        {onglets.map((x) => (
          <button key={x.o} type="button" className={actif === x.o ? 'on' : ''} onClick={() => setOnglet(x.o)}>
            {x.l}{x.o === 'entretien' && retard > 0 ? ` 🔴${retard}` : ''}
          </button>
        ))}
      </div>

      {actif === 'guides' && (
        !procedures || !solutions ? <Chargement /> : !categories.length ? <p className="muted">{t('maMachine.rienGuides')}</p> : (
          <div className="liste">
            {categories.map((cat) => {
              const procs = pas.filter((p) => p.categorie === cat);
              const bons = astuces.filter((x) => x.categorie === cat);
              return (
                <SectionCategorie
                  key={cat}
                  icone={cats?.find((c) => c.nom === cat)?.icone ?? '📁'}
                  nom={cat || t('kiavik.accueil.autres')}
                  resume={[
                    procs.length && tn('kiavik.accueil.nbProcedures', procs.length),
                    bons.length && tn('kiavik.accueil.nbAstuces', bons.length),
                  ].filter(Boolean).join(' · ')}
                  ouverte={ouverte === cat}
                  onBasculer={() => basculer(cat)}
                >
                  {procs.length > 0 && <ListeProcedures liste={procs} />}
                  {bons.length > 0 && <ListeSolutions liste={bons} />}
                </SectionCategorie>
              );
            })}
          </div>
        )
      )}

      {actif === 'recus' && <ListeRecus liste={recusIci} />}

      {actif === 'entretien' && (
        <>
          {!m.taches.length ? <p className="muted">{t('carnet.aucunePlan')}</p> : (
            <div className="liste">
              {m.taches.map((x) => (
                <Link key={x.id} to={`/carnet/${m.id}`} className={`carte lien-bloc cn-tache cn-${x.etat}`}>
                  <span className="cn-tete">
                    <span className="cn-icone">{ICONE_ETAT[x.etat]}</span>
                    <span className="cn-titre">
                      <b>{x.titre}</b>
                      <small className={`cn-echeance cn-${x.etat}`}>
                        {x.etat === 'retard' ? tn('carnet.enRetard', -x.jours) : t('carnet.prochaine', { date: date(x.prochaine) })}
                      </small>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
          <Link to={`/carnet/${m.id}`} className="btn prim">{t('maMachine.ouvrirCarnet')}</Link>
        </>
      )}

      {actif === 'reglages' && (
        <div className="liste">
          <Link to={`/?machine=${m.id}`} className="bandeau lien-bandeau"><span><b>{t('maMachine.mesFiches')}</b></span><span>›</span></Link>
          <Link to="/fiches/nouvelle" className="btn prim">{t('maMachine.nouvelleFiche')}</Link>
          <Link to="/aide" className="bandeau lien-bandeau"><span><b>{t('maMachine.aideReglages')}</b></span><span>›</span></Link>
        </div>
      )}
    </div>
  );
}

/** Lien vers « Ma machine » (accueil, compte) avec le nombre d'entretiens en retard. */
export function LienMaMachine() {
  const [machines, setMachines] = useState<CarnetMachine[]>();
  useEffect(() => {
    api<CarnetMachine[]>('/moi/carnet').then(setMachines).catch(() => setMachines([]));
  }, []);
  if (!machines?.length) return null;
  const retard = machines.flatMap((m) => m.taches).filter((x) => x.etat === 'retard').length;
  return (
    <Link to="/ma-machine" className="bandeau lien-bandeau">
      <span>
        <b>{machines.length > 1 ? t('maMachine.titrePluriel') : t('maMachine.titre')}</b>
        {' : '}{t('maMachine.resume')}
        {retard > 0 && <> · 🔴 {tn('carnet.nbRetard', retard)}</>}
      </span>
      <span>›</span>
    </Link>
  );
}
