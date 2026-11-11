import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { copier } from '../../lib/copier';
import './guides.css';
import './editeur.css';
import './parcours.css';

interface Diagnostic {
  id: string; texte: string; message: string | null; lu: boolean; createdAt: string;
  resultat: { fin: { type: 'termine' | 'resolu' | 'contact' | 'en_cours'; texte: string } };
  user: { id: string; identifiant: string; nom: string | null };
  procedure: { id: string; titre: string };
}

const ICONE = { termine: '🎉', resolu: '✅', contact: '📞', en_cours: '⏳' } as const;

/** Administration → Diagnostics reçus : résultats envoyés par les clients (« question : réponse »). */
export function AdminDiagnostics() {
  const [liste, setListe] = useState<Diagnostic[]>();
  const [erreur, setErreur] = useState<unknown>();
  const [nonLus, setNonLus] = useState(false);
  const [paquet, setPaquet] = useState<string>();
  const [copie, setCopie] = useState(false);
  const charger = () => api<{ diagnostics: Diagnostic[] }>(`/admin/diagnostics${nonLus ? '?nonLus=1' : ''}`).then((r) => setListe(r.diagnostics)).catch(setErreur);
  useEffect(() => {
    charger();
  }, [nonLus]);
  const marquer = async (d: Diagnostic, lu: boolean) => {
    setListe((l) => l?.map((x) => (x.id === d.id ? { ...x, lu } : x)));
    await api(`/admin/diagnostics/${d.id}`, { method: 'PATCH', json: { lu } }).catch(setErreur);
  };
  return (
    <div className="page gx">
      <Link to="/admin/procedures" className="btn-lien">← Procédures</Link>
      <h1>Diagnostics reçus</h1>
      <p className="muted petit">Résultats envoyés par les clients à la fin d'un diagnostic. Ils partent aussi vers n8n (événement <code>diagnostic.envoye</code>, avec le paquet prêt pour l'IA).</p>
      <label className="gx-controle-edit"><input type="checkbox" checked={nonLus} onChange={(e) => setNonLus(e.target.checked)} /><span>Non lus seulement</span></label>
      <Erreur e={erreur} />
      {paquet !== undefined && (
        <div className="pv-fond" onClick={() => setPaquet(undefined)}>
          <div className="pv-fiche dg-paquet" role="dialog" aria-modal="true" onClick={(x) => x.stopPropagation()}>
            <button type="button" className="gx-fermer" aria-label="Fermer" onClick={() => setPaquet(undefined)}>✕</button>
            <h3>Texte pour l'IA</h3>
            <p className="petit muted">Consignes générales + prompt de la procédure + résumé de la procédure + réponses et message du client.</p>
            <pre className="ed-resume-ia">{paquet}</pre>
            <button type="button" className="btn prim" onClick={async () => setCopie(await copier(paquet))}>{copie ? '✓ Copié' : '📋 Copier'}</button>
          </div>
        </div>
      )}
      {!liste ? <Chargement /> : liste.length === 0 ? <p className="muted">Aucun diagnostic reçu.</p> : (
        <div className="gx-resultats">
          {liste.map((d) => (
            <div key={d.id} className={`carte dg-recu ${d.lu ? 'lu' : ''}`}>
              <div className="gx-etape-tete">
                <b>{ICONE[d.resultat.fin.type] ?? '🩺'} {d.procedure.titre}</b>
                <small className="muted">{new Date(d.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small>
              </div>
              <span className="petit">
                <Link to={`/admin/comptes/${d.user.id}/activite`}>{d.user.nom ? `${d.user.nom} (${d.user.identifiant})` : d.user.identifiant}</Link>
              </span>
              <pre className="dg-texte">{d.texte}</pre>
              {d.message && <p className="dg-message">💬 {d.message}</p>}
              <span className="ed-actions">
                <button type="button" className="btn petit" onClick={() => marquer(d, !d.lu)}>{d.lu ? 'Marquer non lu' : '✓ Marquer lu'}</button>
                <button type="button" className="btn petit" onClick={() => { setCopie(false); api<{ texte: string }>(`/admin/diagnostics/${d.id}/paquet`).then((r) => setPaquet(r.texte)).catch(setErreur); }}>
                  📋 Copier pour l'IA
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
