import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bulle } from '../components/Annonces';
import { Erreur } from '../components/Composants';
import { api, Fabricant } from '../lib/api';
import { date } from '../lib/util';

type Niveau = 'CONSEIL' | 'INFO' | 'IMPORTANT';
type Rec = 'AUCUNE' | 'JOURS' | 'SEMAINES' | 'MOIS';
type Cible = 'TOUS' | 'LAZZEKO' | 'AUTRES';
interface Annonce {
  id: string; titre: string; texte: string; niveau: Niveau; lienUrl: string | null; lienTexte: string | null;
  debut: string; fin: string | null; actif: boolean; recurrence: Rec; intervalle: number; cibleClient: Cible;
  fabricantIds: string[]; modeleIds: string[]; varianteIds: string[];
  etat: 'EN_COURS' | 'PROGRAMME' | 'TERMINE' | 'PAUSE'; cible: number; stats: { occurrence: number; vues: number; comprises: number }; prochaine: string | null;
}
const VIDE = {
  titre: '', texte: '', niveau: 'CONSEIL' as Niveau, lienUrl: '', lienTexte: '', debut: '', fin: '',
  recurrence: 'AUCUNE' as Rec, intervalle: 1, cibleClient: 'TOUS' as Cible, machines: [] as string[],
};
type Form = typeof VIDE;
const ETAT = { EN_COURS: 'En cours', PROGRAMME: 'Programmé', TERMINE: 'Terminé', PAUSE: 'En pause' };
const UNITE = { JOURS: 'jour', SEMAINES: 'semaine', MOIS: 'mois' };
const local = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 16) : '');

/** Les machines ciblées sont codées « f:id », « m:id » ou « v:id » (fabricant, modèle, variante). */
function versCiblage(f: Form) {
  const pick = (p: string) => f.machines.filter((x) => x.startsWith(p)).map((x) => x.slice(2));
  return { cibleClient: f.cibleClient, fabricantIds: pick('f:'), modeleIds: pick('m:'), varianteIds: pick('v:') };
}

