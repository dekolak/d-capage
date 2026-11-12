import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { ImageApi } from '../espaces/kiavik/donneesProcedures';
import { api } from '../lib/api';
import { date } from '../lib/util';
import { BadgeZone } from './Admin';
import type { FabricantAdmin } from './AdminCatalogue';
import { CarnetMachine, Etat, ICONE_ETAT, Noter, TacheCarnet } from './Carnet';

/* Administration → Entretien (admin, en français) : plans d'entretien attribués aux modèles, suivi des machines, carnets. */

interface Tache {
  id: string; ordre: number; titre: string; description: string | null; frequence: number; unite: 'JOURS' | 'SEMAINES' | 'MOIS';
  bientotJours: number; procedureId: string | null; procedure: { id: string; titre: string; publiee: boolean } | null;
  photo: 'non' | 'facultative' | 'obligatoire'; photoConsigne: string | null; technicien: boolean;
}
interface Plan { id: string; nom: string; description: string | null; modeles: { id: string; nom: string; fabricant: { nom: string } }[]; taches: Tache[] }
type Suivi = Omit<CarnetMachine, 'historique'>;
const UNITES = { JOURS: 'jours', SEMAINES: 'semaines', MOIS: 'mois' };
const ETATS: Record<Etat, string> = { retard: '🔴 En retard', bientot: '🟠 Bientôt', ok: '✅ À jour' };

export default function AdminEntretien() {
  const [onglet, setOnglet] = useState<'suivi' | 'plans'>('suivi');
  return (
    <div className="page ae">
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>🔧 Entretien <BadgeZone zone="commun" /></h1>
      <p className="muted petit">
        Créez les plans d'entretien (tâches périodiques) et attribuez-les aux modèles de machines. Chaque machine de client a son carnet :
        la prochaine échéance repart de la date où la tâche a vraiment été faite.
      </p>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button type="button" className={onglet === 'suivi' ? 'on' : ''} onClick={() => setOnglet('suivi')}>Suivi des machines</button>
        <button type="button" className={onglet === 'plans' ? 'on' : ''} onClick={() => setOnglet('plans')}>Plans d'entretien</button>
      </div>
      {onglet === 'suivi' ? <SuiviMachines /> : <Plans />}
    </div>
  );
}

