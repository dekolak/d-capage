import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur, Etoiles, Galerie, Indicateurs } from '../components/Composants';
import { Miroir } from '../components/Miroir';
import { completer } from '@decapage/machine-kit';
import { Avis, api, chargerVersion, Fiche, Version } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date } from '../lib/util';

export default function FicheDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState<Fiche>();
  const [version, setVersion] = useState<Version>();
  const [err, setErr] = useState<unknown>();
  const { moi } = useAuth();
  const admin = moi?.role === 'ADMIN';

  const charger = useCallback(async () => {
    const fiche = await api<Fiche>(`/fiches/${id}`);
    setF(fiche);
    setVersion(await chargerVersion(fiche.version.id));
  }, [id]);

  useEffect(() => {
    charger().catch(setErr);
  }, [charger]);

  if (!f || !version) return <div className="page"><Erreur e={err} /><Chargement /></div>;

  const autres = (f.evaluations ?? []).filter((e) => !e.estMoi && (e.avis || admin));

  const publier = async (note: number, texte: string | null) => {
    try {
      await api(`/fiches/${f.id}/evaluation`, { method: 'POST', json: { note, avis: texte || undefined } });
      await charger();
    } catch (e) {
      setErr(e);
    }
  };

  const supprimerAvis = async () => {
    if (!confirm('Supprimer votre avis ?')) return;
    await api(`/fiches/${f.id}/evaluation`, { method: 'DELETE' }).catch(setErr);
    charger().catch(setErr);
  };

  const moderer = async (e: Avis) => {
    const masquer = e.statut === 'VISIBLE';
    const raison = masquer ? prompt('Raison du masquage (facultatif, visible par l\'auteur de l\'avis)') : null;
    if (masquer && raison === null) return;
    await api(`/admin/avis/${e.id}`, { method: 'PATCH', json: { statut: masquer ? 'MASQUE' : 'VISIBLE', raison: raison || undefined } }).catch(setErr);
    charger().catch(setErr);
  };

  const basculerMasque = async () => {
    if (!f.masquee && !confirm('Masquer cette fiche ? Elle ne sera plus visible que par son auteur et les admins.')) return;
    try {
      setF(await api<Fiche>(`/admin/fiches/${f.id}`, { method: 'PATCH', json: { masquee: !f.masquee } }));
    } catch (e) {
      setErr(e);
    }
  };

  const supprimer = async () => {
    if (!confirm('Supprimer définitivement cette fiche ?')) return;
    await api(`/fiches/${f.id}`, { method: 'DELETE' });
    nav('/', { replace: true });
  };

  const ordrePhotos = ['AVANT', 'APRES', 'INTERFACE', 'AUTRE'];
  const photos = [...f.photos].sort((a, b) => ordrePhotos.indexOf(a.type) - ordrePhotos.indexOf(b.type));

  return (
    <div className="page">
      {f.masquee && (
        <div className="bandeau">
          <span><b>Fiche masquée</b> par l'administrateur : visible seulement par son auteur et les admins.</span>
        </div>
      )}
      <h1>{f.titre}</h1>
      {admin && f.auteurAdmin && (
        <p className="admin-auteur">
          Enregistrée par <b>{f.auteurAdmin.nom || f.auteurAdmin.identifiant}</b> ({f.auteurAdmin.identifiant})
        </p>
      )}
      <p className="muted petit">
        {f.machine.nom} · {f.estAuteur ? 'vous' : f.auteur} · {date(f.createdAt)}
      </p>
      {f.parent && <p className="petit">Dupliquée de <Link to={`/fiches/${f.parent.id}`}>{f.parent.titre}</Link></p>}
      <div className="puces">{f.tags.map((t) => <span key={t.id} className="puce">{t.nom}</span>)}</div>

      <Galerie photos={photos} />

      <h2>Réglages</h2>
      <Miroir config={version.config} valeurs={completer(version.config, f.valeurs)} />
      <Indicateurs liste={f.indicateurs} />

      {f.commentaire && (<><h2>Commentaire</h2><p className="commentaire">{f.commentaire}</p></>)}

      <h2>Avis</h2>
      <div className="bloc-note">
        <div className="moyenne">
          <Etoiles note={f.note.moyenne} taille={20} /> {f.note.nombre ? `${f.note.moyenne?.toFixed(1)} · ${f.note.nombre} note${f.note.nombre > 1 ? 's' : ''}` : 'pas encore noté'}
        </div>
        {f.estAuteur ? (
          <div className="ma-note">
            <span>{f.note.maNote ? 'Votre note sur ce résultat' : 'Notez votre résultat'}</span>
            <Etoiles note={f.note.maNote} onChange={(n) => publier(n, null)} />
          </div>
        ) : (
          <MonAvis existant={f.evaluations?.find((e) => e.estMoi)} onPublier={publier} onSupprimer={supprimerAvis} />
        )}
        {autres.length === 0 && <p className="muted petit">Aucun avis pour l'instant.</p>}
        {autres.map((e) => (
          <div key={e.id} className={'avis' + (e.statut !== 'VISIBLE' ? ' avis-masque' : '')}>
            <div className="avis-h">
              <span><Etoiles note={e.note} taille={14} /> <b>{e.auteur}</b>{e.estAuteurFiche ? ' (auteur)' : ''} · <span className="muted">{date(e.date)}</span></span>
              {admin && (
                <button type="button" className="btn petit" onClick={() => moderer(e)}>{e.statut === 'VISIBLE' ? 'Masquer' : 'Réafficher'}</button>
              )}
            </div>
            {e.avis && <p>{e.avis}</p>}
            {admin && e.statut !== 'VISIBLE' && <BadgeStatut a={e} />}
          </div>
        ))}
      </div>

      <div className="actions">
        <Link to={`/fiches/nouvelle?depuis=${f.id}`} className="btn prim">Dupliquer ce réglage</Link>
        {f.estAuteur && <Link to={`/fiches/${f.id}/modifier`} className="btn">Modifier</Link>}
        {(f.estAuteur || admin) && <button type="button" className="btn danger" onClick={supprimer}>Supprimer</button>}
        {admin && (
          <button type="button" className="btn" onClick={basculerMasque}>{f.masquee ? 'Réafficher' : 'Masquer'}</button>
        )}
      </div>
      <Erreur e={err} />
    </div>
  );
}


