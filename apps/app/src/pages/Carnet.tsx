import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { ImageApi } from '../espaces/kiavik/donneesProcedures';
import { api } from '../lib/api';
import { useEspace } from '../lib/espace';
import { t, tn } from '../lib/i18n';
import { compresser } from '../lib/image';
import { date } from '../lib/util';

export type Etat = 'ok' | 'bientot' | 'retard';
export interface TacheCarnet {
  id: string; plan: string; titre: string; description: string | null; frequence: number; unite: 'JOURS' | 'SEMAINES' | 'MOIS';
  photo: 'non' | 'facultative' | 'obligatoire'; photoConsigne: string | null; technicien: boolean;
  procedure: { id: string; titre: string; publiee: boolean } | null; derniere: string | null; prochaine: string; jours: number; etat: Etat;
}
export interface LigneCarnet {
  id: string; tacheId: string | null; tache: string | null; titre: string | null; note: string | null; date: string; source: string;
  parAdmin: boolean; auteur: string; photo: string | null;
}
export interface CarnetMachine {
  id: string; nom: string; surnom: string | null; numeroSerie: string | null; miseEnService: string | null; espaces: string[];
  client: { id: string; identifiant: string; nom: string | null; numeroOdoo: string | null };
  taches: TacheCarnet[]; etat: Etat; historique: LigneCarnet[];
}
export const ICONE_ETAT: Record<Etat, string> = { ok: '✅', bientot: '🟠', retard: '🔴' };

/** Clé gardée sur le téléphone : le pas-à-pas ouvert depuis le carnet note la tâche à la fin. */
export const cleCarnet = (procedureId: string) => `kiavik.carnet.${procedureId}`;

