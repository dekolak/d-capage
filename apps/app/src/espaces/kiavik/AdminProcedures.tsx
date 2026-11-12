import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { chargerGuide, Guide, pastillesNavigation, ResumeGuide } from './guides';
import { chargerProcedures, Procedure, ResumeProcedure, viderProcedures } from './donneesProcedures';
import './guides.css';
import './editeur.css';
import { BadgeZone } from '../../pages/Admin';

/** Administration → Procédures : liste, création, consignes générales pour l'IA, diagnostics reçus. */
export function AdminProcedures() {
  const nav = useNavigate();
  const [liste, setListe] = useState<ResumeProcedure[]>();
  const [erreur, setErreur] = useState<unknown>();
  const [titre, setTitre] = useState('');
  const [nonLus, setNonLus] = useState(0);
  const [pasClair, setPasClair] = useState<Record<string, number>>({});
  useEffect(() => {
    viderProcedures();
    chargerProcedures().then(setListe).catch(setErreur);
    api<{ nonLus: number }>('/admin/diagnostics?nonLus=1').then((r) => setNonLus(r.nonLus)).catch(() => {});
    api<Record<string, number>>('/admin/procedures/signalements/ouverts').then(setPasClair).catch(() => {});
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
      <h1>Pas-à-pas <BadgeZone zone="kiavik" /></h1>
      <Erreur e={erreur} />
      <Link to="/admin/diagnostics" className="bandeau lien-bandeau">
        <span><b>🩺 Dépannages reçus</b>{nonLus > 0 ? ` : ${nonLus} non lu${nonLus > 1 ? 's' : ''}` : ' : résultats envoyés par les clients'}</span>
        <span>›</span>
      </Link>
      <div className="carte form">
        <label>
          Nouveau pas-à-pas ou dépannage guidé
          <input type="text" value={titre} placeholder="Titre, ex. Changer une cartouche" onChange={(e) => setTitre(e.target.value)} />
        </label>
        <button type="button" className="btn prim" disabled={titre.trim().length < 2} onClick={creer}>Créer</button>
      </div>
      <h4>{liste.length} pas-à-pas</h4>
      <div className="gx-resultats">
        {liste.map((p) => (
          <Link key={p.id} to={`/admin/procedures/${p.id}`} className="carte gx-resultat">
            <b>{p.titre}</b>
            <span className="petit muted">
              {p.diagnostic && p.categorie !== 'Diagnostic' && <span className="dg-badge">Dépannage guidé</span>}
              {p.categorie} · {p.nbEtapes} étape{p.nbEtapes > 1 ? 's' : ''}
              {p.publiee ? <span className="gx-publiee">✅ publiée</span> : <span className="gx-brouillon">🔒 non publiée</span>}
              {!!pasClair[p.id] && <span className="ed-badge-pc" title="Étapes signalées « pas claires » à traiter">❓ {pasClair[p.id]}</span>}
              {!p.description && <span className="ed-manque" title="Utile pour que l'IA choisisse la bonne procédure">sans description</span>}
            </span>
          </Link>
        ))}
      </div>
      <PromptGeneral />
    </div>
  );
}

/** Consignes générales données à l'IA pour tout l'espace (complétées par le prompt de chaque procédure). */
function PromptGeneral() {
  const [texte, setTexte] = useState<string>();
  const [garde, setGarde] = useState('');
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    api<{ texte: string }>('/ia/prompt').then((r) => { setTexte(r.texte); setGarde(r.texte); }).catch(setErreur);
  }, []);
  if (texte === undefined) return <Erreur e={erreur} />;
  return (
    <div className="carte form ed-ia">
      <b>🤖 IA : consignes générales Kiavik</b>
      <label>
        Prompt système commun à tous les pas-à-pas (ton, sécurité, quand renvoyer vers vous)
        <textarea rows={5} value={texte} placeholder="Ex. Tu es l'assistant technique Kiavik. Réponds simplement, en étapes courtes. Ne conseille jamais de démonter l'électronique…" onChange={(e) => setTexte(e.target.value)} />
      </label>
      <Erreur e={erreur} />
      {texte !== garde && (
        <button type="button" className="btn prim" onClick={() => api<{ texte: string }>('/ia/prompt', { method: 'PUT', json: { texte } }).then((r) => { setTexte(r.texte); setGarde(r.texte); }).catch(setErreur)}>
          Enregistrer
        </button>
      )}
      <small className="muted">n8n peut lire le catalogue des procédures (<code>GET /api/ia/catalogue</code>) et l'arbre d'une procédure (<code>GET /api/ia/procedures/:id</code>) avec une clé API.</small>
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
