import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur, Etoiles, Galerie, Indicateurs } from '../components/Composants';
import { MiniatureMachine } from '../components/MiniatureMachine';
import { Miroir } from '../components/Miroir';
import { completer } from '@decapage/machine-kit';
import { Avis, api, chargerVersion, Fiche, Version } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date } from '../lib/util';
import { t, tn, tr } from '../lib/i18n';

export default function FicheDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState<Fiche>();
  const [version, setVersion] = useState<Version>();
  const [err, setErr] = useState<unknown>();
  const { moi } = useAuth();
  const admin = moi?.role === 'ADMIN';
  const [aideActive, setAideActive] = useState(false);
  useEffect(() => {
    api<{ aideSupport: boolean }>('/parametres').then((p) => setAideActive(p.aideSupport)).catch(() => {});
  }, []);

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
    if (!confirm(t('lazzeko.fiche.supprimerAvisConfirm'))) return;
    await api(`/fiches/${f.id}/evaluation`, { method: 'DELETE' }).catch(setErr);
    charger().catch(setErr);
  };

  const moderer = async (e: Avis) => {
    const masquer = e.statut === 'VISIBLE';
    const raison = masquer ? prompt(t('lazzeko.fiche.raisonMasquage')) : null;
    if (masquer && raison === null) return;
    await api(`/admin/avis/${e.id}`, { method: 'PATCH', json: { statut: masquer ? 'MASQUE' : 'VISIBLE', raison: raison || undefined } }).catch(setErr);
    charger().catch(setErr);
  };

  const basculerMasque = async () => {
    if (!f.masquee && !confirm(t('lazzeko.fiche.masquerConfirm'))) return;
    try {
      setF(await api<Fiche>(`/admin/fiches/${f.id}`, { method: 'PATCH', json: { masquee: !f.masquee } }));
    } catch (e) {
      setErr(e);
    }
  };

  const supprimer = async () => {
    if (!confirm(t('lazzeko.fiche.supprimerConfirm'))) return;
    await api(`/fiches/${f.id}`, { method: 'DELETE' });
    nav('/', { replace: true });
  };

  const ordrePhotos = ['AVANT', 'APRES', 'INTERFACE', 'AUTRE'];
  const photos = [...f.photos].sort((a, b) => ordrePhotos.indexOf(a.type) - ordrePhotos.indexOf(b.type));

  return (
    <div className="page">
      {f.masquee && (
        <div className="bandeau">
          <span><b>{t('lazzeko.fiche.masquee')}</b>{t('lazzeko.fiche.masqueeDetail')}</span>
        </div>
      )}
      <h1>{f.titre}</h1>
      {admin && f.auteurAdmin && (
        <p className="admin-auteur">
          {tr('lazzeko.fiche.enregistreePar', { nom: <b>{f.auteurAdmin.nom || f.auteurAdmin.identifiant}</b>, identifiant: f.auteurAdmin.identifiant })}
        </p>
      )}
      <div className="entete-machine">
        <MiniatureMachine url={f.machine.imageUrl} badge={f.machine.varianteNom} taille={48} />
        <p className="muted petit" style={{ margin: 0 }}>
          {f.machine.nom} · {f.estAuteur ? t('lazzeko.fiche.vous') : f.auteur} · {date(f.createdAt)}
        </p>
      </div>
      {f.parent && <p className="petit">{tr('lazzeko.fiche.dupliqueeDe', { lien: <Link to={`/fiches/${f.parent.id}`}>{f.parent.titre}</Link> })}</p>}
      <div className="puces">{f.tags.map((tag) => <span key={tag.id} className="puce">{tag.nom}</span>)}</div>

      <Galerie photos={photos} />

      <h2>{t('lazzeko.fiche.reglages')}</h2>
      <Miroir config={version.config} valeurs={completer(version.config, f.valeurs)} />
      <Indicateurs liste={f.indicateurs} />

      {f.commentaire && (<><h2>{t('lazzeko.fiche.commentaire')}</h2><p className="commentaire">{f.commentaire}</p></>)}

      <h2>{t('lazzeko.fiche.avis')}</h2>
      <div className="bloc-note">
        <div className="moyenne">
          <Etoiles note={f.note.moyenne} taille={20} /> {f.note.nombre ? tn('lazzeko.notes', f.note.nombre, { moyenne: f.note.moyenne?.toFixed(1) ?? '' }) : t('commun.pasNote')}
        </div>
        {f.estAuteur ? (
          <div className="ma-note">
            <span>{f.note.maNote ? t('lazzeko.fiche.maNote') : t('lazzeko.fiche.noter')}</span>
            <Etoiles note={f.note.maNote} onChange={(n) => publier(n, null)} />
          </div>
        ) : (
          <MonAvis existant={f.evaluations?.find((e) => e.estMoi)} onPublier={publier} onSupprimer={supprimerAvis} />
        )}
        {autres.length === 0 && <p className="muted petit">{t('lazzeko.fiche.aucunAvis')}</p>}
        {autres.map((e) => (
          <div key={e.id} className={'avis' + (e.statut !== 'VISIBLE' ? ' avis-masque' : '')}>
            <div className="avis-h">
              <span><Etoiles note={e.note} taille={14} /> <b>{e.auteur}</b>{e.estAuteurFiche ? t('lazzeko.fiche.auteur') : ''} · <span className="muted">{date(e.date)}</span></span>
              {admin && (
                <button type="button" className="btn petit" onClick={() => moderer(e)}>{e.statut === 'VISIBLE' ? t('lazzeko.fiche.masquer') : t('lazzeko.fiche.reafficher')}</button>
              )}
            </div>
            {e.avis && <p>{e.avis}</p>}
            {admin && e.statut !== 'VISIBLE' && <BadgeStatut a={e} />}
          </div>
        ))}
      </div>

      {aideActive && <DemandeAide ficheId={f.id} />}

      <div className="actions">
        <Link to={`/fiches/nouvelle?depuis=${f.id}`} className="btn prim">{t('lazzeko.fiche.dupliquer')}</Link>
        {f.estAuteur && <Link to={`/fiches/${f.id}/modifier`} className="btn">{t('lazzeko.fiche.modifier')}</Link>}
        {(f.estAuteur || admin) && <button type="button" className="btn danger" onClick={supprimer}>{t('lazzeko.fiche.supprimer')}</button>}
        {admin && (
          <button type="button" className="btn" onClick={basculerMasque}>{f.masquee ? t('lazzeko.fiche.reafficher') : t('lazzeko.fiche.masquer')}</button>
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
      {a.statut === 'EN_ATTENTE' ? t('lazzeko.fiche.enAttente') : t('lazzeko.fiche.masqueModeration')}
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
        <span>{t('lazzeko.fiche.votreAvis')}</span>
        <div><Etoiles note={existant.note} taille={18} /></div>
        {existant.avis && <p className="mon-texte">{existant.avis}</p>}
        <BadgeStatut a={existant} />
        <div className="actions-avis">
          <button type="button" className="btn petit" onClick={() => setEdition(true)}>{t('lazzeko.fiche.modifier')}</button>
          <button type="button" className="btn petit danger" onClick={onSupprimer}>{t('lazzeko.fiche.supprimer')}</button>
        </div>
      </div>
    );

  return (
    <div className="ma-note">
      <span>{existant ? t('lazzeko.fiche.modifierAvis') : t('lazzeko.fiche.donnerAvis')}</span>
      <Etoiles note={note} onChange={setNote} />
      <textarea rows={3} maxLength={1000} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t('lazzeko.fiche.avisExemple')} />
      <div className="actions-avis">
        {existant && <button type="button" className="btn petit" onClick={() => setEdition(false)}>{t('commun.annuler')}</button>}
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
          {envoi ? t('lazzeko.fiche.publication') : t('lazzeko.fiche.publier')}
        </button>
      </div>
      {!note && <small className="muted">{t('lazzeko.fiche.noteDabord')}</small>}
    </div>
  );
}

