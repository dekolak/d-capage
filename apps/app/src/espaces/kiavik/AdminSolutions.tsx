import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { compresser } from '../../lib/image';
import { ChoixBouton, Lien, useGuidesAdmin } from './AdminProcedures';
import { chargerProcedures, chargerSolutions, ChoixCategorie, ImageApi, ResumeProcedure, Solution, viderSolutions } from './donneesProcedures';
import './guides.css';
import { BadgeZone } from '../../pages/Admin';

/* Administration → Astuces & solutions (admin, en français). */


export function AdminSolutions() {
  const nav = useNavigate();
  const [liste, setListe] = useState<Solution[]>();
  const [erreur, setErreur] = useState<unknown>();
  const [titre, setTitre] = useState('');
  useEffect(() => {
    viderSolutions();
    chargerSolutions().then(setListe).catch(setErreur);
  }, []);
  const creer = async () => {
    try {
      const s = await api<Solution>('/admin/solutions', { method: 'POST', json: { titre: titre.trim(), texte: 'À compléter.' } });
      viderSolutions();
      nav(`/admin/solutions/${s.id}`);
    } catch (e) {
      setErreur(e);
    }
  };
  if (!liste) return erreur ? <Erreur e={erreur} /> : <Chargement />;
  return (
    <div className="page gx">
      <Link to="/admin" className="btn-lien">← Administration</Link>
      <h1>Bon à savoir <BadgeZone zone="kiavik" /></h1>
      <p className="muted petit">Un problème déjà résolu, ou une astuce : le symptôme, pourquoi, que faire. Les clients les retrouvent dans l'accueil, la recherche et la fiche du bouton lié.</p>
      <Erreur e={erreur} />
      <div className="carte form">
        <label>
          Nouvelle fiche
          <input type="text" value={titre} placeholder="Le symptôme, ex. L'encre coule sur le mur" onChange={(e) => setTitre(e.target.value)} />
        </label>
        <button type="button" className="btn prim" disabled={titre.trim().length < 3} onClick={creer}>Créer</button>
      </div>
      <h4>{liste.length} fiche{liste.length > 1 ? 's' : ''}</h4>
      <div className="gx-resultats">
        {liste.map((s) => (
          <Link key={s.id} to={`/admin/solutions/${s.id}`} className="carte gx-resultat">
            <b>{s.titre}</b>
            <span className="petit muted">
              {s.categorie}
              {s.publiee ? <span className="gx-publiee">✅ publiée</span> : <span className="gx-brouillon">🔒 non publiée</span>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminSolution() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const guides = useGuidesAdmin();
  const [s, setS] = useState<Solution>();
  const [procedures, setProcedures] = useState<ResumeProcedure[]>([]);
  const [f, setF] = useState({ titre: '', categorie: '', cause: '', texte: '', avertissement: '', mots: '', procedureId: '' });
  const [lien, setLien] = useState<Lien>({ guide: null, ecran: null, pastille: null });
  const [erreur, setErreur] = useState<unknown>();
  const [ok, setOk] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const appliquer = (x: Solution) => {
    setS(x);
    setF({ titre: x.titre, categorie: x.categorie, cause: x.cause ?? '', texte: x.texte, avertissement: x.avertissement ?? '', mots: x.motsCles.join(', '), procedureId: x.procedureId ?? '' });
    setLien({ guide: x.guide, ecran: x.ecran, pastille: x.pastille });
    viderSolutions();
  };
  useEffect(() => {
    api<Solution>(`/solutions/${id}`).then(appliquer).catch(setErreur);
    chargerProcedures().then(setProcedures).catch(() => {});
  }, [id]);
  const maj = async (chemin: string, opts: RequestInit & { json?: unknown }) => {
    setErreur(undefined);
    setOk(false);
    try {
      appliquer(await api<Solution>(chemin, opts));
      return true;
    } catch (e) {
      setErreur(e);
      return false;
    }
  };

  if (!s) return erreur ? <Erreur e={erreur} /> : <Chargement />;
  const enregistrer = async () => {
    setEnvoi(true);
    const fait = await maj(`/admin/solutions/${s.id}`, {
      method: 'PATCH',
      json: {
        titre: f.titre, categorie: f.categorie, cause: f.cause || null, texte: f.texte, avertissement: f.avertissement || null,
        motsCles: f.mots.split(',').map((m) => m.trim()).filter(Boolean), procedureId: f.procedureId || null, ...lien,
      },
    });
    setEnvoi(false);
    setOk(fait);
  };

  return (
    <div className="page gx">
      <Link to="/admin/solutions" className="btn-lien">← Astuces & solutions</Link>
      <h1 className="gx-proc-titre">{s.titre}</h1>
      <label className="gx-publier carte">
        <input
          type="checkbox"
          checked={s.publiee}
          onChange={(ev) => {
            const publiee = ev.target.checked;
            setS({ ...s, publiee }); // affichage immédiat
            maj(`/admin/solutions/${s.id}`, { method: 'PATCH', json: { publiee } }).then((r) => !r && setS(s)); // retour arrière si erreur
          }}
        />
        <span><b>{s.publiee ? '✅ Publiée' : '🔒 Non publiée'}</b><br /><span className="muted petit">{s.publiee ? 'Visible par les clients (accès « Pas-à-pas et Bon à savoir »).' : 'Visible seulement par vous. Cochez pour la montrer aux clients.'}</span></span>
      </label>

      <div className="carte form">
        <label>Le problème ou l'astuce (titre)<input type="text" value={f.titre} maxLength={160} onChange={(e) => setF({ ...f, titre: e.target.value })} /></label>
        <label>
          Catégorie
          <ChoixCategorie valeur={f.categorie} onChange={(categorie) => setF({ ...f, categorie })} />
        </label>
        <label>Pourquoi ? (facultatif)<textarea rows={2} value={f.cause} maxLength={1000} onChange={(e) => setF({ ...f, cause: e.target.value })} /></label>
        <label>Que faire ?<textarea rows={5} value={f.texte} maxLength={3000} onChange={(e) => setF({ ...f, texte: e.target.value })} /></label>
        <label>⚠️ Précaution (facultatif)<input type="text" value={f.avertissement} maxLength={500} onChange={(e) => setF({ ...f, avertissement: e.target.value })} /></label>
        <label>
          Mots-clés pour la recherche (séparés par des virgules)
          <input type="text" value={f.mots} placeholder="ex. flou, doublé, décalage" onChange={(e) => setF({ ...f, mots: e.target.value })} />
        </label>
        <div>
          <b className="petit">Bouton du guide lié</b>
          <ChoixBouton guides={guides} valeur={lien} onChange={setLien} />
        </div>
        <label>
          Procédure liée
          <select value={f.procedureId} onChange={(e) => setF({ ...f, procedureId: e.target.value })}>
            <option value="">Aucune</option>
            {procedures.map((p) => <option key={p.id} value={p.id}>{p.titre}</option>)}
          </select>
        </label>
        <Erreur e={erreur} />
        {ok && <div className="succes">Enregistré.</div>}
        <button type="button" className="btn prim" disabled={envoi || f.titre.trim().length < 3 || f.texte.trim().length < 2 || (!!lien.guide && !lien.ecran)} onClick={enregistrer}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <div className="carte cx-photo" style={{ marginTop: 12 }}>
        {s.photo && <ImageApi chemin={s.photo} className="gx-etape-photo" />}
        <div className="cx-actions">
          <label className="btn petit">
            {s.photo ? '📷 Changer la photo' : '📷 Ajouter une photo'}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (ev) => {
                const fichier = ev.target.files?.[0];
                if (!fichier) return;
                const { fichier: jpeg } = await compresser(fichier);
                const fd = new FormData();
                fd.append('photo', jpeg, 'photo.jpg');
                await maj(`/admin/solutions/${s.id}/photo`, { method: 'POST', body: fd });
              }}
            />
          </label>
          {s.photo && <button type="button" className="btn petit danger" onClick={() => maj(`/admin/solutions/${s.id}/photo`, { method: 'DELETE' })}>Retirer la photo</button>}
        </div>
      </div>

      <p><Link to={`/solutions/${s.id}`}>Voir comme un client ›</Link></p>
      <button
        type="button"
        className="btn danger"
        onClick={async () => {
          if (!confirm('Supprimer cette fiche ?')) return;
          await api(`/admin/solutions/${s.id}`, { method: 'DELETE' });
          viderSolutions();
          nav('/admin/solutions');
        }}
      >
        Supprimer la fiche
      </button>
    </div>
  );
}
