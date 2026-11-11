import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { compresser } from '../../lib/image';
import { chargerGuide, Guide, pastillesNavigation, ResumeGuide } from './guides';
import { chargerProcedures, Etape, ImageApi, Procedure, ResumeProcedure, viderProcedures } from './donneesProcedures';
import './guides.css';

const CATEGORIES = ['Impression', 'Réglages', 'Entretien'];

/** Administration → Procédures : liste, création. */
export function AdminProcedures() {
  const nav = useNavigate();
  const [liste, setListe] = useState<ResumeProcedure[]>();
  const [erreur, setErreur] = useState<unknown>();
  const [titre, setTitre] = useState('');
  useEffect(() => {
    viderProcedures();
    chargerProcedures().then(setListe).catch(setErreur);
  }, []);
  const creer = async () => {
    try {
      const p = await api<Procedure>('/admin/procedures', { method: 'POST', json: { titre: titre.trim() } });
      viderProcedures();
      nav(`/admin/procedures/${p.id}`);
    } catch (e) {
      setErreur(e);
    }
  };
  if (!liste) return erreur ? <Erreur e={erreur} /> : <Chargement />;
  return (
    <div className="page gx">
      <Link to="/admin" className="btn-lien">← Administration</Link>
      <h1>Procédures</h1>
      <Erreur e={erreur} />
      <div className="carte form">
        <label>
          Nouvelle procédure
          <input type="text" value={titre} placeholder="Titre, ex. Changer une cartouche" onChange={(e) => setTitre(e.target.value)} />
        </label>
        <button type="button" className="btn prim" disabled={titre.trim().length < 2} onClick={creer}>Créer</button>
      </div>
      <h4>{liste.length} procédure{liste.length > 1 ? 's' : ''}</h4>
      <div className="gx-resultats">
        {liste.map((p) => (
          <Link key={p.id} to={`/admin/procedures/${p.id}`} className="carte gx-resultat">
            <b>{p.titre}</b>
            <span className="petit muted">
              {p.categorie} · {p.nbEtapes} étape{p.nbEtapes > 1 ? 's' : ''}
              {p.publiee ? <span className="gx-publiee">publiée</span> : <span className="gx-brouillon">brouillon</span>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Choix d'un bouton de guide (guide → écran → pastille) pour une étape. */
export function useGuidesAdmin() {
  const [guides, setGuides] = useState<Guide[]>([]);
  useEffect(() => {
    api<ResumeGuide[]>('/guides')
      .then((l) => Promise.all(l.map((g) => chargerGuide(g.slug))))
      .then(setGuides)
      .catch(() => {});
  }, []);
  return guides;
}

export type Lien = { guide: string | null; ecran: string | null; pastille: string | null };

export function ChoixBouton({ guides, valeur, onChange }: { guides: Guide[]; valeur: Lien; onChange(l: Lien): void }) {
  const g = guides.find((x) => x.slug === valeur.guide);
  const e = g?.ecrans.find((x) => x.id === valeur.ecran);
  const boutons = useMemo(() => {
    if (!g || !e) return [];
    const nav = pastillesNavigation(g, e).filter((n) => n.info).map((n) => n.info!);
    return [...e.pastilles, ...nav];
  }, [g, e]);
  return (
    <div className="gx-choix-bouton">
      <select value={valeur.guide ?? ''} onChange={(ev) => onChange({ guide: ev.target.value || null, ecran: null, pastille: null })}>
        <option value="">Aucun bouton lié</option>
        {guides.map((x) => <option key={x.slug} value={x.slug}>{x.nom}</option>)}
      </select>
      {g && (
        <select value={valeur.ecran ?? ''} onChange={(ev) => onChange({ ...valeur, ecran: ev.target.value || null, pastille: null })}>
          <option value="">Écran…</option>
          {g.ecrans.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.titre}</option>)}
        </select>
      )}
      {e && (
        <select value={valeur.pastille ?? ''} onChange={(ev) => onChange({ ...valeur, pastille: ev.target.value || null })}>
          <option value="">(tout l'écran)</option>
          {boutons.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.titre}</option>)}
        </select>
      )}
    </div>
  );
}

function EtapeEditeur({ e, n, total, guides, maj }: { e: Etape; n: number; total: number; guides: Guide[]; maj(chemin: string, opts: RequestInit & { json?: unknown }): Promise<boolean> }) {
  const [texte, setTexte] = useState(e.texte);
  const [avert, setAvert] = useState(e.avertissement ?? '');
  const [lien, setLien] = useState<Lien>({ guide: e.guide, ecran: e.ecran, pastille: e.pastille });
  const [envoi, setEnvoi] = useState(false);
  const modifie = texte !== e.texte || avert !== (e.avertissement ?? '') || lien.guide !== e.guide || lien.ecran !== e.ecran || lien.pastille !== e.pastille;
  const lienIncomplet = !!lien.guide && !lien.ecran;
  const photo = async (f?: File) => {
    if (!f) return;
    setEnvoi(true);
    const { fichier } = await compresser(f);
    const fd = new FormData();
    fd.append('photo', fichier, 'photo.jpg');
    await maj(`/admin/procedures/etapes/${e.id}/photo`, { method: 'POST', body: fd }).finally(() => setEnvoi(false));
  };
  return (
    <li className="carte gx-etape-edit">
      <div className="gx-etape-tete">
        <b>Étape {n + 1}</b>
        <span>
          <button type="button" className="btn petit" disabled={n === 0} aria-label="Monter" onClick={() => maj(`/admin/procedures/etapes/${e.id}/deplacer`, { method: 'POST', json: { sens: -1 } })}>↑</button>
          <button type="button" className="btn petit" disabled={n === total - 1} aria-label="Descendre" onClick={() => maj(`/admin/procedures/etapes/${e.id}/deplacer`, { method: 'POST', json: { sens: 1 } })}>↓</button>
          <button type="button" className="btn petit danger" aria-label="Supprimer l'étape" onClick={() => confirm('Supprimer cette étape ?') && maj(`/admin/procedures/etapes/${e.id}`, { method: 'DELETE' })}>🗑</button>
        </span>
      </div>
      <textarea rows={3} value={texte} onChange={(ev) => setTexte(ev.target.value)} aria-label="Texte de l'étape" />
      <input type="text" value={avert} placeholder="⚠️ Avertissement (facultatif)" onChange={(ev) => setAvert(ev.target.value)} />
      <ChoixBouton guides={guides} valeur={lien} onChange={setLien} />
      <div className="gx-etape-photo-edit">
        {e.photo && <ImageApi chemin={e.photo} className="gx-etape-photo" />}
        <label className="btn petit">
          {envoi ? 'Envoi…' : e.photo ? '📷 Changer la photo' : '📷 Ajouter une photo'}
          <input type="file" accept="image/*" hidden onChange={(ev) => photo(ev.target.files?.[0])} />
        </label>
        {e.photo && <button type="button" className="btn petit danger" onClick={() => maj(`/admin/procedures/etapes/${e.id}/photo`, { method: 'DELETE' })}>Retirer la photo</button>}
      </div>
      {modifie && (
        <button
          type="button"
          className="btn prim petit"
          disabled={texte.trim().length < 2 || lienIncomplet}
          onClick={() => maj(`/admin/procedures/etapes/${e.id}`, { method: 'PATCH', json: { texte: texte.trim(), avertissement: avert.trim() || null, ...lien } })}
        >
          Enregistrer l'étape
        </button>
      )}
    </li>
  );
}

/** Administration → une procédure : infos, publication, étapes. */
export function AdminProcedure() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const guides = useGuidesAdmin();
  const [p, setP] = useState<Procedure>();
  const [erreur, setErreur] = useState<unknown>();
  const [infos, setInfos] = useState({ titre: '', categorie: '', resume: '' });
  const [nouvelle, setNouvelle] = useState('');

  const appliquer = (x: Procedure) => {
    setP(x);
    setInfos({ titre: x.titre, categorie: x.categorie, resume: x.resume ?? '' });
    viderProcedures();
  };
  useEffect(() => {
    api<Procedure>(`/procedures/${id}`).then(appliquer).catch(setErreur);
  }, [id]);
  /** Envoie une modification ; true si elle a réussi. */
  const maj = async (chemin: string, opts: RequestInit & { json?: unknown }) => {
    setErreur(undefined);
    try {
      appliquer(await api<Procedure>(chemin, opts));
      return true;
    } catch (e) {
      setErreur(e);
      return false;
    }
  };

  if (!p) return erreur ? <Erreur e={erreur} /> : <Chargement />;
  const infosModifiees = infos.titre !== p.titre || infos.categorie !== p.categorie || infos.resume !== (p.resume ?? '');
  const categories = [...new Set([...CATEGORIES, p.categorie])];

  return (
    <div className="page gx">
      <Link to="/admin/procedures" className="btn-lien">← Procédures</Link>
      <h1 className="gx-proc-titre">{p.titre}</h1>
      <Erreur e={erreur} />
      <label className="gx-publier carte">
        <input
          type="checkbox"
          checked={p.publiee}
          onChange={(ev) => {
            const publiee = ev.target.checked;
            setP({ ...p, publiee }); // affichage immédiat
            maj(`/admin/procedures/${p.id}`, { method: 'PATCH', json: { publiee } }).then((ok) => !ok && setP(p)); // retour arrière si erreur
          }}
        />
        <span><b>{p.publiee ? 'Publiée' : 'Brouillon'}</b><br /><span className="muted petit">{p.publiee ? 'Visible par les clients qui ont les procédures.' : 'Visible seulement par l\'admin.'}</span></span>
      </label>

      <div className="carte form">
        <label>Titre<input type="text" value={infos.titre} onChange={(e) => setInfos({ ...infos, titre: e.target.value })} /></label>
        <label>
          Catégorie
          <input type="text" list="categories-procedures" value={infos.categorie} onChange={(e) => setInfos({ ...infos, categorie: e.target.value })} />
          <datalist id="categories-procedures">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label>Résumé<textarea rows={2} value={infos.resume} onChange={(e) => setInfos({ ...infos, resume: e.target.value })} /></label>
        {infosModifiees && (
          <button
            type="button"
            className="btn prim"
            disabled={infos.titre.trim().length < 2 || infos.categorie.trim().length < 2}
            onClick={() => maj(`/admin/procedures/${p.id}`, { method: 'PATCH', json: { titre: infos.titre.trim(), categorie: infos.categorie.trim(), resume: infos.resume.trim() || null } })}
          >
            Enregistrer
          </button>
        )}
      </div>

      <h4>Étapes</h4>
      <ol className="gx-etapes-edit">
        {p.etapes.map((e, n) => (
          <EtapeEditeur key={JSON.stringify(e)} e={e} n={n} total={p.etapes.length} guides={guides} maj={maj} />
        ))}
      </ol>
      <div className="carte form">
        <label>
          Nouvelle étape
          <textarea rows={2} value={nouvelle} placeholder="Ex. Mettez l'impression en pause." onChange={(e) => setNouvelle(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn"
          disabled={nouvelle.trim().length < 2}
          onClick={() => maj(`/admin/procedures/${p.id}/etapes`, { method: 'POST', json: { texte: nouvelle.trim() } }).then((ok) => ok && setNouvelle(''))}
        >
          + Ajouter l'étape
        </button>
      </div>

      <p>
        <Link to={`/procedures/${p.id}`}>Voir comme un client ›</Link>
      </p>
      <button
        type="button"
        className="btn danger"
        onClick={async () => {
          if (!confirm('Supprimer cette procédure et ses photos ?')) return;
          await api(`/admin/procedures/${p.id}`, { method: 'DELETE' });
          viderProcedures();
          nav('/admin/procedures');
        }}
      >
        Supprimer la procédure
      </button>
    </div>
  );
}