/** « Demander de l'aide à Lazzeko » : le support reçoit le réglage, les photos et le message. */
function DemandeAide({ ficheId }: { ficheId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState('');
  const [etat, setEtat] = useState<'' | 'envoi' | 'ok'>('');
  const [err, setErr] = useState<unknown>();
  if (etat === 'ok') return <div className="succes">{t('lazzeko.aide.envoyee')}</div>;
  if (!ouvert)
    return (
      <button type="button" className="btn large" style={{ marginTop: 16 }} onClick={() => setOuvert(true)}>
        {t('lazzeko.aide.bouton')}
      </button>
    );
  return (
    <div className="aide-support">
      <b>{t('lazzeko.aide.titre')}</b>
      <span className="muted petit">{t('lazzeko.aide.detail')}</span>
      <textarea rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('lazzeko.aide.exemple')} />
      <Erreur e={err} />
      <div className="actions-avis">
        <button type="button" className="btn petit" onClick={() => setOuvert(false)}>{t('commun.annuler')}</button>
        <button
          type="button"
          className="btn prim"
          disabled={message.trim().length < 3 || etat === 'envoi'}
          onClick={async () => {
            setEtat('envoi');
            try {
              await api(`/fiches/${ficheId}/aide`, { method: 'POST', json: { message } });
              setEtat('ok');
            } catch (e) {
              setErr(e);
              setEtat('');
            }
          }}
        >
          {etat === 'envoi' ? t('commun.envoi') : t('messages.envoyer')}
        </button>
      </div>
    </div>
  );
}
