import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { api } from '../lib/api';

interface Activite { id: string; type: 'connexion' | 'page' | 'recherche'; espace: string | null; chemin: string | null; detail: string | null; resultats: number | null; createdAt: string }
interface Journal { user: { id: string; identifiant: string; nom: string | null; numeroOdoo: string | null }; jours: number; activites: Activite[] }

const ICONE = { connexion: '🔑', page: '📄', recherche: '🔍' } as const;
const heure = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const jour = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Administration → Comptes → un client → Activité : connexions, pages consultées et recherches,
 * pour savoir s'il a cherché avant d'appeler (admin, en français).
 */
export default function AdminActivite() {
  const { id = '' } = useParams();
  const [jours, setJours] = useState(7);
  const [j, setJ] = useState<Journal>();
  const [err, setErr] = useState<unknown>();
  useEffect(() => {
    setJ(undefined);
    api<Journal>(`/admin/users/${id}/activite?jours=${jours}`).then(setJ).catch(setErr);
  }, [id, jours]);

  const parJour = new Map<string, Activite[]>();
  for (const a of j?.activites ?? []) parJour.set(jour(a.createdAt), [...(parJour.get(jour(a.createdAt)) ?? []), a]);
  const recherches = (j?.activites ?? []).filter((a) => a.type === 'recherche');
  const sansResultat = recherches.filter((a) => a.resultats === 0).length;

  return (
    <div className="page">
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>Activité</h1>
      <Erreur e={err} />
      {!j ? (
        <Chargement />
      ) : (
        <>
          <p>
            <b>{j.user.nom || j.user.identifiant}</b> <span className="muted">({j.user.identifiant}{j.user.numeroOdoo ? ` · Odoo ${j.user.numeroOdoo}` : ''})</span>
          </p>
          <div className="seg">
            {[1, 7, 30, 90].map((n) => (
              <button key={n} type="button" className={jours === n ? 'on' : ''} onClick={() => setJours(n)}>{n === 1 ? '24 h' : `${n} jours`}</button>
            ))}
          </div>
          <div className="ac-resume carte">
            <span><b>{j.activites.filter((a) => a.type === 'connexion').length}</b> connexion(s)</span>
            <span><b>{j.activites.filter((a) => a.type === 'page').length}</b> page(s)</span>
            <span><b>{recherches.length}</b> recherche(s){sansResultat ? <> dont <b className="ac-ko">{sansResultat} sans résultat</b></> : ''}</span>
          </div>
          {!j.activites.length && <p className="muted">Aucune activité sur cette période.</p>}
          {[...parJour].map(([d, liste]) => (
            <section key={d}>
              <h4>{d}</h4>
              <ul className="ac-liste">
                {liste.map((a) => (
                  <li key={a.id} className={a.type === 'recherche' && a.resultats === 0 ? 'ko' : ''}>
                    <span className="ac-h">{heure(a.createdAt)}</span>
                    <span className="ac-i">{ICONE[a.type]}</span>
                    <span className="ac-t">
                      {a.type === 'connexion' && <>Connexion{a.espace ? ` (${a.espace})` : ''}</>}
                      {a.type === 'page' && (a.chemin ? <Link to={a.chemin}>{a.detail || a.chemin}</Link> : a.detail)}
                      {a.type === 'recherche' && (
                        <>
                          Recherche « <b>{a.detail}</b> » →{' '}
                          {a.resultats === 0 ? <b className="ac-ko">aucun résultat</b> : `${a.resultats} résultat(s)`}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
