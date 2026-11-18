import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { MiniatureMachine } from '../components/MiniatureMachine';
import { ResumeProcedure, Solution, useAccesProcedures, useProcedures, useSolutions } from '../espaces/kiavik/donneesProcedures';
import { ListeProcedures } from '../espaces/kiavik/Procedures';
import { ListeSolutions } from '../espaces/kiavik/Solutions';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';
import { t, tn } from '../lib/i18n';
import { date } from '../lib/util';
import { CarnetMachine, ICONE_ETAT } from './Carnet';

type Onglet = 'utilisation' | 'aide' | 'entretien' | 'reglages';
const norm = (e: string) => e.trim().toLowerCase();
/** Le contenu concerne cette machine : sans étiquette (toutes les machines), ou une étiquette en commun avec le modèle. */
const pourMachine = (c: { etiquettes: string[] }, m: { etiquettes: string[] }) =>
  !c.etiquettes.length || c.etiquettes.some((e) => m.etiquettes.some((x) => norm(x) === norm(e)));
/** Rubrique d'un contenu pour cette machine : sa première étiquette portée par la machine, sinon « Général ». */
const rubrique = (c: { etiquettes: string[] }, m: { etiquettes: string[] }) =>
  c.etiquettes.find((e) => m.etiquettes.some((x) => norm(x) === norm(e))) ?? '';

/**
 * Ma machine : tout ce qui concerne UNE machine du client, filtré par les étiquettes de son modèle.
 * Onglets : Utilisation (pas-à-pas, par usage), Aide (Bon à savoir, dépannages guidés), Entretien (carnet),
 * Réglages (Lazzeko : fiches de réglage).
 */
export default function MaMachine() {
  const { id } = useParams();
  const nav = useNavigate();
  const { moi } = useAuth();
  const { espace } = useEspace();
  const acces = useAccesProcedures();
  const [machines, setMachines] = useState<CarnetMachine[]>();
  const [err, setErr] = useState<unknown>();
  const [onglet, setOnglet] = useState<Onglet>('utilisation');
  const { liste: procedures } = useProcedures();
  const { liste: solutions } = useSolutions();
  useEffect(() => {
    api<CarnetMachine[]>('/moi/carnet').then(setMachines).catch(setErr);
  }, []);

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
  const onglets: { o: Onglet; l: string }[] = [
    ...(acces ? [{ o: 'utilisation' as const, l: t('maMachine.utilisation') }, { o: 'aide' as const, l: t('maMachine.aide') }] : []),
    { o: 'entretien', l: t('maMachine.entretien') },
    ...(reglages ? [{ o: 'reglages' as const, l: t('maMachine.reglages') }] : []),
  ];
  const actif = onglets.some((x) => x.o === onglet) ? onglet : onglets[0].o;

  const pas = (procedures ?? []).filter((p) => pourMachine(p, m));
  const utilisation = pas.filter((p) => !p.diagnostic);
  const depannages = pas.filter((p) => p.diagnostic);
  const astuces = (solutions ?? []).filter((s: Solution) => pourMachine(s, m));
  // utilisation rangée par usage (étiquette de la machine), le général à la fin
  const rubriques = [...new Set(utilisation.map((p) => rubrique(p, m)))].sort((a, b) => (a ? (b ? a.localeCompare(b, 'fr') : -1) : 1));
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

      {actif === 'utilisation' && (
        !procedures ? <Chargement /> : !utilisation.length ? <p className="muted">{t('maMachine.rienUtilisation')}</p> : (
          rubriques.map((r) => (
            <section key={r || 'general'} className="mm-rubrique">
              <h2>{r ? `🏷 ${r}` : t('maMachine.general')}</h2>
              <ListeProcedures liste={utilisation.filter((p: ResumeProcedure) => rubrique(p, m) === r)} />
            </section>
          ))
        )
      )}

      {actif === 'aide' && (
        <>
          {depannages.length > 0 && (
            <section className="mm-rubrique">
              <h2>{t('maMachine.depannages')}</h2>
              <ListeProcedures liste={depannages} />
            </section>
          )}
          {astuces.length > 0 && (
            <section className="mm-rubrique">
              <h2>{t('kiavik.solutions.titre')}</h2>
              <ListeSolutions liste={astuces} />
            </section>
          )}
          {!depannages.length && !astuces.length && <p className="muted">{t('maMachine.rienAide')}</p>}
        </>
      )}

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
          <Link to="/" className="bandeau lien-bandeau"><span><b>{t('maMachine.mesFiches')}</b></span><span>›</span></Link>
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
