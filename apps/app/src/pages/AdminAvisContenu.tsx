import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { api } from '../lib/api';
import { EnteteAdmin } from './Admin';

interface Avis { id: string; clair: boolean; commentaire: string | null; traite: boolean; le: string; client: { id: string; nom: string | null; identifiant: string; numeroOdoo: string | null } }
interface Groupe { type: string; contenuId: string; titre: string; ou: string; espace: string; lien: string; actif: boolean; clairs: number; flous: number; aTraiter: number; avis: Avis[] }

/** Administration → 🤔 Avis sur les contenus : « C'était clair ? » des clients, par contenu ; ✓ traité. */
export default function AdminAvisContenu() {
  const [l, setL] = useState<Groupe[]>();
  const [err, setErr] = useState<unknown>();
  const [tous, setTous] = useState(false);
  const charger = () => api<Groupe[]>('/admin/avis-contenu').then(setL).catch(setErr);
  useEffect(() => {
    charger();
  }, []);
  const traiter = async (a: Avis) => {
    await api(`/admin/avis-contenu/${a.id}`, { method: 'PATCH', json: { traite: !a.traite } }).catch(setErr);
    charger();
  };
  if (!l) return err ? <Erreur e={err} /> : <Chargement />;
  const liste = tous ? l : l.filter((g) => g.aTraiter > 0 || g.actif);
  return (
    <div className="page">
      <EnteteAdmin titre="🤔 Avis sur les contenus" zone="commun" />
      <p className="muted petit">
        À la fin d'un pas-à-pas, d'une leçon ou d'une page où vous avez coché « Demander “C'était clair ?” », le client répond 👍 ou 🤔 (avec un commentaire facultatif).
        Les 🤔 à traiter passent en premier ; « ✓ Traité » une fois le contenu corrigé (le client peut redonner son avis).
      </p>
      <label className="interrupteur"><input type="checkbox" checked={tous} onChange={(e) => setTous(e.target.checked)} /> Afficher aussi les contenus où la question est désactivée</label>
      <Erreur e={err} />
      {!liste.length && <p className="muted">Aucun avis pour l'instant.</p>}
      <div className="liste">
        {liste.map((g) => (
          <details key={`${g.type}:${g.contenuId}`} className="carte" open={g.aTraiter > 0}>
            <summary>
              <b>{g.titre}</b> <small className="muted">· {g.ou} · {g.espace}{g.actif ? '' : ' · question désactivée'}</small><br />
              <span>👍 {g.clairs} · 🤔 {g.flous}</span>{g.aTraiter > 0 && <span className="badge-rouge">{g.aTraiter} à traiter</span>}
            </summary>
            <p><Link to={g.lien} className="btn-lien petit">Ouvrir le contenu ›</Link></p>
            <div className="liste">
              {g.avis.map((a) => (
                <div key={a.id} className={`ac-ligne ${a.traite ? 'muted' : ''}`}>
                  <span className="ac-ligne-lien">
                    <b>{a.clair ? '👍 Clair' : '🤔 Pas tout compris'}</b>
                    {a.commentaire && <span>« {a.commentaire} »</span>}
                    <small className="muted">
                      {a.client.nom || a.client.identifiant}
                      {a.client.numeroOdoo ? ` · n° ${a.client.numeroOdoo}` : ''} · {new Date(a.le).toLocaleDateString('fr-FR')}
                    </small>
                  </span>
                  {!a.clair && <button type="button" className={`btn petit ${a.traite ? '' : 'prim'}`} onClick={() => traiter(a)}>{a.traite ? '↺ À traiter' : '✓ Traité'}</button>}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
