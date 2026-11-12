import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bulle, TypeQuestion } from '../components/Annonces';
import { Erreur } from '../components/Composants';
import { useEspace } from '../lib/espace';
import { api, Fabricant } from '../lib/api';
import { date } from '../lib/util';
import { BadgeZone } from './Admin';

type Niveau = 'CONSEIL' | 'INFO' | 'IMPORTANT';
type Rec = 'AUCUNE' | 'JOURS' | 'SEMAINES' | 'MOIS';
type Cible = 'TOUS' | 'LAZZEKO' | 'AUTRES';
interface Annonce {
  id: string; titre: string; texte: string; niveau: Niveau; lienUrl: string | null; lienTexte: string | null;
  debut: string; fin: string | null; actif: boolean; recurrence: Rec; intervalle: number; cibleClient: Cible;
  espaces: string[]; fabricantIds: string[]; modeleIds: string[]; varianteIds: string[]; numerosOdoo: string[];
  questionType: TypeQuestion; question: string | null; options: string[]; autreOption: boolean; reponseObligatoire: boolean;
  etat: 'EN_COURS' | 'PROGRAMME' | 'TERMINE' | 'PAUSE'; cible: number; stats: { occurrence: number; vues: number; comprises: number; reponses: number }; prochaine: string | null;
}
const VIDE = {
  titre: '', texte: '', niveau: 'CONSEIL' as Niveau, lienUrl: '', lienTexte: '', debut: '', fin: '',
  recurrence: 'AUCUNE' as Rec, intervalle: 1, espace: '', cibleClient: 'TOUS' as Cible, machines: [] as string[], numeros: '',
  questionType: 'AUCUNE' as TypeQuestion, question: '', options: ['', ''], autreOption: false, reponseObligatoire: false,
};
type Form = typeof VIDE;
const ETAT = { EN_COURS: 'En cours', PROGRAMME: 'Programmé', TERMINE: 'Terminé', PAUSE: 'En pause' };
const UNITE = { JOURS: 'jour', SEMAINES: 'semaine', MOIS: 'mois' };
const local = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 16) : '');

/** Les machines ciblées sont codées « f:id », « m:id » ou « v:id » (fabricant, modèle, variante). */
function versCiblage(f: Form) {
  const pick = (p: string) => f.machines.filter((x) => x.startsWith(p)).map((x) => x.slice(2));
  const numerosOdoo = [...new Set(f.numeros.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))];
  // Clients Lazzeko / autres marques et machines : seulement pour l'espace Lazzeko (réglages décapage).
  if (!avecMachines(f)) return { espaces: [f.espace], cibleClient: 'TOUS' as Cible, fabricantIds: [], modeleIds: [], varianteIds: [], numerosOdoo };
  return { espaces: f.espace ? [f.espace] : [], cibleClient: f.cibleClient, fabricantIds: pick('f:'), modeleIds: pick('m:'), varianteIds: pick('v:'), numerosOdoo };
}
const avecMachines = (f: Form) => !f.espace || f.espace === 'lazzeko';
function nomEspace(slug: string, espaces: { slug: string; nom: string }[]) {
  return espaces.find((e) => e.slug === slug)?.nom ?? slug;
}

