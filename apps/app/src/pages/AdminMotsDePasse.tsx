import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { api } from '../lib/api';
import { useEspace } from '../lib/espace';

interface Demande {
  id: string; message: string | null; statut: 'EN_ATTENTE' | 'CODE_ENVOYE' | 'UTILISEE' | 'ANNULEE'; codeExpire: string | null; essais: number;
  espace: string | null; createdAt: string; traiteeLe: string | null; expire: boolean;
  user: { id: string; identifiant: string; nom: string | null; numeroOdoo: string | null };
}

const quand = (d: string) => new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const heure = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const STATUT = { EN_ATTENTE: 'En attente', CODE_ENVOYE: 'Code donné', UTILISEE: 'Mot de passe changé', ANNULEE: 'Annulée' } as const;

/** Administration → Mots de passe oubliés : générer le code (1 h) et le donner au client (admin, en français). */
export default function AdminMotsDePasse() {
  const { espace } = useEspace();
  const [liste, setListe] = useState<{ enAttente: number; demandes: Demande[] }>();
  const [err, setErr] = useState<unknown>();
  const [codes, setCodes] = useState<Record<string, { code: string; expire: string }>>({});
  const charger = () => api<{ enAttente: number; demandes: Demande[] }>('/admin/mots-de-passe').then(setListe).catch(setErr);
  useEffect(() => {
    charger();
  }, []);

  const generer = async (d: Demande) => {
    if (d.statut === 'CODE_ENVOYE' && !d.expire && !confirm('Un code a déjà été donné. En générer un nouveau ? L\'ancien ne marchera plus.')) return;
    try {
      const c = await api<{ code: string; expire: string }>(`/admin/mots-de-passe/${d.id}/code`, { method: 'POST' });
      setCodes({ ...codes, [d.id]: c });
      charger();
    } catch (e) {
      setErr(e);
    }
  };
  const message = (c: { code: string; expire: string }) =>
    `${espace.nomApp} : votre code pour changer de mot de passe est ${c.code} (valable jusqu'à ${heure(c.expire)}). Sur l'écran de connexion : « Mot de passe oublié ? » puis « J'ai déjà un code ».`;
  const partager = async (c: { code: string; expire: string }) => {
    const texte = message(c);
    if (navigator.share) await navigator.share({ text: texte }).catch(() => {});
    else await navigator.clipboard?.writeText(texte);
  };

  if (!liste) return <div className="page"><Erreur e={err} /><Chargement /></div>;
  return (
    <div className="page">
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>Mots de passe oubliés</h1>
      <p className="muted petit">Vérifiez que c'est bien votre client (appel, numéro connu), générez le code et donnez-le-lui. Valable 1 heure, une seule fois, 5 essais.</p>
      <Erreur e={err} />
      {!liste.demandes.length && <p className="muted">Aucune demande.</p>}
      <div className="liste">
        {liste.demandes.map((d) => {
          const c = codes[d.id];
          const active = d.statut === 'EN_ATTENTE' || d.statut === 'CODE_ENVOYE';
          return (
            <div key={d.id} className={'carte mdp-demande' + (active ? '' : ' traitee')}>
              <div>
                <b>{d.user.nom || d.user.identifiant}</b> <span className="muted petit">({d.user.identifiant}{d.user.numeroOdoo ? ` · Odoo ${d.user.numeroOdoo}` : ''})</span>
              </div>
              <div className="muted petit">
                {quand(d.createdAt)}{d.espace ? ` · ${d.espace}` : ''} · <b>{d.expire ? 'Code expiré' : STATUT[d.statut]}</b>
                {d.statut === 'CODE_ENVOYE' && !d.expire && d.codeExpire && ` jusqu'à ${heure(d.codeExpire)}`}
                {d.essais > 0 && active && ` · ${d.essais} essai(s) raté(s)`}
              </div>
              {d.message && <p className="mdp-message">« {d.message} »</p>}
              {c && (
                <div className="mdp-code-admin">
                  <span>Code à donner</span>
                  <b>{c.code.slice(0, 3)} {c.code.slice(3)}</b>
                  <small>valable jusqu'à {heure(c.expire)}</small>
                  <button type="button" className="btn prim petit" onClick={() => partager(c)}>Envoyer (SMS, WhatsApp…)</button>
                </div>
              )}
              {active && (
                <div className="actions">
                  <button type="button" className="btn petit" onClick={() => generer(d)}>{d.statut === 'EN_ATTENTE' || d.expire ? '🔑 Générer le code' : '🔑 Nouveau code'}</button>
                  <Link to={`/admin/comptes/${d.user.id}/activite`} className="btn petit">Activité</Link>
                  <button type="button" className="btn petit danger" onClick={async () => { await api(`/admin/mots-de-passe/${d.id}/annuler`, { method: 'POST' }); charger(); }}>Annuler</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
