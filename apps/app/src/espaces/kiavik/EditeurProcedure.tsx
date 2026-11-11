import { createContext, Fragment, useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { copier } from '../../lib/copier';
import { compresser } from '../../lib/image';
import { ChoixBouton, Lien, useGuidesAdmin } from './AdminProcedures';
import { CATEGORIES, Choix, Etape, ImageApi, Procedure, ResumeProcedure, Solution, chargerProcedures, estDiagnostic, viderProcedures } from './donneesProcedures';
import { Guide } from './guides';
import { decouperEtape } from './ProcedureDetail';
import { useSolutions } from './donneesProcedures';
import './guides.css';
import './editeur.css';

/*
 * Administration → une procédure (écran pensé pour le PC, utilisable sur téléphone) :
 * à gauche le schéma (route principale, questions, détours de chaque réponse, suites), à droite l'élément choisi.
 * L'administration reste en français (pas de t()).
 */

const MAX_PHOTOS = 8;
type Maj = (chemin: string, opts: RequestInit & { json?: unknown }) => Promise<Procedure | null>;
type Sel = { type: 'etape' | 'choix'; id: string } | null;

interface Stats {
  tentatives: number; terminees: number; envoyes: number; depuis: string | null;
  fins: Record<string, number>; choix: Record<string, number>; arrets: Record<string, number>;
}
interface Signalement { id: string; etapeId: string; message: string | null; traite: boolean; createdAt: string; user: { id: string; identifiant: string; nom: string | null } }
/** Statistiques et « pas clair » de la procédure, pour le schéma et le panneau. */
const Suivi = createContext<{ stats?: Stats; signalements: Signalement[]; traiter(s: Signalement, traite: boolean): void }>({ signalements: [], traiter: () => {} });
const pourcent = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

const SUITES: { v: Choix['suite']; l: string }[] = [
  { v: 'retour', l: '↩ Revenir sur la route (après la question)' },
  { v: 'etape', l: '↪ Aller à une étape de la route principale' },
  { v: 'resolu', l: '✅ Fin : problème résolu' },
  { v: 'contact', l: '📞 Fin : contacter Kiavik' },
];

const lignePour = (p: Procedure, brancheId: string | null) => p.etapes.filter((e) => (e.brancheId ?? null) === brancheId).sort((a, b) => a.ordre - b.ordre);
const court = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Libellé de la suite d'une réponse dans le schéma. */
function libelleSuite(c: Choix, p: Procedure) {
  if (c.suite === 'resolu') return '✅ Fin : résolu';
  if (c.suite === 'contact') return '📞 Fin : contacter Kiavik';
  if (c.suite === 'etape') {
    const principale = lignePour(p, null);
    const k = principale.findIndex((e) => e.id === c.etapeCibleId);
    return k < 0 ? '⚠️ Aller à… (étape à choisir)' : `↪ Aller à l'étape ${k + 1}`;
  }
  return '↩ Retour sur la route';
}

/** Problèmes à corriger dans l'arbre. */
function alertes(p: Procedure, signalements: Signalement[] = []): { texte: string; sel: Sel }[] {
  const l: { texte: string; sel: Sel }[] = [];
  const ouverts = new Map<string, number>();
  for (const s of signalements) if (!s.traite) ouverts.set(s.etapeId, (ouverts.get(s.etapeId) ?? 0) + 1);
  for (const [etapeId, n] of ouverts) {
    const e = p.etapes.find((x) => x.id === etapeId);
    if (e) l.push({ texte: `« ${court(decouperEtape(e.texte).texte, 40)} » : ${n} client${n > 1 ? 's trouvent' : ' trouve'} cette étape pas claire.`, sel: { type: 'etape', id: e.id } });
  }
  const principale = lignePour(p, null);
  for (const e of p.etapes) {
    const q = court(decouperEtape(e.texte).texte, 40);
    if (e.choix.length === 1) l.push({ texte: `La question « ${q} » n'a qu'une réponse.`, sel: { type: 'etape', id: e.id } });
    for (const c of e.choix) {
      if (c.suite === 'etape' && !c.etapeCibleId) l.push({ texte: `Réponse « ${c.libelle} » de « ${q} » : choisir l'étape où aller.`, sel: { type: 'choix', id: c.id } });
      if (c.suite === 'etape' && c.etapeCibleId) {
        // saut en arrière : boucle possible si rien ne change de réponse
        let racine: Etape | undefined = e;
        while (racine?.brancheId) {
          const b: string = racine.brancheId;
          racine = p.etapes.find((x) => x.choix.some((y) => y.id === b));
        }
        const ici = principale.findIndex((x) => x.id === racine?.id);
        const cible = principale.findIndex((x) => x.id === c.etapeCibleId);
        if (cible >= 0 && cible <= ici) l.push({ texte: `Réponse « ${c.libelle} » de « ${q} » : retour en arrière, attention aux boucles.`, sel: { type: 'choix', id: c.id } });
      }
      if (c.suite === 'contact' && !c.conclusion) l.push({ texte: `Fin « ${c.libelle} » de « ${q} » : ajouter une conclusion (cause probable), utile pour vous et l'IA.`, sel: { type: 'choix', id: c.id } });
    }
  }
  return l;
}

/** « + » : ajoute une étape à la place `position` d'une ligne (route principale ou détour), puis la sélectionne. */
function Inserer({ p, position, brancheId, maj, choisir, libelle = '+' }: { p: Procedure; position: number; brancheId: string | null; maj: Maj; choisir(s: Sel): void; libelle?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState('');
  if (!ouvert)
    return (
      <li className="ed-plus">
        <button type="button" className={libelle === '+' ? 'ed-plus-rond' : 'btn-lien petit'} title="Insérer une étape ici" aria-label="Insérer une étape ici" onClick={() => setOuvert(true)}>{libelle}</button>
      </li>
    );
  const valider = async () => {
    const avant = new Set(p.etapes.map((e) => e.id));
    const r = await maj(`/admin/procedures/${p.id}/etapes`, { method: 'POST', json: { texte: texte.trim(), position, brancheId } });
    if (!r) return;
    setOuvert(false);
    setTexte('');
    const nouvelle = r.etapes.find((e) => !avant.has(e.id));
    if (nouvelle) choisir({ type: 'etape', id: nouvelle.id });
  };
  return (
    <li className="carte form ed-inserer">
      <textarea rows={2} autoFocus value={texte} placeholder="Texte de l'étape ou de la question" onChange={(ev) => setTexte(ev.target.value)}
        onKeyDown={(ev) => ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && texte.trim().length >= 2 && valider()} />
      <span className="gx-inserer-actions">
        <button type="button" className="btn prim petit" disabled={texte.trim().length < 2} onClick={valider}>Ajouter</button>
        <button type="button" className="btn petit" onClick={() => setOuvert(false)}>Annuler</button>
      </span>
    </li>
  );
}

/** Une ligne du schéma : route principale (profondeur 0) ou détour d'une réponse. */
function Ligne({ p, brancheId, profondeur, sel, choisir, maj }: { p: Procedure; brancheId: string | null; profondeur: number; sel: Sel; choisir(s: Sel): void; maj: Maj }) {
  const etapes = lignePour(p, brancheId);
  const { stats, signalements } = useContext(Suivi);
  return (
    <ol className={`ed-ligne ${profondeur ? 'detour' : 'principale'}`}>
      {etapes.map((e, k) => {
        const question = e.choix.length > 0;
        const { partie, texte } = decouperEtape(e.texte);
        const precedente = k > 0 ? decouperEtape(etapes[k - 1].texte).partie : null;
        return (
          <Fragment key={e.id}>
            <Inserer p={p} position={k} brancheId={brancheId} maj={maj} choisir={choisir} />
            {profondeur === 0 && partie && partie !== precedente && <li className="ed-partie">{partie}</li>}
            <li className="ed-li">
              <button type="button" className={`ed-noeud ${question ? 'q' : ''} ${sel?.id === e.id ? 'sel' : ''}`} onClick={() => choisir({ type: 'etape', id: e.id })}>
                <span className="ed-pastille">{question ? '?' : profondeur ? '•' : k + 1}</span>
                <span className="ed-texte">{court(texte, 90)}</span>
                <span className="ed-icones">
                  {e.controle && <span title="Contrôle Oui / Non">☑</span>}
                  {e.photos.length > 0 && <span title={`${e.photos.length} photo${e.photos.length > 1 ? 's' : ''}`}>📷{e.photos.length > 1 ? e.photos.length : ''}</span>}
                  {e.guide && <span title="Bouton lié">👆</span>}
                  {e.avertissement && <span title="Avertissement">⚠️</span>}
                  {e.note && <span title="Note pour l'IA">📝</span>}
                  {(() => {
                    const n = signalements.filter((s) => s.etapeId === e.id && !s.traite).length;
                    return n > 0 && <span className="ed-badge-pc" title="Signalé « pas clair »">❓{n}</span>;
                  })()}
                  {!!stats?.arrets[e.id] && <span className="ed-badge-arret" title="Tentatives arrêtées à cette étape">⏸{stats.arrets[e.id]}</span>}
                </span>
              </button>
              {question && (
                <div className="ed-branches">
                  {e.choix.map((c, ci) => (
                    <div key={c.id} className={`ed-branche c${ci % 4}`}>
                      <button type="button" className={`ed-reponse ${sel?.id === c.id ? 'sel' : ''}`} onClick={() => choisir({ type: 'choix', id: c.id })}>
                        {c.libelle} →
                        {stats && (() => {
                          const total = e.choix.reduce((t, x) => t + (stats.choix[x.id] ?? 0), 0);
                          const n = stats.choix[c.id] ?? 0;
                          return total > 0 && <span className="ed-stat" title={`${n} réponse${n > 1 ? 's' : ''} sur ${total}`}>{n} · {pourcent(n, total)} %</span>;
                        })()}
                      </button>
                      <Ligne p={p} brancheId={c.id} profondeur={profondeur + 1} sel={sel} choisir={choisir} maj={maj} />
                      <button type="button" className={`ed-suite s-${c.suite}`} onClick={() => choisir({ type: 'choix', id: c.id })}>{libelleSuite(c, p)}</button>
                    </div>
                  ))}
                  <AjoutChoix e={e} maj={maj} choisir={choisir} />
                </div>
              )}
            </li>
          </Fragment>
        );
      })}
      <Inserer p={p} position={etapes.length} brancheId={brancheId} maj={maj} choisir={choisir} libelle={etapes.length ? '+' : '+ étape dans ce détour'} />
    </ol>
  );
}

/** « + réponse » sous une question. */
function AjoutChoix({ e, maj, choisir, libelle = '+ réponse' }: { e: Etape; maj: Maj; choisir(s: Sel): void; libelle?: string }) {
  const [texte, setTexte] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const valider = async (l: string) => {
    const avant = new Set(e.choix.map((c) => c.id));
    const r = await maj(`/admin/procedures/etapes/${e.id}/choix`, { method: 'POST', json: { libelle: l } });
    const nouveau = r?.etapes.find((x) => x.id === e.id)?.choix.find((c) => !avant.has(c.id));
    if (nouveau) choisir({ type: 'choix', id: nouveau.id });
    setOuvert(false);
    setTexte('');
  };
  if (!ouvert) return <button type="button" className="btn-lien petit ed-ajout-choix" onClick={() => setOuvert(true)}>{libelle}</button>;
  return (
    <span className="ed-ajout-form">
      <input type="text" autoFocus value={texte} placeholder="Ex. Oui, Non, Je ne sais pas" onChange={(ev) => setTexte(ev.target.value)}
        onKeyDown={(ev) => ev.key === 'Enter' && texte.trim() && valider(texte.trim())} />
      <button type="button" className="btn prim petit" disabled={!texte.trim()} onClick={() => valider(texte.trim())}>Ajouter</button>
      <button type="button" className="btn petit" onClick={() => setOuvert(false)}>Annuler</button>
    </span>
  );
}

/** Panneau : une étape (ou question). */
function EtapeEditeur({ p, e, guides, astuces, maj, choisir }: { p: Procedure; e: Etape; guides: Guide[]; astuces: Solution[]; maj: Maj; choisir(s: Sel): void }) {
  const [texte, setTexte] = useState(e.texte);
  const [avert, setAvert] = useState(e.avertissement ?? '');
  const [note, setNote] = useState(e.note ?? '');
  const [lien, setLien] = useState<Lien>({ guide: e.guide, ecran: e.ecran, pastille: e.pastille });
  const [controle, setControle] = useState(e.controle);
  const [solutionId, setSolutionId] = useState(e.solutionId);
  const [envoi, setEnvoi] = useState(false);
  const question = e.choix.length > 0;
  const ligne = lignePour(p, e.brancheId);
  const n = ligne.findIndex((x) => x.id === e.id);
  const parent = e.brancheId ? p.etapes.find((x) => x.choix.some((c) => c.id === e.brancheId)) : undefined;
  const reponseParent = parent?.choix.find((c) => c.id === e.brancheId);
  const modifie = texte !== e.texte || avert !== (e.avertissement ?? '') || note !== (e.note ?? '') || lien.guide !== e.guide || lien.ecran !== e.ecran
    || lien.pastille !== e.pastille || controle !== e.controle || solutionId !== e.solutionId;
  /** Ajoute les photos choisies (plusieurs possibles), une par une, dans la limite de 8. */
  const ajouterPhotos = async (fichiers: File[]) => {
    if (!fichiers.length) return;
    setEnvoi(true);
    try {
      for (const f of fichiers.slice(0, Math.max(0, MAX_PHOTOS - e.photos.length))) {
        const { fichier } = await compresser(f);
        const fd = new FormData();
        fd.append('photo', fichier, 'photo.jpg');
        if (!(await maj(`/admin/procedures/etapes/${e.id}/photo`, { method: 'POST', body: fd }))) break;
      }
    } finally {
      setEnvoi(false);
    }
  };
  const enregistrer = () =>
    maj(`/admin/procedures/etapes/${e.id}`, {
      method: 'PATCH',
      json: { texte: texte.trim(), avertissement: avert.trim() || null, note: note.trim() || null, ...lien, controle: !question && controle, solutionId: !question && controle ? solutionId : null },
    });
  const enQuestion = async () => {
    if (modifie && !(await enregistrer())) return;
    await maj(`/admin/procedures/etapes/${e.id}/choix`, { method: 'POST', json: { libelle: 'Oui' } });
    await maj(`/admin/procedures/etapes/${e.id}/choix`, { method: 'POST', json: { libelle: 'Non' } });
  };
  return (
    <div className="carte form ed-fiche">
      <div className="gx-etape-tete">
        <b>{question ? 'Question' : e.brancheId ? 'Étape du détour' : `Étape ${n + 1}`}</b>
        <span>
          <button type="button" className="btn petit" disabled={n === 0} aria-label="Monter" onClick={() => maj(`/admin/procedures/etapes/${e.id}/deplacer`, { method: 'POST', json: { sens: -1 } })}>↑</button>
          <button type="button" className="btn petit" disabled={n === ligne.length - 1} aria-label="Descendre" onClick={() => maj(`/admin/procedures/etapes/${e.id}/deplacer`, { method: 'POST', json: { sens: 1 } })}>↓</button>
          <button type="button" className="btn petit danger" aria-label="Supprimer l'étape"
            onClick={() => confirm(question ? 'Supprimer cette question, ses réponses et leurs détours ?' : 'Supprimer cette étape ?') && maj(`/admin/procedures/etapes/${e.id}`, { method: 'DELETE' }).then((r) => r && choisir(null))}>🗑</button>
        </span>
      </div>
      {parent && reponseParent && (
        <p className="petit muted">
          Détour de la réponse <button type="button" className="btn-lien" onClick={() => choisir({ type: 'choix', id: reponseParent.id })}>{reponseParent.libelle}</button> à
          {' '}<button type="button" className="btn-lien" onClick={() => choisir({ type: 'etape', id: parent.id })}>{court(decouperEtape(parent.texte).texte, 50)}</button>
        </p>
      )}
      <label>{question ? 'Question posée au client' : 'Texte de l\'étape'}
        <textarea rows={3} value={texte} onChange={(ev) => setTexte(ev.target.value)} />
        {!e.brancheId && <small className="muted">« Montage — Vérifier la courroie » range l'étape sous le titre « Montage ».</small>}
      </label>
      <label>Avertissement (facultatif)<input type="text" value={avert} placeholder="⚠️ Ex. Machine éteinte" onChange={(ev) => setAvert(ev.target.value)} /></label>
      <label>📝 Note interne (pour vous et l'IA, jamais montrée au client)
        <textarea rows={2} value={note} placeholder={question ? 'Pourquoi cette question ? Que cherche-t-on à éliminer ?' : 'Pourquoi cette étape, ce qu\'on vérifie…'} onChange={(ev) => setNote(ev.target.value)} />
      </label>
      <div className="ed-champ"><span>Bouton du logiciel</span><ChoixBouton guides={guides} valeur={lien} onChange={setLien} /></div>
      {!question && (
        <label className="gx-controle-edit">
          <input type="checkbox" checked={controle} onChange={(ev) => setControle(ev.target.checked)} />
          <span><b>Contrôle Oui / Non simple</b> (sans détour) ; pour des suites différentes selon la réponse, utilisez « Transformer en question ».</span>
        </label>
      )}
      {!question && controle && (
        <label className="gx-controle-edit">
          <span>Si Non, proposer l'astuce :</span>
          <select value={solutionId ?? ''} onChange={(ev) => setSolutionId(ev.target.value || null)}>
            <option value="">(aucune)</option>
            {astuces.map((s) => <option key={s.id} value={s.id}>{s.titre}{s.publiee ? '' : ' (brouillon)'}</option>)}
          </select>
        </label>
      )}
      <div className="ed-champ">
        <span>Photos {e.photos.length > 0 && <small className="muted">({e.photos.length}/{MAX_PHOTOS}, la première est la principale)</small>}</span>
        {e.photos.length > 0 && (
          <div className="ed-photos">
            {e.photos.map((ph, k) => (
              <div key={ph.id} className="ed-photo">
                <ImageApi chemin={ph.url} />
                <span>
                  <button type="button" className="btn petit" aria-label="Avancer la photo" disabled={k === 0} onClick={() => maj(`/admin/procedures/photos/${ph.id}/deplacer`, { method: 'POST', json: { sens: -1 } })}>←</button>
                  <button type="button" className="btn petit" aria-label="Reculer la photo" disabled={k === e.photos.length - 1} onClick={() => maj(`/admin/procedures/photos/${ph.id}/deplacer`, { method: 'POST', json: { sens: 1 } })}>→</button>
                  <button type="button" className="btn petit danger" aria-label="Retirer la photo" onClick={() => confirm('Retirer cette photo ?') && maj(`/admin/procedures/photos/${ph.id}`, { method: 'DELETE' })}>✕</button>
                </span>
              </div>
            ))}
          </div>
        )}
        {e.photos.length < MAX_PHOTOS && (
          <label className="btn petit ed-ajout-photo">
            {envoi ? 'Envoi…' : e.photos.length ? '📷 Ajouter des photos' : '📷 Ajouter une ou plusieurs photos'}
            <input type="file" accept="image/*" multiple hidden onChange={(ev) => { ajouterPhotos([...(ev.target.files ?? [])]); ev.target.value = ''; }} />
          </label>
        )}
      </div>
      {modifie && (
        <button type="button" className="btn prim" disabled={texte.trim().length < 2 || (!!lien.guide && !lien.ecran)} onClick={enregistrer}>Enregistrer</button>
      )}
      <SignalementsEtape etapeId={e.id} />
      {question ? (
        <div className="ed-liste-choix">
          <b>Réponses</b>
          {e.choix.map((c) => (
            <button key={c.id} type="button" className="ed-choix-ligne" onClick={() => choisir({ type: 'choix', id: c.id })}>
              <span>{c.libelle}</span><span className="muted petit">{libelleSuite(c, p)} ›</span>
            </button>
          ))}
          <AjoutChoix e={e} maj={maj} choisir={choisir} libelle="+ Ajouter une réponse" />
        </div>
      ) : (
        <button type="button" className="btn" onClick={enQuestion}>❓ Transformer en question (réponses Oui / Non, à modifier)</button>
      )}
    </div>
  );
}

/** « Pas clair » envoyés par les clients sur cette étape. */
function SignalementsEtape({ etapeId }: { etapeId: string }) {
  const { signalements, traiter } = useContext(Suivi);
  const l = signalements.filter((s) => s.etapeId === etapeId);
  if (!l.length) return null;
  return (
    <div className="ed-signalements">
      <b>❓ « Pas clair ? » ({l.filter((s) => !s.traite).length} à traiter)</b>
      {l.map((s) => (
        <div key={s.id} className={`ed-signalement ${s.traite ? 'traite' : ''}`}>
          <span className="petit">
            <b>{s.user.nom ?? s.user.identifiant}</b> · {new Date(s.createdAt).toLocaleDateString('fr-FR')}
            {s.message ? ` : « ${s.message} »` : ' (sans message)'}
          </span>
          <button type="button" className="btn petit" onClick={() => traiter(s, !s.traite)}>{s.traite ? 'Rouvrir' : '✓ Traité'}</button>
        </div>
      ))}
    </div>
  );
}

/** Bandeau de statistiques au-dessus du schéma. */
function ResumeStats() {
  const { stats } = useContext(Suivi);
  if (!stats) return null;
  if (!stats.tentatives) return <p className="petit muted ed-stats">📊 Pas encore de statistiques : elles apparaîtront quand des clients suivront la procédure.</p>;
  const f = stats.fins;
  return (
    <p className="petit ed-stats">
      📊 <b>{stats.tentatives}</b> tentative{stats.tentatives > 1 ? 's' : ''} · <b>{stats.terminees}</b> terminée{stats.terminees > 1 ? 's' : ''}
      {f.resolu > 0 && <> · ✅ {f.resolu} résolu{f.resolu > 1 ? 's' : ''}</>}
      {f.contact > 0 && <> · 📞 {f.contact} à contacter</>}
      {f.termine > 0 && <> · 🎉 {f.termine} jusqu'au bout</>}
      {stats.envoyes > 0 && <> · 📤 {stats.envoyes} résultat{stats.envoyes > 1 ? 's' : ''} envoyé{stats.envoyes > 1 ? 's' : ''}</>}
      <br /><span className="muted">Anonymes, sans les admins{stats.depuis ? `, depuis le ${new Date(stats.depuis).toLocaleDateString('fr-FR')}` : ''}. ⏸ = tentatives arrêtées à cette étape ; sur les réponses : nombre et part des choix.</span>
    </p>
  );
}

/** Panneau : une réponse (libellé, signification, suite, conclusion, astuce, procédure). */
function ChoixEditeur({ p, c, astuces, procedures, maj, choisir }: { p: Procedure; c: Choix; astuces: Solution[]; procedures: ResumeProcedure[]; maj: Maj; choisir(s: Sel): void }) {
  const question = p.etapes.find((e) => e.choix.some((x) => x.id === c.id))!;
  const [v, setV] = useState({
    libelle: c.libelle, signification: c.signification ?? '', suite: c.suite, etapeCibleId: c.etapeCibleId ?? '',
    conclusion: c.conclusion ?? '', solutionId: c.solutionId ?? '', procedureCibleId: c.procedureCibleId ?? '',
  });
  const modifie = v.libelle !== c.libelle || v.signification !== (c.signification ?? '') || v.suite !== c.suite || v.etapeCibleId !== (c.etapeCibleId ?? '')
    || v.conclusion !== (c.conclusion ?? '') || v.solutionId !== (c.solutionId ?? '') || v.procedureCibleId !== (c.procedureCibleId ?? '');
  const k = question.choix.findIndex((x) => x.id === c.id);
  const detour = lignePour(p, c.id);
  const principale = lignePour(p, null);
  const fin = v.suite === 'resolu' || v.suite === 'contact';
  return (
    <div className="carte form ed-fiche">
      <div className="gx-etape-tete">
        <b>Réponse</b>
        <span>
          <button type="button" className="btn petit" disabled={k === 0} aria-label="Monter" onClick={() => maj(`/admin/procedures/choix/${c.id}/deplacer`, { method: 'POST', json: { sens: -1 } })}>↑</button>
          <button type="button" className="btn petit" disabled={k === question.choix.length - 1} aria-label="Descendre" onClick={() => maj(`/admin/procedures/choix/${c.id}/deplacer`, { method: 'POST', json: { sens: 1 } })}>↓</button>
          <button type="button" className="btn petit danger" aria-label="Supprimer la réponse"
            onClick={() => confirm(detour.length ? 'Supprimer cette réponse et les étapes de son détour ?' : 'Supprimer cette réponse ?') && maj(`/admin/procedures/choix/${c.id}`, { method: 'DELETE' }).then((r) => r && choisir({ type: 'etape', id: question.id }))}>🗑</button>
        </span>
      </div>
      <p className="petit muted">
        Question : <button type="button" className="btn-lien" onClick={() => choisir({ type: 'etape', id: question.id })}>{court(decouperEtape(question.texte).texte, 70)}</button>
      </p>
      <label>Texte du bouton<input type="text" value={v.libelle} onChange={(ev) => setV({ ...v, libelle: ev.target.value })} /></label>
      <label>📝 Ce que veut dire cette réponse (pour vous et l'IA)
        <textarea rows={2} value={v.signification} placeholder="Ex. La pompe ne démarre pas : problème d'alimentation probable." onChange={(ev) => setV({ ...v, signification: ev.target.value })} />
      </label>
      <p className="petit">Détour : {detour.length ? `${detour.length} étape${detour.length > 1 ? 's' : ''} (à ajouter ou modifier dans le schéma)` : 'aucune étape (ajoutez-en avec « + étape dans ce détour » dans le schéma)'}</p>
      <label>Ensuite
        <select value={v.suite} onChange={(ev) => setV({ ...v, suite: ev.target.value as Choix['suite'] })}>
          {SUITES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </label>
      {v.suite === 'etape' && (
        <label>Aller à l'étape
          <select value={v.etapeCibleId} onChange={(ev) => setV({ ...v, etapeCibleId: ev.target.value })}>
            <option value="">(choisir)</option>
            {principale.map((e, n) => <option key={e.id} value={e.id}>{n + 1}. {court(decouperEtape(e.texte).texte, 70)}</option>)}
          </select>
        </label>
      )}
      {fin && (
        <label>Conclusion montrée au client (cause probable, gravité, que faire)
          <textarea rows={3} value={v.conclusion} onChange={(ev) => setV({ ...v, conclusion: ev.target.value })} />
        </label>
      )}
      <label>Proposer une astuce (facultatif)
        <select value={v.solutionId} onChange={(ev) => setV({ ...v, solutionId: ev.target.value })}>
          <option value="">(aucune)</option>
          {astuces.map((s) => <option key={s.id} value={s.id}>{s.titre}{s.publiee ? '' : ' (brouillon)'}</option>)}
        </select>
      </label>
      <label>Proposer une autre procédure (facultatif)
        <select value={v.procedureCibleId} onChange={(ev) => setV({ ...v, procedureCibleId: ev.target.value })}>
          <option value="">(aucune)</option>
          {procedures.filter((x) => x.id !== p.id).map((x) => <option key={x.id} value={x.id}>{x.titre}{x.publiee ? '' : ' (brouillon)'}</option>)}
        </select>
      </label>
      {modifie && (
        <button type="button" className="btn prim" disabled={!v.libelle.trim() || (v.suite === 'etape' && !v.etapeCibleId)}
          onClick={() => maj(`/admin/procedures/choix/${c.id}`, {
            method: 'PATCH',
            json: {
              libelle: v.libelle.trim(), signification: v.signification.trim() || null, suite: v.suite,
              etapeCibleId: v.suite === 'etape' ? v.etapeCibleId || null : null,
              conclusion: fin ? v.conclusion.trim() || null : null,
              solutionId: v.solutionId || null, procedureCibleId: v.procedureCibleId || null,
            },
          })}>
          Enregistrer
        </button>
      )}
    </div>
  );
}

/** Bouton de copie avec retour « ✓ Copié ». */
function BoutonCopier({ texte, libelle }: { texte: string | undefined; libelle: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn petit" disabled={!texte}
      onClick={async () => {
        if (texte && (await copier(texte))) {
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        }
      }}>
      {ok ? '✓ Copié' : libelle}
    </button>
  );
}

/**
 * Bloc IA : prompt de la procédure, résumé texte automatique (fabriqué par l'app à partir du schéma, sans IA),
 * copie du résumé seul ou précédé des prompts (à coller dans une IA), export JSON.
 */
function BlocIa({ p, maj }: { p: Procedure; maj: Maj }) {
  const [prompt, setPrompt] = useState(p.prompt ?? '');
  const [erreur, setErreur] = useState<unknown>();
  const [ex, setEx] = useState<{ resumeTexte: string; paquet: string }>();
  useEffect(() => {
    api<{ resumeTexte: string; paquet: string }>(`/ia/procedures/${p.id}`).then(setEx).catch(setErreur);
  }, [p.id, p.updatedAt]);
  const exporter = () => {
    if (!ex) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(ex, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `procedure-${p.titre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="carte form ed-ia">
      <b>🤖 IA</b>
      <label>Prompt de cette procédure (complète les consignes générales, dans Administration → Procédures)
        <textarea rows={4} value={prompt} placeholder="Ex. Tu aides un client à diagnostiquer la pompe. Ne propose jamais de démonter…" onChange={(ev) => setPrompt(ev.target.value)} />
      </label>
      {prompt !== (p.prompt ?? '') && (
        <button type="button" className="btn prim petit" onClick={() => maj(`/admin/procedures/${p.id}`, { method: 'PATCH', json: { prompt: prompt.trim() || null } })}>Enregistrer le prompt</button>
      )}
      <div className="ed-champ">
        <span>Résumé automatique <small className="muted">(fabriqué à partir du schéma, toujours à jour)</small></span>
        <pre className="ed-resume-ia">{ex?.resumeTexte ?? '…'}</pre>
      </div>
      <Erreur e={erreur} />
      <div className="ed-actions">
        <BoutonCopier texte={ex?.resumeTexte} libelle="📋 Copier le résumé" />
        <BoutonCopier texte={ex?.paquet} libelle="📋 Copier avec les prompts" />
        <button type="button" className="btn petit" disabled={!ex} onClick={exporter}>⬇ JSON</button>
      </div>
      <small className="muted">« Copier avec les prompts » : consignes générales + prompt de la procédure + résumé, prêt à coller dans une IA.</small>
    </div>
  );
}

/** Administration → une procédure : infos, publication, schéma (route principale, questions, détours), IA. */
export function AdminProcedure() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const guides = useGuidesAdmin();
  const { liste: astuces } = useSolutions();
  const [procedures, setProcedures] = useState<ResumeProcedure[]>([]);
  const [p, setP] = useState<Procedure>();
  const [erreur, setErreur] = useState<unknown>();
  const [infos, setInfos] = useState({ titre: '', categorie: '', resume: '', description: '' });
  const [sel, setSel] = useState<Sel>(null);
  const [stats, setStats] = useState<Stats>();
  const [signalements, setSignalements] = useState<Signalement[]>([]);

  const appliquer = (x: Procedure) => {
    setP(x);
    setInfos({ titre: x.titre, categorie: x.categorie, resume: x.resume ?? '', description: x.description ?? '' });
    viderProcedures();
  };
  useEffect(() => {
    api<Procedure>(`/procedures/${id}`).then(appliquer).catch(setErreur);
    chargerProcedures().then(setProcedures).catch(() => {});
    api<Stats>(`/admin/procedures/${id}/stats`).then(setStats).catch(() => {});
    api<Signalement[]>(`/admin/procedures/${id}/signalements`).then(setSignalements).catch(() => {});
  }, [id]);
  const traiter = (s: Signalement, traite: boolean) => {
    setSignalements((l) => l.map((x) => (x.id === s.id ? { ...x, traite } : x)));
    api(`/admin/procedures/signalements/${s.id}`, { method: 'PATCH', json: { traite } }).catch(setErreur);
  };
  /** Envoie une modification ; la procédure à jour si elle a réussi. */
  const maj: Maj = async (chemin, opts) => {
    setErreur(undefined);
    try {
      const r = await api<Procedure>(chemin, opts);
      appliquer(r);
      return r;
    } catch (e) {
      setErreur(e);
      return null;
    }
  };

  if (!p) return erreur ? <Erreur e={erreur} /> : <Chargement />;
  const infosModifiees = infos.titre !== p.titre || infos.categorie !== p.categorie || infos.resume !== (p.resume ?? '') || infos.description !== (p.description ?? '');
  const categories = [...new Set([...CATEGORIES, p.categorie])];
  const etapeSel = sel?.type === 'etape' ? p.etapes.find((e) => e.id === sel.id) : undefined;
  const choixSel = sel?.type === 'choix' ? p.etapes.flatMap((e) => e.choix).find((c) => c.id === sel.id) : undefined;
  const avertissements = alertes(p, signalements);

  return (
    <div className="page gx ed">
      <Link to="/admin/procedures" className="btn-lien">← Procédures</Link>
      <h1 className="gx-proc-titre">{p.titre}{estDiagnostic(p) && <span className="dg-badge ed-badge">Diagnostic</span>}</h1>
      <Erreur e={erreur} />

      <div className="ed-haut">
        <div className="ed-col">
          <label className="gx-publier carte">
            <input type="checkbox" checked={p.publiee}
              onChange={(ev) => {
                const publiee = ev.target.checked;
                setP({ ...p, publiee });
                maj(`/admin/procedures/${p.id}`, { method: 'PATCH', json: { publiee } }).then((ok) => !ok && setP(p));
              }} />
            <span><b>{p.publiee ? 'Publiée' : 'Brouillon'}</b><br /><span className="muted petit">{p.publiee ? 'Visible par les clients qui ont les procédures.' : 'Visible seulement par l\'admin.'}</span></span>
          </label>
          <div className="carte form">
            <label>Titre<input type="text" value={infos.titre} onChange={(e) => setInfos({ ...infos, titre: e.target.value })} /></label>
            <label>Catégorie
              <input type="text" list="categories-procedures" value={infos.categorie} onChange={(e) => setInfos({ ...infos, categorie: e.target.value })} />
              <datalist id="categories-procedures">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label>Résumé (court, vu par le client dans la liste)<textarea rows={2} value={infos.resume} onChange={(e) => setInfos({ ...infos, resume: e.target.value })} /></label>
            <label>Description (pour vous et l'IA : à quoi elle sert, quand l'utiliser, symptômes, machine)
              <textarea rows={4} value={infos.description} onChange={(e) => setInfos({ ...infos, description: e.target.value })} />
            </label>
            {infosModifiees && (
              <button type="button" className="btn prim" disabled={infos.titre.trim().length < 2 || infos.categorie.trim().length < 2}
                onClick={() => maj(`/admin/procedures/${p.id}`, { method: 'PATCH', json: { titre: infos.titre.trim(), categorie: infos.categorie.trim(), resume: infos.resume.trim() || null, description: infos.description.trim() || null } })}>
                Enregistrer
              </button>
            )}
          </div>
        </div>
        <div className="ed-col"><BlocIa key={p.prompt ?? ''} p={p} maj={maj} /></div>
      </div>

      <Suivi.Provider value={{ stats, signalements, traiter }}>
      <div className="ed-plan">
        <section className="carte ed-schema">
          <h4>Schéma <small className="muted">· cliquez sur une étape, une question ou une réponse pour la modifier</small></h4>
          <ResumeStats />
          {avertissements.length > 0 && (
            <ul className="ed-alertes">
              {avertissements.map((a, k) => (
                <li key={k}><button type="button" className="btn-lien" onClick={() => setSel(a.sel)}>⚠️ {a.texte}</button></li>
              ))}
            </ul>
          )}
          <Ligne p={p} brancheId={null} profondeur={0} sel={sel} choisir={setSel} maj={maj} />
          <div className="ed-terminus">■ Fin du parcours</div>
        </section>
        <aside className="ed-panneau">
          {etapeSel ? (
            <EtapeEditeur key={JSON.stringify(etapeSel)} p={p} e={etapeSel} guides={guides} astuces={astuces ?? []} maj={maj} choisir={setSel} />
          ) : choixSel ? (
            <ChoixEditeur key={JSON.stringify(choixSel)} p={p} c={choixSel} astuces={astuces ?? []} procedures={procedures} maj={maj} choisir={setSel} />
          ) : (
            <div className="carte ed-aide">
              <b>Comment ça marche</b>
              <ul>
                <li><b>Route principale</b> : les étapes numérotées, de haut en bas. « + » insère une étape à cet endroit.</li>
                <li><b>Question</b> : sélectionnez une étape puis « Transformer en question ». Chaque réponse ouvre un <b>détour</b> (ses propres étapes).</li>
                <li><b>Ensuite</b> : à la fin du détour, on revient sur la route (par défaut), on va à une étape, ou on termine (résolu / contacter Kiavik).</li>
                <li>Les <b>notes</b>, <b>significations</b> et la <b>description</b> ne sont pas montrées au client : elles servent à vous et à l'IA.</li>
              </ul>
            </div>
          )}
        </aside>
      </div>
      </Suivi.Provider>

      <p className="ed-liens">
        <Link to={`/procedures/${p.id}`}>Voir comme un client ›</Link>
      </p>
      <div className="ed-actions">
        <button type="button" className="btn"
          onClick={async () => {
            if (!confirm('Créer une copie de cette procédure (en brouillon), avec ses étapes, questions et photos ?')) return;
            try {
              const copie = await api<Procedure>(`/admin/procedures/${p.id}/dupliquer`, { method: 'POST' });
              viderProcedures();
              setSel(null);
              nav(`/admin/procedures/${copie.id}`);
            } catch (e) {
              setErreur(e);
            }
          }}>
          ⧉ Dupliquer
        </button>
      <button type="button" className="btn danger"
        onClick={async () => {
          if (!confirm('Supprimer cette procédure et ses photos ?')) return;
          await api(`/admin/procedures/${p.id}`, { method: 'DELETE' });
          viderProcedures();
          nav('/admin/procedures');
        }}>
        Supprimer la procédure
      </button>
      </div>
    </div>
  );
}