/** Toutes les machines suivies, filtrables : état, modèle, client / n° de série. */
function SuiviMachines() {
  const [l, setL] = useState<Suivi[]>();
  const [err, setErr] = useState<unknown>();
  const [etat, setEtat] = useState<string>('retard,bientot');
  const [modele, setModele] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    api<Suivi[]>('/admin/entretien/machines').then(setL).catch(setErr);
  }, []);
  const modeles = useMemo(() => [...new Map((l ?? []).map((m) => [m.nom, m.nom])).keys()].sort(), [l]);
  const visibles = (l ?? []).filter((m) => {
    const t = q.trim().toLowerCase();
    return (!etat || m.taches.some((x) => etat.split(',').includes(x.etat)))
      && (!modele || m.nom === modele)
      && (!t || [m.client.nom, m.client.identifiant, m.client.numeroOdoo, m.numeroSerie, m.surnom].some((x) => x?.toLowerCase().includes(t)));
  });
  if (err) return <Erreur e={err} />;
  if (!l) return <Chargement />;
  const n = (e: Etat) => l.filter((m) => m.etat === e).length;
  return (
    <>
      <div className="ae-compteurs">
        <span>🔴 {n('retard')} en retard</span><span>🟠 {n('bientot')} bientôt</span><span>✅ {n('ok')} à jour</span>
      </div>
      <div className="ca-filtres">
        <input type="search" className="recherche" value={q} placeholder="Client, n° Odoo, n° de série…" onChange={(e) => setQ(e.target.value)} />
        <select value={etat} onChange={(e) => setEtat(e.target.value)} aria-label="État">
          <option value="retard,bientot">🔴🟠 À faire (retard ou bientôt)</option>
          <option value="retard">🔴 En retard</option>
          <option value="bientot">🟠 Bientôt</option>
          <option value="">Toutes</option>
        </select>
        <select value={modele} onChange={(e) => setModele(e.target.value)} aria-label="Modèle">
          <option value="">Tous les modèles</option>
          {modeles.map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>
      {!l.length && <p className="muted">Aucune machine suivie : créez un plan d'entretien et attribuez-le à un modèle, puis ajoutez la machine au client (Utilisateurs).</p>}
      <div className="liste">
        {visibles.map((m) => (
          <Link key={m.id} to={`/admin/entretien/machines/${m.id}`} className="carte lien-bloc cn-machine">
            <b>{ICONE_ETAT[m.etat]} {m.client.nom || m.client.identifiant} · {m.surnom || m.nom}</b>
            <span className="muted petit">
              {m.nom}{m.numeroSerie ? ` · n° ${m.numeroSerie}` : ''}{m.client.numeroOdoo ? ` · Odoo ${m.client.numeroOdoo}` : ''}
            </span>
            <span className="petit">
              {m.taches.filter((x) => x.etat !== 'ok').map((x) => `${ICONE_ETAT[x.etat]} ${x.titre} (${x.etat === 'retard' ? `${-x.jours} j de retard` : `le ${date(x.prochaine)}`})`).join(' · ') || 'Tout est à jour'}
            </span>
          </Link>
        ))}
        {l.length > 0 && !visibles.length && <p className="muted">Rien avec ces filtres.</p>}
      </div>
    </>
  );
}

/** Plans : nom, modèles attribués, tâches (fréquence, pas-à-pas, photo, technicien). */
function Plans() {
  const [plans, setPlans] = useState<Plan[]>();
  const [cat, setCat] = useState<FabricantAdmin[]>([]);
  const [pasAPas, setPasAPas] = useState<{ id: string; titre: string; publiee: boolean }[]>([]);
  const [err, setErr] = useState<unknown>();
  const [nom, setNom] = useState('');
  useEffect(() => {
    api<Plan[]>('/admin/entretien/plans').then(setPlans).catch(setErr);
    api<FabricantAdmin[]>('/admin/catalogue').then(setCat).catch(setErr);
    api<{ id: string; titre: string; publiee: boolean }[]>('/procedures').then(setPasAPas).catch(() => {});
  }, []);
  const faire = async (chemin: string, opts: RequestInit & { json?: unknown }) => {
    setErr(undefined);
    try {
      setPlans(await api<Plan[]>(chemin, opts));
      return true;
    } catch (e) {
      setErr(e);
      return false;
    }
  };
  if (!plans) return err ? <Erreur e={err} /> : <Chargement />;
  return (
    <>
      <Erreur e={err} />
      <div className="carte ba-libre" style={{ marginBottom: 12 }}>
        <input value={nom} maxLength={80} placeholder="Nouveau plan (ex. Entretien DXonJet)" onChange={(e) => setNom(e.target.value)} />
        <button type="button" className="btn prim" disabled={nom.trim().length < 2} onClick={() => faire('/admin/entretien/plans', { method: 'POST', json: { nom } }).then((ok) => ok && setNom(''))}>+ Créer</button>
      </div>
      {!plans.length && <p className="muted">Aucun plan pour l'instant.</p>}
      {plans.map((p) => <PlanCarte key={p.id} p={p} cat={cat} pasAPas={pasAPas} faire={faire} />)}
    </>
  );
}

function PlanCarte({ p, cat, pasAPas, faire }: {
  p: Plan; cat: FabricantAdmin[]; pasAPas: { id: string; titre: string; publiee: boolean }[];
  faire: (c: string, o: RequestInit & { json?: unknown }) => Promise<boolean>;
}) {
  const [nom, setNom] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState('');
  const ids = p.modeles.map((m) => m.id);
  const basculer = (id: string) => faire(`/admin/entretien/plans/${p.id}`, { method: 'PATCH', json: { modeleIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] } });
  return (
    <details className="carte ae-plan" open={!p.taches.length}>
      <summary>
        <b>{p.nom}</b> <span className="muted petit">· {p.taches.length} tâche{p.taches.length > 1 ? 's' : ''} · {p.modeles.length ? p.modeles.map((m) => `${m.fabricant.nom} ${m.nom}`).join(', ') : 'aucun modèle'}</span>
      </summary>
      <div className="actions-avis">
        {nom === null ? (
          <button type="button" className="btn petit" onClick={() => setNom(p.nom)}>✏️ Renommer</button>
        ) : (
          <span className="ba-libre">
            <input value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} />
            <button type="button" className="btn petit prim" onClick={() => faire(`/admin/entretien/plans/${p.id}`, { method: 'PATCH', json: { nom } }).then((ok) => ok && setNom(null))}>OK</button>
          </span>
        )}
        <button type="button" className="btn petit danger" onClick={() => confirm(`Supprimer le plan « ${p.nom} » ? (l'historique des carnets est gardé)`) && faire(`/admin/entretien/plans/${p.id}`, { method: 'DELETE' })}>🗑 Supprimer</button>
      </div>

      <b className="petit">Modèles concernés</b>
      <div className="puces">
        {cat.flatMap((f) => f.modeles.map((m) => (
          <button key={m.id} type="button" className={'puce' + (ids.includes(m.id) ? ' on' : '')} onClick={() => basculer(m.id)}>
            {f.nom} {m.nom}
          </button>
        )))}
        {!cat.length && <span className="muted petit">Créez d'abord les modèles dans <Link to="/admin/catalogue">Machines</Link>.</span>}
      </div>

      <b className="petit">Tâches</b>
      <div className="liste">
        {p.taches.map((t, i) => <TacheLigne key={t.id} t={t} premier={i === 0} dernier={i === p.taches.length - 1} pasAPas={pasAPas} faire={faire} />)}
      </div>
      <div className="ba-libre">
        <input value={nouvelle} maxLength={120} placeholder="+ Tâche (ex. Changer les filtres à encre)" onChange={(e) => setNouvelle(e.target.value)} />
        <button type="button" className="btn petit prim" disabled={nouvelle.trim().length < 2}
          onClick={() => faire(`/admin/entretien/plans/${p.id}/taches`, { method: 'POST', json: { titre: nouvelle } }).then((ok) => ok && setNouvelle(''))}>Ajouter</button>
      </div>
    </details>
  );
}

function TacheLigne({ t, premier, dernier, pasAPas, faire }: {
  t: Tache; premier: boolean; dernier: boolean; pasAPas: { id: string; titre: string; publiee: boolean }[];
  faire: (c: string, o: RequestInit & { json?: unknown }) => Promise<boolean>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState(t);
  const url = `/admin/entretien/taches/${t.id}`;
  const modifie = JSON.stringify(v) !== JSON.stringify(t);
  return (
    <div className="sous-bloc">
      <div className="ligne-machine">
        <span style={{ flex: 1 }}>
          <b>{t.titre}</b>
          <span className="muted petit">
            {' '}· {t.frequence === 1 ? `chaque ${UNITES[t.unite].replace(/s$/, '').replace('moi', 'mois')}` : `tous les ${t.frequence} ${UNITES[t.unite]}`}{t.procedure ? ` · 📋 ${t.procedure.titre}` : ''}
            {t.photo !== 'non' ? ` · 📷 ${t.photo}` : ''}{t.technicien ? ' · 🧑‍🔧 technicien' : ''}
          </span>
        </span>
        <button type="button" className="btn petit" aria-label="Monter" disabled={premier} onClick={() => faire(`${url}/deplacer`, { method: 'POST', json: { sens: -1 } })}>↑</button>
        <button type="button" className="btn petit" aria-label="Descendre" disabled={dernier} onClick={() => faire(`${url}/deplacer`, { method: 'POST', json: { sens: 1 } })}>↓</button>
        <button type="button" className="btn petit" onClick={() => { setV(t); setOuvert(!ouvert); }}>✏️</button>
      </div>
      {ouvert && (
        <div className="form">
          <label>Titre<input value={v.titre} maxLength={120} onChange={(e) => setV({ ...v, titre: e.target.value })} /></label>
          <label>Explication pour le client (facultatif)<textarea rows={2} maxLength={1000} value={v.description ?? ''} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
          <label className="ligne-inline">
            Tous les
            <input type="number" min={1} max={1000} value={v.frequence} style={{ width: 80 }} onChange={(e) => setV({ ...v, frequence: Number(e.target.value) || 1 })} />
            <select value={v.unite} style={{ width: 'auto' }} onChange={(e) => setV({ ...v, unite: e.target.value as Tache['unite'] })}>
              {Object.entries(UNITES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="ligne-inline">
            « Bientôt »
            <input type="number" min={0} max={365} value={v.bientotJours} style={{ width: 80 }} onChange={(e) => setV({ ...v, bientotJours: Number(e.target.value) || 0 })} />
            jours avant l'échéance
          </label>
          <label>Pas-à-pas à suivre (facultatif)
            <select value={v.procedureId ?? ''} onChange={(e) => setV({ ...v, procedureId: e.target.value || null })}>
              <option value="">Aucun</option>
              {pasAPas.map((x) => <option key={x.id} value={x.id}>{x.titre}{x.publiee ? '' : ' (non publié)'}</option>)}
            </select>
          </label>
          <label>Photo quand c'est fait
            <select value={v.photo} onChange={(e) => setV({ ...v, photo: e.target.value as Tache['photo'] })}>
              <option value="non">Non</option>
              <option value="facultative">Facultative</option>
              <option value="obligatoire">Obligatoire</option>
            </select>
          </label>
          {v.photo !== 'non' && <label>Quoi photographier<input value={v.photoConsigne ?? ''} maxLength={200} placeholder="ex. le test des buses" onChange={(e) => setV({ ...v, photoConsigne: e.target.value })} /></label>}
          <label className="interrupteur petit"><input type="checkbox" checked={v.technicien} onChange={(e) => setV({ ...v, technicien: e.target.checked })} /> Réservée à un technicien (le client ne peut pas la valider)</label>
          <div className="actions-avis">
            <button type="button" className="btn petit danger" onClick={() => confirm(`Supprimer la tâche « ${t.titre} » ?`) && faire(url, { method: 'DELETE' })}>🗑 Supprimer</button>
            <button type="button" className="btn petit prim" disabled={!modifie || v.titre.trim().length < 2} onClick={() => faire(url, {
              method: 'PATCH',
              json: {
                titre: v.titre, description: v.description || null, frequence: v.frequence, unite: v.unite, bientotJours: v.bientotJours,
                procedureId: v.procedureId, photo: v.photo, photoConsigne: v.photoConsigne || null, technicien: v.technicien,
              },
            }).then((ok) => ok && setOuvert(false))}>Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Carnet d'une machine (admin) : tâches, intervention à noter (toute tâche, y compris technicien), historique. */
export function AdminCarnet() {
  const { id = '' } = useParams();
  const [m, setM] = useState<CarnetMachine>();
  const [err, setErr] = useState<unknown>();
  const [ouverte, setOuverte] = useState<string | null>(null);
  useEffect(() => {
    api<CarnetMachine>(`/admin/entretien/machines/${id}`).then(setM).catch(setErr);
  }, [id]);
  if (!m) return err ? <div className="page"><Erreur e={err} /></div> : <Chargement />;
  const chemin = `/admin/entretien/machines/${m.id}/faits`;
  return (
    <div className="page cn">
      <p className="petit no-print"><Link to="/admin/entretien">‹ Entretien</Link></p>
      <h1>{ICONE_ETAT[m.etat]} {m.surnom || m.nom}</h1>
      <p className="muted petit">
        {m.client.nom || m.client.identifiant}{m.client.numeroOdoo ? ` · Odoo ${m.client.numeroOdoo}` : ''} · {m.nom}
        {m.numeroSerie ? ` · n° ${m.numeroSerie}` : ''}{m.miseEnService ? ` · mise en service le ${date(m.miseEnService)}` : ''}
      </p>
      <Erreur e={err} />
      <button type="button" className="btn petit no-print" onClick={() => window.print()}>🖨 Imprimer / PDF</button>
      <h2>Entretiens</h2>
      <div className="liste">
        {m.taches.map((x: TacheCarnet) => (
          <div key={x.id} className={`carte cn-tache cn-${x.etat}`}>
            <div className="cn-tete">
              <span className="cn-icone">{ICONE_ETAT[x.etat]}</span>
              <span className="cn-titre">
                <b>{x.titre}{x.technicien ? ' 🧑‍🔧' : ''}</b>
                <small className="muted">{x.frequence === 1 ? `chaque ${UNITES[x.unite].replace(/s$/, '').replace('moi', 'mois')}` : `tous les ${x.frequence} ${UNITES[x.unite]}`} · {x.derniere ? `fait le ${date(x.derniere)}` : 'jamais fait'}</small>
                <small className={`cn-echeance cn-${x.etat}`}>{ETATS[x.etat]} · {x.etat === 'retard' ? `${-x.jours} j de retard` : `prochain le ${date(x.prochaine)}`}</small>
                {x.reporteJusquau && <small className="muted">⏰ le client a repoussé le rappel au {date(x.reporteJusquau)}</small>}
              </span>
            </div>
            {ouverte === x.id ? (
              <Noter machine={m.id} tache={x} chemin={chemin} onFait={(r) => { setM(r); setOuverte(null); }} onAnnuler={() => setOuverte(null)} />
            ) : (
              <button type="button" className="btn petit" onClick={() => setOuverte(x.id)}>🧑‍🔧 Noter une intervention</button>
            )}
          </div>
        ))}
        {!m.taches.length && <p className="muted">Aucun plan d'entretien pour ce modèle.</p>}
      </div>
      <h2>Historique</h2>
      {ouverte === 'note' ? (
        <Noter machine={m.id} chemin={chemin} onFait={(r) => { setM(r); setOuverte(null); }} onAnnuler={() => setOuverte(null)} />
      ) : (
        <button type="button" className="btn" onClick={() => setOuverte('note')}>+ Note</button>
      )}
      <ul className="cn-historique">
        {m.historique.map((h) => (
          <li key={h.id} className="carte">
            <div className="cn-tete">
              <span className="cn-titre">
                <b>{h.tache ?? h.titre ?? 'Note'}</b>
                <small className="muted">{date(h.date)} · {h.parAdmin ? `🧑‍🔧 ${h.auteur}` : h.source === 'pasapas' ? `📋 pas-à-pas (${h.auteur})` : h.auteur}</small>
              </span>
              <button type="button" className="btn petit" aria-label="Retirer"
                onClick={() => confirm('Retirer cette ligne du carnet ?') && api<CarnetMachine>(`/admin/entretien/faits/${h.id}`, { method: 'DELETE' }).then(setM).catch(setErr)}>🗑</button>
            </div>
            {h.note && <p className="petit">{h.note}</p>}
            {h.photo && <ImageApi chemin={h.photo} className="cn-photo" />}
          </li>
        ))}
        {!m.historique.length && <li className="muted">Rien de noté.</li>}
      </ul>
    </div>
  );
}
