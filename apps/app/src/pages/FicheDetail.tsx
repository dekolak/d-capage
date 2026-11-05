import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur, Etoiles, Galerie, Indicateurs } from '../components/Composants';
import { Miroir } from '../components/Miroir';
import { completer } from '@decapage/machine-kit';
import { api, chargerVersion, Fiche, Version } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date } from '../lib/util';

export default function FicheDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState<Fiche>();
  const [version, setVersion] = useState<Version>();
  const [err, setErr] = useState<unknown>();
  const [avis, setAvis] = useState('');
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

  const noter = async (note: number) => {
    await api(`/fiches/${f.id}/evaluation`, { method: 'POST', json: { note, avis: avis || undefined } }).catch(setErr);
    setAvis('');
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

      <h2>Notes</h2>
      <div className="bloc-note">
        <div>
          <Etoiles note={f.note.moyenne} taille={20} /> {f.note.nombre ? `${f.note.moyenne?.toFixed(1)} (${f.note.nombre})` : 'pas encore noté'}
        </div>
        <div className="ma-note">
          <span>{f.note.maNote ? 'Votre note' : f.estAuteur ? 'Notez votre résultat' : 'Testé ? Notez ce réglage'}</span>
          <Etoiles note={f.note.maNote} onChange={noter} />
          {!f.estAuteur && (
            <input placeholder="Avis (facultatif), puis touchez une étoile" value={avis} onChange={(e) => setAvis(e.target.value)} maxLength={1000} />
          )}
        </div>
        {f.evaluations?.filter((e) => e.avis).map((e, i) => (
          <div key={i} className="avis">
            <Etoiles note={e.note} taille={14} /> <b>{e.auteur}</b>{e.estAuteurFiche ? ' (auteur)' : ''} · <span className="muted">{date(e.date)}</span>
            <p>{e.avis}</p>
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