/** Admin : messages affichés en bulle à l'ouverture de l'app (pas de messagerie, pas de réponse). */
export default function AdminAnnonces() {
  const [liste, setListe] = useState<Annonce[]>([]);
  const [cat, setCat] = useState<Fabricant[]>([]);
  const [f, setF] = useState<Form>(VIDE);
  const [edition, setEdition] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [nb, setNb] = useState<number | null>(null);
  const [err, setErr] = useState<unknown>();

  const charger = () => api<Annonce[]>('/admin/annonces').then(setListe).catch(setErr);
  useEffect(() => {
    charger();
    api<Fabricant[]>('/catalogue').then(setCat).catch(setErr);
  }, []);
  // nombre d'utilisateurs touchés, recalculé à chaque changement de ciblage
  useEffect(() => {
    if (!ouvert) return;
    const h = setTimeout(() => api<{ utilisateurs: number }>('/admin/annonces/cible', { method: 'POST', json: versCiblage(f) }).then((r) => setNb(r.utilisateurs)).catch(() => {}), 200);
    return () => clearTimeout(h);
  }, [ouvert, f.cibleClient, f.machines.join()]);

  const nouveau = () => { setF(VIDE); setEdition(null); setOuvert(true); window.scrollTo(0, 0); };
  const modifier = (a: Annonce) => {
    setF({
      titre: a.titre, texte: a.texte, niveau: a.niveau, lienUrl: a.lienUrl ?? '', lienTexte: a.lienTexte ?? '',
      debut: local(a.debut), fin: local(a.fin), recurrence: a.recurrence, intervalle: a.intervalle, cibleClient: a.cibleClient,
      machines: [...a.fabricantIds.map((x) => 'f:' + x), ...a.modeleIds.map((x) => 'm:' + x), ...a.varianteIds.map((x) => 'v:' + x)],
    });
    setEdition(a.id); setOuvert(true); window.scrollTo(0, 0);
  };

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    setErr(undefined);
    const corps = {
      titre: f.titre, texte: f.texte, niveau: f.niveau, lienUrl: f.lienUrl || null, lienTexte: f.lienTexte || null,
      ...(f.debut ? { debut: new Date(f.debut).toISOString() } : {}), fin: f.fin ? new Date(f.fin).toISOString() : null,
      recurrence: f.recurrence, intervalle: Number(f.intervalle) || 1, ...versCiblage(f),
    };
    try {
      await api(edition ? `/admin/annonces/${edition}` : '/admin/annonces', { method: edition ? 'PATCH' : 'POST', json: corps });
      setOuvert(false); setEdition(null); charger();
    } catch (x) { setErr(x); }
  };

  const basculerMachine = (k: string) => setF({ ...f, machines: f.machines.includes(k) ? f.machines.filter((x) => x !== k) : [...f.machines, k] });

  return (
    <div className="page">
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>Messages</h1>
      <p className="muted petit">Une bulle affichée à l'ouverture de l'app, à la place d'un mail. Les utilisateurs ne peuvent pas répondre.</p>
      <Erreur e={err} />

      {!ouvert ? (
        <button type="button" className="btn prim large" onClick={nouveau}>+ Nouveau message</button>
      ) : (
        <form className="form carte" onSubmit={enregistrer}>
          <b>{edition ? 'Modifier le message' : 'Nouveau message'}</b>
          <div className="seg">
            {(['CONSEIL', 'INFO', 'IMPORTANT'] as Niveau[]).map((n) => (
              <button key={n} type="button" className={f.niveau === n ? 'on' : ''} onClick={() => setF({ ...f, niveau: n })}>
                {n === 'CONSEIL' ? '💡 Conseil' : n === 'INFO' ? 'ℹ️ Info' : '⚠️ Important'}
              </button>
            ))}
          </div>
          {f.niveau === 'IMPORTANT' && <small className="muted">Affiché en grand au centre de l'écran : à réserver aux messages vraiment importants.</small>}
          <label>Titre<input value={f.titre} maxLength={120} onChange={(e) => setF({ ...f, titre: e.target.value })} placeholder="ex. Pensez à nettoyer la lentille" required /></label>
          <label>Texte<textarea rows={3} maxLength={2000} value={f.texte} onChange={(e) => setF({ ...f, texte: e.target.value })} required /></label>
          <div className="deux">
            <label>Lien (facultatif)<input value={f.lienUrl} onChange={(e) => setF({ ...f, lienUrl: e.target.value })} placeholder="https://…" /></label>
            <label>Texte du bouton<input value={f.lienTexte} maxLength={40} onChange={(e) => setF({ ...f, lienTexte: e.target.value })} placeholder="En savoir plus" /></label>
          </div>

          <b className="petit">Quand</b>
          <div className="deux">
            <label>À partir du<input type="datetime-local" value={f.debut} onChange={(e) => setF({ ...f, debut: e.target.value })} /></label>
            <label>Jusqu'au (facultatif)<input type="datetime-local" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} /></label>
          </div>
          <div className="seg">
            {(['AUCUNE', 'JOURS', 'SEMAINES', 'MOIS'] as Rec[]).map((r) => (
              <button key={r} type="button" className={f.recurrence === r ? 'on' : ''} onClick={() => setF({ ...f, recurrence: r })}>
                {r === 'AUCUNE' ? 'Une fois' : r === 'JOURS' ? 'Jours' : r === 'SEMAINES' ? 'Semaines' : 'Mois'}
              </button>
            ))}
          </div>
          {f.recurrence !== 'AUCUNE' && (
            <label className="ligne-inline">
              Revient tous les
              <input type="number" min={1} max={365} value={f.intervalle} onChange={(e) => setF({ ...f, intervalle: Number(e.target.value) })} style={{ width: 80 }} />
              {UNITE[f.recurrence]}{f.intervalle > 1 && f.recurrence !== 'MOIS' ? 's' : ''} après « J'ai compris »
            </label>
          )}

          <b className="petit">À qui</b>
          <div className="seg">
            {(['TOUS', 'LAZZEKO', 'AUTRES'] as Cible[]).map((c) => (
              <button key={c} type="button" className={f.cibleClient === c ? 'on' : ''} onClick={() => setF({ ...f, cibleClient: c })}>
                {c === 'TOUS' ? 'Tous' : c === 'LAZZEKO' ? 'Clients Lazzeko' : 'Autres marques'}
              </button>
            ))}
          </div>
          <div>
            <span className="petit muted">Machines (aucune cochée = toutes) :</span>
            <div className="puces">
              {cat.flatMap((fa) =>
                fa.modeles.flatMap((mo) => [
                  <button key={'m' + mo.id} type="button" className={'puce' + (f.machines.includes('m:' + mo.id) ? ' on' : '')} onClick={() => basculerMachine('m:' + mo.id)}>
                    {fa.nom} {mo.nom}
                  </button>,
                  ...mo.variantes.map((v) => (
                    <button key={'v' + v.id} type="button" className={'puce' + (f.machines.includes('v:' + v.id) ? ' on' : '')} onClick={() => basculerMachine('v:' + v.id)}>
                      {v.nom}
                    </button>
                  )),
                ]),
              )}
            </div>
          </div>
          <div className="succes" style={{ margin: 0 }}>Ce message touchera <b>{nb ?? '…'}</b> utilisateur{nb === 1 ? '' : 's'}.</div>

          <b className="petit">Aperçu</b>
          <Bulle a={f} />

          <div className="actions-avis">
            <button type="button" className="btn" onClick={() => { setOuvert(false); setEdition(null); }}>Annuler</button>
            <button className="btn prim">{edition ? 'Enregistrer' : 'Publier'}</button>
          </div>
        </form>
      )}

      <h2>Messages ({liste.length})</h2>
      <div className="liste">
        {liste.map((a) => (
          <div key={a.id} className={'carte' + (a.etat === 'PAUSE' || a.etat === 'TERMINE' ? ' inactif' : '')}>
            <div className="avis-h">
              <span><b>{a.niveau === 'CONSEIL' ? '💡' : a.niveau === 'INFO' ? 'ℹ️' : '⚠️'} {a.titre}</b></span>
              <span className={'etat-annonce ' + a.etat.toLowerCase()}>{ETAT[a.etat]}</span>
            </div>
            <div className="muted petit">
              {a.recurrence === 'AUCUNE' ? 'Une seule fois' : `Tous les ${a.intervalle > 1 ? a.intervalle + ' ' : ''}${UNITE[a.recurrence]}${a.intervalle > 1 && a.recurrence !== 'MOIS' ? 's' : ''}`}
              {' · '}dès le {date(a.debut)}{a.fin ? ` jusqu'au ${date(a.fin)}` : ''}
              {' · '}{a.cibleClient === 'TOUS' ? 'tous' : a.cibleClient === 'LAZZEKO' ? 'clients Lazzeko' : 'autres marques'}
              {a.modeleIds.length + a.varianteIds.length + a.fabricantIds.length ? ' · machines ciblées' : ''}
            </div>
            <div className="petit" style={{ margin: '6px 0' }}>
              👥 {a.cible} visé{a.cible > 1 ? 's' : ''} · 👁 {a.stats.vues} vu{a.stats.vues > 1 ? 's' : ''} · ✓ {a.stats.comprises} « compris »
              {a.recurrence !== 'AUCUNE' && <span className="muted"> (période en cours{a.prochaine ? `, prochaine le ${date(a.prochaine)}` : ''})</span>}
            </div>
            <div className="actions-avis">
              <button type="button" className="btn petit" onClick={() => modifier(a)}>Modifier</button>
              <button type="button" className="btn petit" onClick={async () => { await api(`/admin/annonces/${a.id}`, { method: 'PATCH', json: { actif: !a.actif } }); charger(); }}>
                {a.actif ? 'Mettre en pause' : 'Réactiver'}
              </button>
              <button type="button" className="btn petit danger" onClick={async () => { if (confirm('Supprimer ce message ?')) { await api(`/admin/annonces/${a.id}`, { method: 'DELETE' }); charger(); } }}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