/** Carnets d'entretien de mes machines (espace ouvert). */
export default function Carnets() {
  const [l, setL] = useState<CarnetMachine[]>();
  const [err, setErr] = useState<unknown>();
  useEffect(() => {
    api<CarnetMachine[]>('/moi/carnet').then(setL).catch(setErr);
  }, []);
  if (err) return <div className="page"><Erreur e={err} /></div>;
  if (!l) return <Chargement />;
  if (l.length === 1) return <CarnetPage id={l[0].id} />;
  return (
    <div className="page">
      <h1>{t('carnet.titre')}</h1>
      {!l.length && <p className="muted">{t('carnet.aucuneMachine')}</p>}
      <div className="liste">
        {l.map((m) => (
          <Link key={m.id} to={`/carnet/${m.id}`} className="carte lien-bloc cn-machine">
            <b>{ICONE_ETAT[m.etat]} {m.surnom || m.nom}</b>
            <span className="muted petit">{m.surnom ? `${m.nom} · ` : ''}{m.numeroSerie ? t('machines.numeroSerie', { n: m.numeroSerie }) : ''}</span>
            <span className="petit">{resume(m)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const resume = (m: CarnetMachine) => {
  const r = m.taches.filter((x) => x.etat === 'retard').length;
  const b = m.taches.filter((x) => x.etat === 'bientot').length;
  if (!m.taches.length) return t('carnet.aucunePlan');
  return [r && tn('carnet.nbRetard', r), b && tn('carnet.nbBientot', b)].filter(Boolean).join(' · ') || t('carnet.aJour');
};

export function CarnetRoute() {
  const { id = '' } = useParams();
  return <CarnetPage key={id} id={id} />;
}

/** Carnet d'une machine : tâches (à jour / bientôt / en retard), « C'est fait », pas-à-pas, notes et photos, historique. */
function CarnetPage({ id }: { id: string }) {
  const [m, setM] = useState<CarnetMachine>();
  const [err, setErr] = useState<unknown>();
  const [params] = useSearchParams();
  const [ouverte, setOuverte] = useState<string | null>(params.get('noter'));
  const nav = useNavigate();
  const { espace } = useEspace();
  useEffect(() => {
    api<CarnetMachine>(`/moi/carnet/${id}`).then(setM).catch(setErr);
  }, [id]);
  if (err) return <div className="page"><Erreur e={err} /></div>;
  if (!m) return <Chargement />;

  const faire = (tache: TacheCarnet) => {
    if (!tache.procedure) return;
    // on repart de zéro : une ancienne progression ne doit pas compter comme faite
    for (const k of ['etapes', 'controles', 'reponses', 'envoye', 'envoyePlusTard', 'session', 'parcours']) localStorage.removeItem(`kiavik.${k}.${tache.procedure.id}`);
    localStorage.setItem(cleCarnet(tache.procedure.id), JSON.stringify({ machine: m.id, tache: tache.id, photo: tache.photo === 'obligatoire' }));
    nav(`/procedures/${tache.procedure.id}`, { state: { parcours: true } });
  };

  return (
    <div className="page cn">
      <Link to="/carnet" className="btn-lien">{t('carnet.retour')}</Link>
      <h1>{t('carnet.titre')}</h1>
      <p><b>{m.surnom || m.nom}</b>{m.surnom && <span className="muted"> · {m.nom}</span>}</p>
      <p className="muted petit">
        {m.numeroSerie && <>{t('machines.numeroSerie', { n: m.numeroSerie })} · </>}
        {m.miseEnService && t('carnet.miseEnService', { date: date(m.miseEnService) })}
      </p>

      <h2>{t('carnet.entretiens')}</h2>
      {!m.taches.length && <p className="muted">{t('carnet.aucunePlan')}</p>}
      <div className="liste">
        {m.taches.map((x) => (
          <div key={x.id} className={`carte cn-tache cn-${x.etat}`}>
            <div className="cn-tete">
              <span className="cn-icone" aria-hidden="true">{ICONE_ETAT[x.etat]}</span>
              <span className="cn-titre">
                <b>{x.titre}</b>
                <small className="muted">
                  {x.frequence === 1 ? t(`carnet.chaque.${x.unite}`) : t('carnet.frequence', { n: x.frequence, unite: t(`carnet.unite.${x.unite}`) })}
                  {' · '}{x.derniere ? t('carnet.derniere', { date: date(x.derniere) }) : t('carnet.jamais')}
                </small>
                <small className={`cn-echeance cn-${x.etat}`}>
                  {x.etat === 'retard' ? tn('carnet.enRetard', -x.jours) : t('carnet.prochaine', { date: date(x.prochaine) })}
                </small>
              </span>
            </div>
            {x.description && <p className="petit">{x.description}</p>}
            {x.technicien ? (
              <p className="muted petit">{t('carnet.technicien', { societe: espace.nom })}</p>
            ) : ouverte === x.id ? (
              <Noter machine={m.id} tache={x} onFait={(r) => { setM(r); setOuverte(null); }} onAnnuler={() => setOuverte(null)} />
            ) : (
              <div className="actions-avis">
                <button type="button" className="btn petit prim" onClick={() => setOuverte(x.id)}>{t('carnet.cestFait')}</button>
                {x.procedure?.publiee && espace.slug === 'kiavik' && (
                  <button type="button" className="btn petit" onClick={() => faire(x)}>{t('carnet.voirPasAPas')}</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <h2>{t('carnet.historique')}</h2>
      {ouverte === 'note' ? (
        <Noter machine={m.id} onFait={(r) => { setM(r); setOuverte(null); }} onAnnuler={() => setOuverte(null)} />
      ) : (
        <button type="button" className="btn" onClick={() => setOuverte('note')}>{t('carnet.ajouterNote')}</button>
      )}
      <ul className="cn-historique">
        {m.historique.map((h) => (
          <li key={h.id} className="carte">
            <div className="cn-tete">
              <span className="cn-titre">
                <b>{h.tache ?? h.titre ?? t('carnet.note')}</b>
                <small className="muted">
                  {date(h.date)} · {h.parAdmin ? t('carnet.parFournisseur', { societe: espace.nom }) : h.source === 'pasapas' ? t('carnet.viaPasAPas') : h.auteur}
                </small>
              </span>
              {!h.parAdmin && (
                <button type="button" className="btn petit" aria-label={t('carnet.retirer')}
                  onClick={() => confirm(t('carnet.retirerConfirm')) && api<CarnetMachine>(`/moi/carnet/faits/${h.id}`, { method: 'DELETE' }).then(setM).catch(setErr)}>🗑</button>
              )}
            </div>
            {h.note && <p className="petit">{h.note}</p>}
            {h.photo && <ImageApi chemin={h.photo} className="cn-photo" />}
          </li>
        ))}
        {!m.historique.length && <li className="muted">{t('carnet.historiqueVide')}</li>}
      </ul>
    </div>
  );
}

/** « C'est fait » (une tâche) ou note libre : date (aujourd'hui par défaut), note, photo compressée sur le téléphone. */
export function Noter({ machine, tache, onFait, onAnnuler, chemin }: {
  machine: string; tache?: TacheCarnet; onFait: (m: CarnetMachine) => void; onAnnuler: () => void; chemin?: string;
}) {
  const [jour, setJour] = useState(new Date().toISOString().slice(0, 10));
  const [titre, setTitre] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<{ fichier: Blob; apercu: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState<unknown>();
  const photoDemandee = tache ? tache.photo !== 'non' : true;
  const envoyer = async () => {
    setEnvoi(true);
    setErr(undefined);
    const fd = new FormData();
    if (tache) fd.append('tacheId', tache.id);
    fd.append('date', jour);
    if (titre.trim()) fd.append('titre', titre.trim());
    if (note.trim()) fd.append('note', note.trim());
    if (photo) fd.append('photo', photo.fichier, 'photo.jpg');
    try {
      onFait(await api<CarnetMachine>(chemin ?? `/moi/carnet/${machine}/faits`, { method: 'POST', body: fd }));
    } catch (e) {
      setErr(e);
    } finally {
      setEnvoi(false);
    }
  };
  const manque = (tache?.photo === 'obligatoire' && !photo && !chemin) || (!tache && !titre.trim() && !note.trim());
  return (
    <div className="form cn-noter">
      {!tache && <label>{t('carnet.titreNote')}<input value={titre} maxLength={120} onChange={(e) => setTitre(e.target.value)} placeholder={t('carnet.titreNoteExemple')} /></label>}
      <label>{t('carnet.quand')}<input type="date" value={jour} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setJour(e.target.value)} /></label>
      <label>{t('carnet.noteFacultative')}<textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {photoDemandee && (
        <label className="cn-photo-champ">
          {tache?.photo === 'obligatoire' ? t('carnet.photoObligatoire') : t('carnet.photoFacultative')}
          {tache?.photoConsigne && <small className="muted">{tache.photoConsigne}</small>}
          {photo ? <img src={photo.apercu} alt="" className="cn-photo" /> : null}
          <input type="file" accept="image/*" capture="environment"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                const c = await compresser(f);
                setPhoto({ fichier: c.fichier, apercu: c.apercu });
              }
            }} />
        </label>
      )}
      <Erreur e={err} />
      <div className="actions-avis">
        <button type="button" className="btn" onClick={onAnnuler}>{t('carnet.annuler')}</button>
        <button type="button" className="btn prim" disabled={envoi || manque} onClick={envoyer}>{envoi ? t('carnet.envoi') : t('carnet.enregistrer')}</button>
      </div>
    </div>
  );
}

/** Fin d'un pas-à-pas ouvert depuis le carnet, quand une photo est demandée : renvoi vers le carnet pour la noter. */
export function RetourCarnet({ procedureId }: { procedureId: string }) {
  const brut = localStorage.getItem(cleCarnet(procedureId));
  if (!brut) return null;
  try {
    const { machine, tache, photo } = JSON.parse(brut) as { machine: string; tache: string; photo: boolean };
    if (!photo) return null;
    return (
      <Link to={`/carnet/${machine}?noter=${tache}`} className="btn prim" onClick={() => localStorage.removeItem(cleCarnet(procedureId))}>
        {t('carnet.noterAvecPhoto')}
      </Link>
    );
  } catch {
    return null;
  }
}