/** Admin : messages affichés en bulle à l'ouverture de l'app (pas de messagerie, pas de réponse). */
export default function AdminAnnonces() {
  const [liste, setListe] = useState<Annonce[]>([]);
  const [cat, setCat] = useState<Fabricant[]>([]);
  const { espace: espaceOuvert, espaces } = useEspace();
  const [f, setF] = useState<Form>(VIDE);
  const [edition, setEdition] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [nb, setNb] = useState<number | null>(null);
  const [err, setErr] = useState<unknown>();
  const [res, setRes] = useState<string | null>(null);

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
  }, [ouvert, f.espace, f.cibleClient, f.machines.join(), f.numeros]);

  const nouveau = () => { setF({ ...VIDE, espace: espaceOuvert.slug }); setEdition(null); setOuvert(true); window.scrollTo(0, 0); };
  const modifier = (a: Annonce) => {
    setF({
      titre: a.titre, texte: a.texte, niveau: a.niveau, lienUrl: a.lienUrl ?? '', lienTexte: a.lienTexte ?? '',
      debut: local(a.debut), fin: local(a.fin), recurrence: a.recurrence, intervalle: a.intervalle, espace: a.espaces[0] ?? '', cibleClient: a.cibleClient,
      machines: [...a.fabricantIds.map((x) => 'f:' + x), ...a.modeleIds.map((x) => 'm:' + x), ...a.varianteIds.map((x) => 'v:' + x)],
      numeros: a.numerosOdoo.join('\n'),
      questionType: a.questionType, question: a.question ?? '', options: a.options.length ? a.options : ['', ''],
      autreOption: a.autreOption, reponseObligatoire: a.reponseObligatoire,
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
      questionType: f.questionType, question: f.questionType === 'AUCUNE' ? null : f.question,
      options: f.questionType === 'CHOIX' ? f.options.filter((o) => o.trim()) : [],
      autreOption: f.questionType === 'CHOIX' && f.autreOption, reponseObligatoire: f.questionType !== 'AUCUNE' && f.reponseObligatoire,
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
      <h1>Messages <BadgeZone zone="commun" /></h1>
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
            <label>Lien (facultatif)<input value={f.lienUrl} onChange={(e) => setF({ ...f, lienUrl: e.target.value })} placeholder="https://… ou page de l'app (ex. /procedures)" /></label>
            <label>Texte du bouton<input value={f.lienTexte} maxLength={40} onChange={(e) => setF({ ...f, lienTexte: e.target.value })} placeholder="En savoir plus" /></label>
          </div>

          <b className="petit">Question (facultatif)</b>
          <div className="seg">
            {([['AUCUNE', 'Aucune'], ['OUI_NON', 'Oui / Non'], ['CHOIX', 'Choix'], ['NOTE', 'Note ★'], ['TEXTE', 'Texte']] as [TypeQuestion, string][]).map(([t, l]) => (
              <button key={t} type="button" className={f.questionType === t ? 'on' : ''} onClick={() => setF({ ...f, questionType: t })}>{l}</button>
            ))}
          </div>
          {f.questionType !== 'AUCUNE' && (
            <>
              <label>Question<input value={f.question} maxLength={300} onChange={(e) => setF({ ...f, question: e.target.value })} placeholder="ex. Quel matériau décapez-vous le plus ?" required /></label>
              {f.questionType === 'CHOIX' && (
                <div className="form" style={{ gap: 6 }}>
                  {f.options.map((o, i) => (
                    <div key={i} className="ba-libre">
                      <input value={o} maxLength={80} placeholder={`Réponse ${i + 1}`} onChange={(e) => setF({ ...f, options: f.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                      {f.options.length > 2 && <button type="button" className="btn petit" onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== i) })}>×</button>}
                    </div>
                  ))}
                  {f.options.length < 5 && <button type="button" className="btn-lien petit" onClick={() => setF({ ...f, options: [...f.options, ''] })}>+ Ajouter une réponse</button>}
                  <label className="interrupteur petit"><input type="checkbox" checked={f.autreOption} onChange={(e) => setF({ ...f, autreOption: e.target.checked })} /> Ajouter « Autre… » avec un champ libre</label>
                </div>
              )}
              <label className="interrupteur petit"><input type="checkbox" checked={f.reponseObligatoire} onChange={(e) => setF({ ...f, reponseObligatoire: e.target.checked })} /> Réponse obligatoire (pas de bouton « Passer »)</label>
            </>
          )}

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

          <b className="petit">Dans quel espace</b>
          <div className="seg">
            {[{ slug: '', nom: 'Tous' }, ...espaces].map((e) => (
              <button key={e.slug} type="button" className={f.espace === e.slug ? 'on' : ''} onClick={() => setF({ ...f, espace: e.slug })}>{e.nom}</button>
            ))}
          </div>

          <b className="petit">À qui</b>
          {avecMachines(f) && <>
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
          </>}
          <label>
            N° clients Odoo (facultatif)
            <textarea rows={2} value={f.numeros} onChange={(e) => setF({ ...f, numeros: e.target.value })} placeholder="ex. C00123, C00456 (séparés par une virgule, un espace ou un retour à la ligne)" />
            <small className="muted">Rempli : seuls ces clients reçoivent le message (en plus des autres critères).</small>
          </label>
          <div className="succes" style={{ margin: 0 }}>Ce message touchera <b>{nb ?? '…'}</b> utilisateur{nb === 1 ? '' : 's'}.</div>

          <b className="petit">Aperçu</b>
          <Bulle a={{ ...f, question: { type: f.questionType, texte: f.question, options: f.options.filter((o) => o.trim()), autre: f.autreOption, obligatoire: f.reponseObligatoire } }} apercu />

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
              {' · '}{a.espaces.length ? a.espaces.map((s) => nomEspace(s, espaces)).join(', ') : 'tous les espaces'}
              {' · '}{a.cibleClient === 'TOUS' ? 'tous' : a.cibleClient === 'LAZZEKO' ? 'clients Lazzeko' : 'autres marques'}
              {a.modeleIds.length + a.varianteIds.length + a.fabricantIds.length ? ' · machines ciblées' : ''}
              {a.numerosOdoo.length ? ` · ${a.numerosOdoo.length} n° Odoo` : ''}
            </div>
            <div className="petit" style={{ margin: '6px 0' }}>
              👥 {a.cible} visé{a.cible > 1 ? 's' : ''} · 👁 {a.stats.vues} vu{a.stats.vues > 1 ? 's' : ''} · ✓ {a.stats.comprises} « compris »
              {a.questionType !== 'AUCUNE' && <> · 📊 {a.stats.reponses} réponse{a.stats.reponses > 1 ? 's' : ''}</>}
              {a.recurrence !== 'AUCUNE' && <span className="muted"> (période en cours{a.prochaine ? `, prochaine le ${date(a.prochaine)}` : ''})</span>}
            </div>
            <div className="actions-avis">
              {a.questionType !== 'AUCUNE' && (
                <button type="button" className="btn petit prim" onClick={() => setRes(res === a.id ? null : a.id)}>📊 Résultats</button>
              )}
              <button type="button" className="btn petit" onClick={() => modifier(a)}>Modifier</button>
              <button type="button" className="btn petit" onClick={async () => { await api(`/admin/annonces/${a.id}`, { method: 'PATCH', json: { actif: !a.actif } }); charger(); }}>
                {a.actif ? 'Mettre en pause' : 'Réactiver'}
              </button>
              <button type="button" className="btn petit danger" onClick={async () => { if (confirm('Supprimer ce message ?')) { await api(`/admin/annonces/${a.id}`, { method: 'DELETE' }); charger(); } }}>Supprimer</button>
            </div>
            {res === a.id && <Resultats id={a.id} periodique={a.recurrence !== 'AUCUNE'} />}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Res {
  type: TypeQuestion; question: string; occurrence: number; occurrenceEnCours: number; total: number; moyenne: number | null;
  periodes: { occurrence: number; nombre: number; debut: string }[]; resume: { valeur: string; nombre: number }[];
  reponses: { valeur: string; autre: string | null; date: string; user: { identifiant: string; nom: string | null; clientLazzeko: boolean } }[];
}

/** Résultats d'une question : barres en %, moyenne pour une note, détail par personne, export CSV. */
function Resultats({ id, periodique }: { id: string; periodique: boolean }) {
  const [occ, setOcc] = useState<number | undefined>();
  const [r, setR] = useState<Res>();
  useEffect(() => {
    api<Res>(`/admin/annonces/${id}/reponses${occ !== undefined ? `?occurrence=${occ}` : ''}`).then(setR).catch(() => {});
  }, [id, occ]);
  const exporter = async () => {
    const b = await api<Blob>(`/admin/annonces/${id}/reponses.csv`);
    const u = URL.createObjectURL(b);
    const l = document.createElement('a');
    l.href = u; l.download = 'reponses.csv'; l.click();
    URL.revokeObjectURL(u);
  };
  if (!r) return <div className="sous-bloc muted petit">Chargement…</div>;
  const lib = (v: string) => (r.type === 'OUI_NON' ? (v === 'oui' ? 'Oui' : 'Non') : r.type === 'NOTE' ? `${v} ★` : v);
  return (
    <div className="sous-bloc">
      <b className="petit">{r.question}</b>
      {periodique && r.periodes.length > 0 && (
        <select value={r.occurrence} onChange={(e) => setOcc(Number(e.target.value))} style={{ margin: '6px 0' }}>
          {[...new Set([r.occurrenceEnCours, ...r.periodes.map((p) => p.occurrence)])].sort((a, b) => b - a).map((o) => {
            const p = r.periodes.find((x) => x.occurrence === o);
            return <option key={o} value={o}>Période {o + 1}{p ? ` (dès le ${date(p.debut)}) · ${p.nombre} réponse${p.nombre > 1 ? 's' : ''}` : ' (en cours)'}</option>;
          })}
        </select>
      )}
      <p className="petit" style={{ margin: '6px 0' }}>{r.total} réponse{r.total > 1 ? 's' : ''}{r.moyenne !== null ? ` · moyenne ${r.moyenne} ★` : ''}</p>
      {r.resume.length > 0 && (
        <div className="barres">
          {r.resume.map((x) => (
            <div key={x.valeur} className="barre-res">
              <span>{lib(x.valeur)}</span>
              <span className="jauge"><i style={{ width: r.total ? `${(x.nombre / r.total) * 100}%` : 0 }} /></span>
              <b>{r.total ? Math.round((x.nombre / r.total) * 100) : 0} % <span className="muted">({x.nombre})</span></b>
            </div>
          ))}
        </div>
      )}
      <details style={{ marginTop: 8 }}>
        <summary className="petit">Détail par personne</summary>
        {r.reponses.map((x, i) => (
          <div key={i} className="petit" style={{ padding: '4px 0', borderTop: '1px solid var(--bord)' }}>
            <b>{x.user.nom || x.user.identifiant}</b> <span className="muted">({x.user.identifiant}{x.user.clientLazzeko ? '' : ', autre marque'}) · {date(x.date)}</span>
            <div>{lib(x.valeur)}{x.autre ? ` : ${x.autre}` : ''}</div>
          </div>
        ))}
      </details>
      <button type="button" className="btn petit" style={{ marginTop: 8 }} onClick={exporter}>⬇ Exporter en CSV</button>
    </div>
  );
}
