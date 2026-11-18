import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { chargerGuide, Guide, pastillesNavigation, ResumeGuide } from './guides';
import { chargerProcedures, ICONE_TYPE, Procedure, ResumeProcedure, viderProcedures } from './donneesProcedures';
import './guides.css';
import './editeur.css';
import { BadgeZone } from '../../pages/Admin';
import { useEspace } from '../../lib/espace';

/** Administration → Procédures : liste, création, consignes générales pour l'IA, diagnostics reçus. */
export function AdminProcedures() {
  const nav = useNavigate();
  const [liste, setListe] = useState<ResumeProcedure[]>();
  const [erreur, setErreur] = useState<unknown>();
  const [titre, setTitre] = useState('');
  const [nonLus, setNonLus] = useState(0);
  const [pasClair, setPasClair] = useState<Record<string, number>>({});
  const { espace: ouvert } = useEspace();
  // filtres : espace (celui ouvert par défaut), étiquette, état
  const [fEspace, setFEspace] = useState<string>(ouvert.slug);
  const [fEtiquette, setFEtiquette] = useState('');
  const [fEtat, setFEtat] = useState('');
  useEffect(() => {
    viderProcedures();
    chargerProcedures().then(setListe).catch(setErreur);
    api<{ nonLus: number }>('/admin/diagnostics?nonLus=1').then((r) => setNonLus(r.nonLus)).catch(() => {});
    api<Record<string, number>>('/admin/procedures/signalements/ouverts').then(setPasClair).catch(() => {});
  }, []);
  const creer = async () => {
    try {
      const p = await api<Procedure>('/admin/procedures', { method: 'POST', json: { titre: titre.trim(), espace: fEspace || ouvert.slug } });
      viderProcedures();
      nav(`/admin/procedures/${p.id}`);
    } catch (e) {
      setErreur(e);
    }
  };
  if (!liste) return erreur ? <Erreur e={erreur} /> : <Chargement />;
  const etiquettes = [...new Set(liste.filter((p) => !fEspace || p.espace === fEspace).flatMap((p) => p.etiquettes))].sort((a, b) => a.localeCompare(b, 'fr'));
  const visibles = liste.filter((p) =>
    (!fEspace || p.espace === fEspace)
    && (!fEtiquette || (fEtiquette === '∅' ? !p.etiquettes.length : p.etiquettes.some((e) => e.toLowerCase() === fEtiquette.toLowerCase())))
    && (!fEtat || (fEtat === 'publiee') === p.publiee));
  return (
    <div className="page gx">
      <Link to="/admin" className="btn-lien">← Administration</Link>
      <Link to="/admin/terrain" className="bandeau lien-bandeau">
        <span><b>🎥 Mode terrain</b> : capturer un nouveau pas-à-pas sur place (photos, dictée), le finir ici ensuite</span>
        <span>›</span>
      </Link>
      <h1>Pas-à-pas</h1>
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
      <div className="ca-filtres">
        <select value={fEspace} onChange={(e) => { setFEspace(e.target.value); setFEtiquette(''); }} aria-label="Espace">
          <option value="">Lazzeko et Kiavik</option>
          <option value="lazzeko">Lazzeko</option>
          <option value="kiavik">Kiavik</option>
        </select>
        <select value={fEtiquette} onChange={(e) => setFEtiquette(e.target.value)} aria-label="Étiquette">
          <option value="">Toutes les étiquettes</option>
          <option value="∅">Sans étiquette (toutes les machines)</option>
          {etiquettes.map((e) => <option key={e} value={e}>🏷 {e}</option>)}
        </select>
        <select value={fEtat} onChange={(e) => setFEtat(e.target.value)} aria-label="État">
          <option value="">Publiés et non publiés</option>
          <option value="publiee">✅ Publiés</option>
          <option value="brouillon">🔒 Non publiés</option>
        </select>
      </div>
      <h4>{visibles.length} pas-à-pas</h4>
      <div className="gx-resultats">
        {visibles.map((p) => (
          <Link key={p.id} to={`/admin/procedures/${p.id}`} className="carte gx-resultat">
            <b>{ICONE_TYPE[p.type] ?? '📋'} {p.titre} <BadgeZone zone={p.espace} /></b>
            {p.etiquettes.length > 0 && <span className="et-mini">{p.etiquettes.map((e) => <span key={e}>🏷 {e}</span>)}</span>}
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