function BadgeStatut({ a }: { a: Avis }) {
  if (a.statut === 'VISIBLE') return null;
  return (
    <p className={'statut-avis ' + a.statut.toLowerCase()}>
      {a.statut === 'EN_ATTENTE' ? 'En attente de validation' : 'Masqué par la modération'}
      {a.moderationRaison ? ` : ${a.moderationRaison}` : ''}
    </p>
  );
}

/** Donner, modifier ou supprimer son avis : une note (obligatoire) et un texte (facultatif). Pas de réponses. */
function MonAvis({ existant, onPublier, onSupprimer }: { existant?: Avis; onPublier(note: number, texte: string | null): Promise<void>; onSupprimer(): void }) {
  const [edition, setEdition] = useState(!existant);
  const [note, setNote] = useState<number | null>(existant?.note ?? null);
  const [texte, setTexte] = useState(existant?.avis ?? '');
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    setEdition(!existant);
    setNote(existant?.note ?? null);
    setTexte(existant?.avis ?? '');
  }, [existant?.id, existant?.note, existant?.avis]);

  if (existant && !edition)
    return (
      <div className="ma-note">
        <span>Votre avis</span>
        <div><Etoiles note={existant.note} taille={18} /></div>
        {existant.avis && <p className="mon-texte">{existant.avis}</p>}
        <BadgeStatut a={existant} />
        <div className="actions-avis">
          <button type="button" className="btn petit" onClick={() => setEdition(true)}>Modifier</button>
          <button type="button" className="btn petit danger" onClick={onSupprimer}>Supprimer</button>
        </div>
      </div>
    );

  return (
    <div className="ma-note">
      <span>{existant ? 'Modifier votre avis' : 'Testé ? Donnez votre avis'}</span>
      <Etoiles note={note} onChange={setNote} />
      <textarea rows={3} maxLength={1000} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Votre retour : résultat, nombre de passages, support… (facultatif)" />
      <div className="actions-avis">
        {existant && <button type="button" className="btn petit" onClick={() => setEdition(false)}>Annuler</button>}
        <button
          type="button"
          className="btn prim"
          disabled={!note || envoi}
          onClick={async () => {
            setEnvoi(true);
            await onPublier(note!, texte.trim() || null);
            setEnvoi(false);
          }}
        >
          {envoi ? 'Publication…' : 'Publier mon avis'}
        </button>
      </div>
      {!note && <small className="muted">Choisissez d'abord une note.</small>}
    </div>
  );
}
