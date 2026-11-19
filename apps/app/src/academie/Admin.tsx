import { useEffect, useState } from 'react';
import { RefId } from '../components/RefId';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { BlocPourQui, useCatalogue } from '../espaces/kiavik/Etiquettes';
import { api } from '../lib/api';
import { compresser } from '../lib/image';
import { useEspace } from '../lib/espace';
import { EnteteAdmin } from '../pages/Admin';
import { ImageApi } from '../espaces/kiavik/donneesProcedures';
import { PlacerReperes, Blocs, IframeIsolee } from './Blocs';
import { Bloc, Cours, duree, idVimeo, infosVimeo, TypeBloc } from './donnees';
import './academie.css';

/* Administration de l'Académie (en français) : cours → leçons → blocs, simulateurs. */

interface CoursAdmin {
  id: string; titre: string; description: string | null; publie: boolean; espace: string; type: 'parcours' | 'page'; couverture?: string; vignette?: string;
  cibleCategories: string[]; cibleModeles: string[]; pourQui: string[]; nbLecons: number; notes: number;
}
interface Simulateur { id: string; nom: string; espace: string; modeleId: string | null }

const TYPES: { t: TypeBloc; l: string }[] = [
  { t: 'titre', l: 'Titre' },
  { t: 'texte', l: 'Texte' },
  { t: 'vimeo', l: '🎬 Vimeo' },
  { t: 'image', l: '🖼 Image' },
  { t: 'encadre', l: '💡 Encadré' },
  { t: 'simulateur', l: '🖥 Simulateur' },
  { t: 'html', l: '🧩 HTML libre' },
  { t: 'fichier', l: '📎 Fichier' },
  { t: 'note', l: '📝 Note (admin)' },
];
const nouvelId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Administration → 🎓 Académie : les cours (Lazzeko et Kiavik), ordre, état, « Créer depuis Vimeo ». */
export function AdminAcademie() {
  const { espaces, espace } = useEspace();
  const nav = useNavigate();
  const [l, setL] = useState<CoursAdmin[]>();
  const [err, setErr] = useState<unknown>();
  const [fEsp, setFEsp] = useState(espace.slug);
  const [titre, setTitre] = useState('');
  const [type, setType] = useState<'parcours' | 'page'>('parcours');
  const [vimeo, setVimeo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState('');
  const charger = () => api<CoursAdmin[]>('/admin/academie/cours').then(setL).catch(setErr);
  useEffect(() => {
    charger();
  }, []);
  const creer = async () => {
    const c = await api<{ id: string; lecons: { id: string }[] }>('/admin/academie/cours', { method: 'POST', json: { espace: fEsp, titre, type } }).catch(setErr);
    // une page : on va directement à son contenu ; « Pour qui ? » et publication se règlent ensuite
    if (c) nav(type === 'page' && c.lecons[0] ? `/admin/academie/lecons/${c.lecons[0].id}` : `/admin/academie/cours/${c.id}`);
  };
  /** Un cours avec une leçon par vidéo (titres et vignettes lus sur Vimeo). */
  const depuisVimeo = async () => {
    const liens = (vimeo ?? '').split(/\s+/).map((x) => x.trim()).filter((x) => idVimeo(x));
    if (!liens.length || !titre.trim()) return;
    setErr(undefined);
    try {
      const c = await api<{ id: string }>('/admin/academie/cours', { method: 'POST', json: { espace: fEsp, titre } });
      for (const [i, url] of liens.entries()) {
        setEnvoi(`Vidéo ${i + 1} / ${liens.length}…`);
        const info = await infosVimeo(url);
        await api(`/admin/academie/cours/${c.id}/lecons`, {
          method: 'POST',
          json: { titre: info?.titre || `Leçon ${i + 1}`, blocs: [{ id: nouvelId(), type: 'vimeo', url, ...(info ?? {}) }] },
        });
      }
      nav(`/admin/academie/cours/${c.id}`);
    } catch (e) {
      setErr(e);
    } finally {
      setEnvoi('');
    }
  };
  if (!l) return err ? <Erreur e={err} /> : <Chargement />;
  const liste = l.filter((c) => c.espace === fEsp);
  return (
    <div className="page ac-admin">
      <EnteteAdmin titre="🎓 Académie" zone="commun" />
      <p className="muted petit">
        <b>Parcours</b> : une formation en plusieurs leçons (progression du client). <b>Page</b> : un contenu seul (simulateur, fiche technique, vidéo),
        rangé dans « Mes outils » ; un simulateur seul s'affiche en plein écran. « Pour qui ? » : tout le monde, une machine ou une catégorie (les autres clients ne le voient pas).
        Le contenu se compose de blocs (texte, Vimeo, image, simulateur, HTML…). <Link to="/admin/academie/simulateurs">🖥 Bibliothèque de simulateurs ›</Link>
      </p>
      <Link to="/admin/academie/terrain" className="bandeau lien-bandeau">
        <span><b>🎥 Mode terrain</b> : préparer une leçon devant la machine (photos, dictée, notes), la finir ici ensuite</span>
        <span>›</span>
      </Link>
      <div className="seg">
        {espaces.map((e) => (
          <button key={e.slug} type="button" className={fEsp === e.slug ? 'on' : ''} onClick={() => setFEsp(e.slug)}>{e.nom}</button>
        ))}
      </div>
      <Erreur e={err} />
      <div className="carte form">
        <div className="seg">
          <button type="button" className={type === 'parcours' ? 'on' : ''} onClick={() => setType('parcours')}>📚 Parcours</button>
          <button type="button" className={type === 'page' ? 'on' : ''} onClick={() => ((setType('page'), setVimeo(null)))}>🧰 Page</button>
        </div>
        <input value={titre} maxLength={150} placeholder={type === 'page' ? 'Titre de la page (ex. Simulateur 300 W)' : 'Titre du parcours (ex. Prise en main DXonJet)'} onChange={(e) => setTitre(e.target.value)} />
        <div className="cx-actions">
          <button type="button" className="btn prim" disabled={titre.trim().length < 2} onClick={creer}>{type === 'page' ? '+ Créer la page' : '+ Créer le parcours'}</button>
          {type === 'parcours' && <button type="button" className="btn" onClick={() => setVimeo(vimeo === null ? '' : null)}>🎬 Créer depuis Vimeo…</button>}
        </div>
        {vimeo !== null && (
          <>
            <textarea rows={5} value={vimeo} placeholder={'Collez les liens Vimeo, un par ligne :\nhttps://vimeo.com/123456789\nhttps://vimeo.com/987654321/abcdef1234'} onChange={(e) => setVimeo(e.target.value)} />
            <small className="muted">Une leçon par vidéo, dans l'ordre ; titres et vignettes lus sur Vimeo. {(vimeo.split(/\s+/).filter((x) => idVimeo(x)).length)} lien(s) reconnu(s).</small>
            <button type="button" className="btn prim" disabled={!!envoi || titre.trim().length < 2 || !vimeo.split(/\s+/).some((x) => idVimeo(x))} onClick={depuisVimeo}>{envoi || 'Créer le cours et ses leçons'}</button>
          </>
        )}
      </div>
      <div className="liste">
        {liste.map((c, i) => (
          <div key={c.id} className="carte ac-ligne">
            <Link to={`/admin/academie/cours/${c.id}`} className="ac-ligne-lien">
              <b>{c.type === 'page' ? '🧰' : '📚'} {c.titre} <RefId id={c.id} p="C" /></b>
              <small className="muted">
                {c.type === 'page' ? 'page' : `${c.nbLecons} leçon${c.nbLecons > 1 ? 's' : ''}`} · {c.pourQui.length ? `🎯 ${c.pourQui.join(', ')}` : 'tout le monde'}
                {c.publie ? ' · ✅ publié' : ' · ✏️ brouillon'}
                {c.notes > 0 && ` · 📝 ${c.notes} note${c.notes > 1 ? 's' : ''} à traiter`}
              </small>
            </Link>
            <span className="cx-actions">
              <button type="button" className="btn petit" disabled={i === 0} onClick={() => api(`/admin/academie/cours/${c.id}/deplacer`, { method: 'POST', json: { sens: -1 } }).then(charger)}>↑</button>
              <button type="button" className="btn petit" disabled={i === liste.length - 1} onClick={() => api(`/admin/academie/cours/${c.id}/deplacer`, { method: 'POST', json: { sens: 1 } }).then(charger)}>↓</button>
            </span>
          </div>
        ))}
        {!liste.length && <p className="muted">Rien dans cet espace pour l'instant.</p>}
      </div>
    </div>
  );
}

/** Un cours : titre, description, couverture, « Pour qui ? », publié ; ses leçons (ordre, ajout, suppression). */
export function AdminCours() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState<Cours>();
  const [err, setErr] = useState<unknown>();
  const [ok, setOk] = useState('');
  const [nouvelle, setNouvelle] = useState('');
  const charger = () => api<Cours>(`/academie/cours/${id}`).then(setC).catch(setErr);
  useEffect(() => {
    charger();
  }, [id]);
  if (!c) return err ? <Erreur e={err} /> : <Chargement />;
  const enregistrer = async (json: Record<string, unknown>) => {
    setErr(undefined);
    try {
      await api(`/admin/academie/cours/${id}`, { method: 'PATCH', json });
      setOk('✓ Enregistré');
      setTimeout(() => setOk(''), 1500);
      charger();
    } catch (e) {
      setErr(e);
    }
  };
  const couverture = async (f?: File) => {
    if (!f) return;
    const fd = new FormData();
    fd.append('image', (await compresser(f)).fichier, 'couverture.jpg');
    await api(`/admin/academie/cours/${id}/couverture`, { method: 'PUT', body: fd }).catch(setErr);
    charger();
  };
  return (
    <div className="page ac-admin">
      <Link to="/admin/academie" className="btn-lien">← Académie</Link>
      <h1>{c.titre} <RefId id={c.id} p="C" /></h1>
      <Erreur e={err} />
      {ok && <p className="succes">{ok}</p>}
      <div className="carte form">
        <label>Titre<input defaultValue={c.titre} maxLength={150} onBlur={(e) => e.target.value.trim() !== c.titre && enregistrer({ titre: e.target.value })} /></label>
        <label>Description (courte, vue dans la liste)<textarea defaultValue={c.description ?? ''} rows={2} maxLength={1000} onBlur={(e) => e.target.value !== (c.description ?? '') && enregistrer({ description: e.target.value || null })} /></label>
        <label>Type
          <select value={c.type} onChange={(e) => enregistrer({ type: e.target.value })}>
            <option value="parcours">📚 Parcours (plusieurs leçons)</option>
            <option value="page">🧰 Page (un contenu seul, dans « Mes outils »)</option>
          </select>
        </label>
        <label className="interrupteur"><input type="checkbox" checked={c.publie} onChange={(e) => enregistrer({ publie: e.target.checked })} /> Publié (visible par les clients)</label>
        <label>
          Image de couverture <small className="muted">(sinon la vignette de la première vidéo)</small>
          <input type="file" accept="image/*" onChange={(e) => couverture(e.target.files?.[0])} />
        </label>
        {c.couverture && (
          <div className="ac-apercu-couv">
            <small className="muted">Aperçu (comme le client la voit) : image entière, format 16/9 ; idéal : photo en paysage, sujet au centre.</small>
            <ImageApi chemin={c.couverture.replace(/^\/api/, '')} className="ac-vignette" />
            <button type="button" className="btn-lien petit" onClick={() => api(`/admin/academie/cours/${id}/couverture`, { method: 'DELETE' }).then(charger)}>Retirer la couverture</button>
          </div>
        )}
      </div>
      <div className="carte form">
        <BlocPourQui
          valeur={{ espace: c.espace as 'lazzeko' | 'kiavik', cibleCategories: c.cibleCategories, cibleModeles: c.cibleModeles, etiquettes: [] }}
          onChange={(v) => enregistrer({ espace: v.espace, cibleCategories: v.cibleCategories, cibleModeles: v.cibleModeles })}
        />
        <small className="muted">Seuls les clients qui ont ces machines (ou une machine de ces catégories) le voient.</small>
      </div>

      {c.type === 'page' ? (
        <div className="cx-actions">
          {c.lecons[0] && <Link to={`/admin/academie/lecons/${c.lecons[0].id}`} className="btn prim">✏️ Modifier le contenu de la page</Link>}
        </div>
      ) : (<>
      <h2>Leçons</h2>
      <div className="liste">
        {c.lecons.map((l, i) => (
          <div key={l.id} className="carte ac-ligne">
            <Link to={`/admin/academie/lecons/${l.id}`} className="ac-ligne-lien"><b>{i + 1}. {l.titre} <RefId id={l.id} p="L" /></b></Link>
            <span className="cx-actions">
              <button type="button" className="btn petit" disabled={i === 0} onClick={() => api(`/admin/academie/lecons/${l.id}/deplacer`, { method: 'POST', json: { sens: -1 } }).then(charger)}>↑</button>
              <button type="button" className="btn petit" disabled={i === c.lecons.length - 1} onClick={() => api(`/admin/academie/lecons/${l.id}/deplacer`, { method: 'POST', json: { sens: 1 } }).then(charger)}>↓</button>
              <button type="button" className="btn petit danger" onClick={() => confirm(`Supprimer la leçon « ${l.titre} » ?`) && api(`/admin/academie/lecons/${l.id}`, { method: 'DELETE' }).then(charger)}>🗑</button>
            </span>
          </div>
        ))}
      </div>
      <div className="ba-libre">
        <input value={nouvelle} maxLength={150} placeholder="+ Leçon (titre)" onChange={(e) => setNouvelle(e.target.value)} />
        <button type="button" className="btn prim" disabled={!nouvelle.trim()} onClick={async () => {
          const l = await api<{ id: string }>(`/admin/academie/cours/${id}/lecons`, { method: 'POST', json: { titre: nouvelle } }).catch(setErr);
          if (l) nav(`/admin/academie/lecons/${l.id}`);
        }}>Ajouter</button>
      </div>
      </>)}
      <div className="cx-actions" style={{ marginTop: 20 }}>
        <Link to={`/academie/${id}`} className="btn">👁 Voir comme un client</Link>
        <button type="button" className="btn danger" onClick={async () => {
          if (!confirm(c.type === 'page' ? `Supprimer la page « ${c.titre} » ?` : `Supprimer le parcours « ${c.titre} » et ses ${c.lecons.length} leçon(s) ?`)) return;
          await api(`/admin/academie/cours/${id}`, { method: 'DELETE' });
          nav('/admin/academie');
        }}>🗑 Supprimer</button>
      </div>
    </div>
  );
}

/** Une leçon : titre et blocs (ajouter, ordre, modifier, supprimer), aperçu, enregistrer. */
export function AdminLecon() {
  const { id = '' } = useParams();
  const [titre, setTitre] = useState('');
  const [blocs, setBlocs] = useState<Bloc[]>();
  const [coursId, setCoursId] = useState('');
  const [modifie, setModifie] = useState(false);
  const [apercu, setApercu] = useState(false);
  const [err, setErr] = useState<unknown>();
  const [ok, setOk] = useState('');
  const [sims, setSims] = useState<Simulateur[]>([]);
  useEffect(() => {
    api<{ titre: string; blocs: Bloc[]; cours: { id: string } }>(`/academie/lecons/${id}`)
      .then((l) => (setTitre(l.titre), setBlocs(l.blocs), setCoursId(l.cours.id)))
      .catch(setErr);
    api<Simulateur[]>('/admin/academie/simulateurs').then(setSims).catch(() => {});
  }, [id]);
  if (!blocs) return err ? <Erreur e={err} /> : <Chargement />;
  const maj = (l: Bloc[]) => (setBlocs(l), setModifie(true));
  const majBloc = (i: number, b: Bloc) => maj(blocs.map((x, j) => (j === i ? b : x)));
  const deplacer = (i: number, s: -1 | 1) => {
    const l = [...blocs];
    [l[i], l[i + s]] = [l[i + s], l[i]];
    maj(l);
  };
  const ajouter = (t: TypeBloc) => maj([...blocs, { id: nouvelId(), type: t, ...(t === 'encadre' ? { niveau: 'astuce' as const } : {}) }]);
  const enregistrer = async () => {
    setErr(undefined);
    try {
      // champs d'affichage (chemin, nom) recalculés par le serveur
      const propres = blocs.map(({ chemin: _c, nom, ...b }) => (b.type === 'fichier' ? { ...b, nom } : b));
      await api(`/admin/academie/lecons/${id}`, { method: 'PATCH', json: { titre, blocs: propres } });
      setModifie(false);
      setOk('✓ Enregistré');
      setTimeout(() => setOk(''), 1500);
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="page ac-admin">
      <Link to={`/admin/academie/cours/${coursId}`} className="btn-lien">← Réglages (Pour qui ?, publication)</Link> <RefId id={id} p="L" />
      <input className="ac-titre-lecon" value={titre} maxLength={150} onChange={(e) => ((setTitre(e.target.value), setModifie(true)))} />
      <div className="seg">
        <button type="button" className={!apercu ? 'on' : ''} onClick={() => setApercu(false)}>✏️ Blocs</button>
        <button type="button" className={apercu ? 'on' : ''} onClick={() => setApercu(true)}>👁 Aperçu</button>
      </div>
      {apercu ? (
        <Blocs blocs={blocs} />
      ) : (
        <div className="ac-editeur">
          {blocs.map((b, i) => (
            <div key={b.id} className="carte ac-bloc-edit">
              <div className="ac-bloc-tete">
                <b className="petit">{TYPES.find((x) => x.t === b.type)?.l}</b>
                <span className="cx-actions">
                  <button type="button" className="btn petit" disabled={i === 0} onClick={() => deplacer(i, -1)}>↑</button>
                  <button type="button" className="btn petit" disabled={i === blocs.length - 1} onClick={() => deplacer(i, 1)}>↓</button>
                  <button type="button" className="btn petit danger" onClick={() => maj(blocs.filter((_, j) => j !== i))}>🗑</button>
                </span>
              </div>
              <EditeurBloc b={b} sims={sims} onChange={(x) => majBloc(i, x)} onErreur={setErr} />
            </div>
          ))}
          {!blocs.length && <p className="muted">Page vide : ajoutez un premier bloc.</p>}
          <div className="ac-ajout puces">
            <span className="petit muted">＋ Bloc :</span>
            {TYPES.map((x) => <button key={x.t} type="button" className="puce" onClick={() => ajouter(x.t)}>{x.l}</button>)}
          </div>
        </div>
      )}
      <Erreur e={err} />
      <div className="ac-barre-enreg">
        {ok && <span className="succes">{ok}</span>}
        <button type="button" className="btn prim" disabled={!modifie || !titre.trim()} onClick={enregistrer}>{modifie ? 'Enregistrer' : 'Enregistré'}</button>
        <Link to={`/academie/lecons/${id}`} className="btn">👁 Voir comme un client</Link>
      </div>
    </div>
  );
}

/** Formulaire d'un bloc selon son type. */
function EditeurBloc({ b, sims, onChange, onErreur }: { b: Bloc; sims: Simulateur[]; onChange(b: Bloc): void; onErreur(e: unknown): void }) {
  const [lecture, setLecture] = useState(false);
  const envoyer = async (f?: File, image = false) => {
    if (!f) return;
    try {
      const fd = new FormData();
      fd.append('fichier', image ? (await compresser(f)).fichier : f, image ? 'image.jpg' : f.name);
      const r = await api<{ id: string; nom: string; chemin: string }>('/admin/academie/fichiers', { method: 'POST', body: fd });
      onChange({ ...b, fichierId: r.id, chemin: r.chemin, ...(image ? {} : { nom: b.nom || r.nom, url: undefined }) });
    } catch (e) {
      onErreur(e);
    }
  };
  switch (b.type) {
    case 'titre':
      return <input value={b.texte ?? ''} maxLength={200} placeholder="Intertitre" onChange={(e) => onChange({ ...b, texte: e.target.value })} />;
    case 'note':
      return <textarea rows={2} value={b.texte ?? ''} maxLength={4000} placeholder="Rappel pour vous (jamais vu par les clients) : ex. vidéo à placer ici" onChange={(e) => onChange({ ...b, texte: e.target.value })} />;
    case 'texte':
      return (
        <>
          <textarea rows={6} value={b.texte ?? ''} maxLength={20000} placeholder="Texte. Ligne vide = nouveau paragraphe ; « - » en début de ligne = liste ; **gras** ; *italique* ; [lien](https://…)" onChange={(e) => onChange({ ...b, texte: e.target.value })} />
        </>
      );
    case 'encadre':
      return (
        <>
          <div className="seg">
            <button type="button" className={b.niveau !== 'avertissement' ? 'on' : ''} onClick={() => onChange({ ...b, niveau: 'astuce' })}>💡 Astuce</button>
            <button type="button" className={b.niveau === 'avertissement' ? 'on' : ''} onClick={() => onChange({ ...b, niveau: 'avertissement' })}>⚠️ Attention</button>
          </div>
          <textarea rows={2} value={b.texte ?? ''} maxLength={4000} onChange={(e) => onChange({ ...b, texte: e.target.value })} />
        </>
      );
    case 'vimeo':
      return (
        <>
          <input
            value={b.url ?? ''}
            placeholder="Lien Vimeo (https://vimeo.com/123456789…)"
            onChange={(e) => onChange({ ...b, url: e.target.value })}
            onBlur={async (e) => {
              if (!idVimeo(e.target.value)) return;
              setLecture(true);
              const info = await infosVimeo(e.target.value);
              setLecture(false);
              if (info) onChange({ ...b, url: e.target.value, ...info, titre: b.titre || info.titre });
            }}
          />
          {b.url && !idVimeo(b.url) && <small className="alerte">Lien Vimeo non reconnu</small>}
          {lecture && <small className="muted">Lecture des infos Vimeo…</small>}
          <input value={b.titre ?? ''} maxLength={200} placeholder="Titre affiché sur la vignette" onChange={(e) => onChange({ ...b, titre: e.target.value })} />
          {b.vignette && <img src={b.vignette} alt="" className="ac-mini" />}
          {b.duree ? <small className="muted">Durée {duree(b.duree)}</small> : null}
        </>
      );
    case 'image':
      return (
        <>
          <input type="file" accept="image/*" onChange={(e) => envoyer(e.target.files?.[0], true)} />
          <PlacerReperes b={b} onChange={onChange} />
          <input value={b.legende ?? ''} maxLength={300} placeholder="Légende (facultatif)" onChange={(e) => onChange({ ...b, legende: e.target.value })} />
        </>
      );
    case 'fichier':
      return (
        <>
          <input value={b.nom ?? ''} maxLength={200} placeholder="Nom affiché (ex. Notice F1080)" onChange={(e) => onChange({ ...b, nom: e.target.value })} />
          <input value={b.url ?? ''} placeholder="Lien https://… (ou envoyer un PDF ci-dessous)" onChange={(e) => onChange({ ...b, url: e.target.value || undefined, ...(e.target.value ? { fichierId: undefined } : {}) })} />
          <input type="file" accept="application/pdf,image/*" onChange={(e) => envoyer(e.target.files?.[0])} />
          {b.fichierId && <small className="muted">📎 fichier envoyé</small>}
        </>
      );
    case 'simulateur':
      return (
        <>
          <select value={b.simulateurId ?? ''} onChange={(e) => onChange({ ...b, simulateurId: e.target.value })}>
            <option value="">— Choisir un simulateur —</option>
            {sims.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.espace})</option>)}
          </select>
          <small className="muted">Les simulateurs s'envoient une fois dans la <Link to="/admin/academie/simulateurs">bibliothèque</Link>.</small>
        </>
      );
    case 'html':
      return (
        <>
          <textarea rows={8} className="ac-code" value={b.html ?? ''} maxLength={500000} placeholder="Collez votre code HTML (il s'affiche dans une boîte isolée : il ne peut pas toucher à l'app)" onChange={(e) => onChange({ ...b, html: e.target.value })} />
          <label className="petit">Hauteur fixe en pixels (vide = automatique)
            <input type="number" min={80} max={4000} value={b.hauteur ?? ''} onChange={(e) => onChange({ ...b, hauteur: e.target.value ? Number(e.target.value) : undefined })} />
          </label>
        </>
      );
  }
}

/** Bibliothèque de simulateurs : un fichier HTML par machine, envoyé une fois, réutilisé dans les leçons. */
export function AdminSimulateurs() {
  const { espaces, espace } = useEspace();
  const catalogue = useCatalogue();
  const [l, setL] = useState<Simulateur[]>();
  const [err, setErr] = useState<unknown>();
  const [f, setF] = useState({ nom: '', espace: espace.slug, modeleId: '' });
  const [fichier, setFichier] = useState<File>();
  const [voir, setVoir] = useState<{ nom: string; html: string } | null>(null);
  const charger = () => api<Simulateur[]>('/admin/academie/simulateurs').then(setL).catch(setErr);
  useEffect(() => {
    charger();
  }, []);
  const modeles = catalogue.flatMap((fa) => fa.modeles.map((m) => ({ id: m.id, nom: `${fa.nom} ${m.nom}`, espaces: m.espaces })));
  const envoyer = async () => {
    if (!fichier) return;
    const fd = new FormData();
    fd.append('fichier', fichier, fichier.name);
    fd.append('nom', f.nom || fichier.name.replace(/\.html?$/i, ''));
    fd.append('espace', f.espace);
    if (f.modeleId) fd.append('modeleId', f.modeleId);
    try {
      await api('/admin/academie/simulateurs', { method: 'POST', body: fd });
      setF({ ...f, nom: '', modeleId: '' });
      setFichier(undefined);
      charger();
    } catch (e) {
      setErr(e);
    }
  };
  const remplacer = async (s: Simulateur, x?: File) => {
    if (!x) return;
    const fd = new FormData();
    fd.append('fichier', x, x.name);
    await api(`/admin/academie/simulateurs/${s.id}`, { method: 'PATCH', body: fd }).catch(setErr);
    charger();
  };
  if (!l) return err ? <Erreur e={err} /> : <Chargement />;
  return (
    <div className="page ac-admin">
      <Link to="/admin/academie" className="btn-lien">← Académie</Link>
      <h1>🖥 Simulateurs</h1>
      <p className="muted petit">Un fichier HTML par machine (votre simulateur d'écran). Envoyé une fois, il se choisit dans les leçons (bloc « Simulateur ») ; le remplacer met à jour toutes les leçons. Il s'affiche dans une boîte isolée.</p>
      <Erreur e={err} />
      <div className="carte form">
        <b>+ Nouveau simulateur</b>
        <input type="file" accept=".html,.htm,text/html" onChange={(e) => setFichier(e.target.files?.[0])} />
        <input value={f.nom} maxLength={100} placeholder="Nom (ex. Écran DXonJet F1080)" onChange={(e) => setF({ ...f, nom: e.target.value })} />
        <div className="seg">
          {espaces.map((e) => <button key={e.slug} type="button" className={f.espace === e.slug ? 'on' : ''} onClick={() => setF({ ...f, espace: e.slug })}>{e.nom}</button>)}
        </div>
        <select value={f.modeleId} onChange={(e) => setF({ ...f, modeleId: e.target.value })}>
          <option value="">Machine (facultatif)</option>
          {modeles.filter((m) => m.espaces.includes(f.espace)).map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <button type="button" className="btn prim" disabled={!fichier} onClick={envoyer}>Envoyer</button>
      </div>
      <div className="liste">
        {l.map((s) => (
          <div key={s.id} className="carte ac-ligne">
            <span className="ac-ligne-lien">
              <b>{s.nom} <RefId id={s.id} p="S" /></b>
              <small className="muted">{s.espace}{s.modeleId ? ` · ${modeles.find((m) => m.id === s.modeleId)?.nom ?? ''}` : ''}</small>
            </span>
            <span className="cx-actions">
              <button type="button" className="btn petit" onClick={() => api<{ nom: string; html: string }>(`/academie/simulateurs/${s.id}`).then(setVoir).catch(setErr)}>👁</button>
              <label className="btn petit">⟳ Remplacer<input type="file" accept=".html,.htm,text/html" hidden onChange={(e) => remplacer(s, e.target.files?.[0])} /></label>
              <button type="button" className="btn petit" onClick={() => {
                const nom = prompt('Nom du simulateur', s.nom)?.trim();
                if (nom) api(`/admin/academie/simulateurs/${s.id}`, { method: 'PATCH', body: (() => { const fd = new FormData(); fd.append('nom', nom); return fd; })() }).then(charger).catch(setErr);
              }}>✏️</button>
              <button type="button" className="btn petit danger" onClick={() => confirm(`Supprimer « ${s.nom} » ? Les leçons qui l'utilisent afficheront « indisponible ».`) && api(`/admin/academie/simulateurs/${s.id}`, { method: 'DELETE' }).then(charger)}>🗑</button>
            </span>
          </div>
        ))}
        {!l.length && <p className="muted">Aucun simulateur pour l'instant.</p>}
      </div>
      {voir && (
        <div className="carte">
          <div className="cx-actions"><b>{voir.nom}</b><button type="button" className="btn petit" onClick={() => setVoir(null)}>Fermer</button></div>
          <IframeIsolee html={voir.html} titre={voir.nom} />
        </div>
      )}
    </div>
  );
}
