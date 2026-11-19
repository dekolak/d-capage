import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Erreur } from '../components/Composants';
import { api, MaMachine } from '../lib/api';
import { useEspace } from '../lib/espace';
import { LANGUES, NOMS_LANGUES } from '../lib/i18n';
import { abonnementActuel, activerNotifications, desactiverNotifications } from '../lib/notifications';
import { date } from '../lib/util';
import type { FabricantAdmin } from './AdminCatalogue';

interface U { id: string; identifiant: string; nom: string | null; numero: number | null; role: 'ADMIN' | 'USER'; actif: boolean; createdAt: string; _count?: { fiches: number }; modules: string[]; espaces: string[]; conditions: Record<string, { version: number }>; accordPhotosMarketing: boolean; clientLazzeko: boolean; numeroOdoo: string | null; langue: string | null; motDePasseProvisoire?: boolean }
interface Cle { id: string; nom: string; prefixe: string; derniereUtilisation: string | null; revoqueeLe: string | null; createdAt: string }

type Zone = 'commun' | string;
const CLE_SECTIONS = 'admin.sections';
interface Entree { to: string; titre: string; texte: string; zone: Zone; compte?: number; module?: string }

/** Badge de l'espace (couleur de l'espace) ou « Commun ». */
export function BadgeZone({ zone }: { zone: Zone }) {
  const { espaces } = useEspace();
  const e = espaces.find((x) => x.slug === zone);
  return <span className={`badge-espace ${e ? '' : 'commun'}`} style={e ? { ['--c' as string]: e.couleur } : undefined}>{e?.nom ?? 'Commun'}</span>;
}

/** En-tête des pages d'administration : retour, titre, badge de l'espace. */
export function EnteteAdmin({ titre, zone, children }: { titre: string; zone: Zone; children?: React.ReactNode }) {
  return (
    <>
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>{titre} <BadgeZone zone={zone} /></h1>
      {children}
    </>
  );
}

/**
 * Administration : rangée par usage, pensée pour le téléphone.
 * En haut « À traiter » (seulement s'il y a quelque chose), puis des tuiles courtes : Clients, Contenus, Machines.
 * Les réglages rares (notifications, conditions, clés API, envoi vers une API) sont repliés en bas.
 * Pastille de couleur = entrée propre à une société ; l'ouvrir bascule dans cet espace.
 */
interface Groupe { titre: string; entrees: Entree[] }
export default function Admin() {
  const { espace: ouvert, espaces, choisir } = useEspace();
  const nav = useNavigate();
  const [reglages, setReglages] = useState(() => localStorage.getItem(CLE_SECTIONS) === 'reglages');
  const [compte, setCompte] = useState({ aide: 0, utilisateurs: 0, retard: 0, flous: 0, mdp: 0 });
  useEffect(() => {
    Promise.all([
      api<unknown[]>('/admin/aide?traitee=non').catch(() => []),
      api<U[]>('/users').catch(() => []),
      api<unknown[]>('/admin/entretien/machines?etat=retard').catch(() => []),
      api<{ n: number }>('/admin/avis-contenu/a-traiter').catch(() => ({ n: 0 })),
      api<{ enAttente: number }>('/admin/mots-de-passe').catch(() => ({ enAttente: 0 })),
    ]).then(([a, u, r, f, m]) => setCompte({ aide: a.length, utilisateurs: u.length, retard: r.length, flous: f.n, mdp: m.enAttente }));
  }, []);
  const groupes: Groupe[] = [
    { titre: 'Clients', entrees: [
      { zone: 'commun', to: '/admin/utilisateurs', titre: '👥 Utilisateurs', texte: `${compte.utilisateurs} compte(s)` },
      { zone: 'commun', to: '/admin/mots-de-passe', titre: '🔐 Mots de passe', texte: 'codes oubliés', compte: compte.mdp },
      { zone: 'lazzeko', to: '/admin/aide', titre: "🆘 Demandes d'aide", texte: 'depuis les fiches', compte: compte.aide },
      { zone: 'commun', to: '/admin/diagnostics', titre: '🩺 Dépannages reçus', texte: 'résultats clients' },
      { zone: 'commun', to: '/admin/avis-contenu', titre: "🤔 C'était clair ?", texte: 'avis sur les contenus', compte: compte.flous },
      { zone: 'lazzeko', to: '/admin/avis', titre: '⭐ Avis', texte: 'masquer' },
      { zone: 'lazzeko', to: '/admin/fiches', titre: '📝 Fiches de réglage', texte: 'qui, masquer' },
    ] },
    { titre: 'Contenus', entrees: [
      { zone: 'commun', to: '/admin/procedures', titre: '📋 Pas-à-pas', texte: 'créer, publier' },
      { zone: 'commun', to: '/admin/solutions', titre: '💡 Bon à savoir', texte: 'astuces, solutions' },
      { zone: 'commun', to: '/admin/academie', titre: '🎓 Académie', texte: 'parcours, pages' },
      { zone: 'commun', to: '/admin/terrain', titre: '🎥 Mode terrain', texte: 'capturer sur place' },
      { zone: 'commun', to: '/admin/categories', titre: '🗂 Catégories', texte: 'ranger, ordonner' },
      { zone: 'commun', to: '/admin/messages', titre: '💬 Messages', texte: "bulles d'info" },
    ] },
    { titre: 'Machines', entrees: [
      { zone: 'commun', to: '/admin/catalogue', titre: '🔧 Machines', texte: 'modèles, images' },
      { zone: 'commun', to: '/admin/entretien', titre: '📒 Entretien', texte: 'plans, retards', compte: compte.retard },
      { zone: 'lazzeko', to: '/admin/familles', titre: '🏷️ Familles', texte: 'matériaux, précisions' },
    ] },
  ];
  const rares: Entree[] = [
    { zone: 'commun', to: '/admin/conditions', titre: "📜 Conditions d'utilisation", texte: 'texte et version' },
    { zone: 'commun', to: '/admin/cles-api', titre: '🔑 Clés API', texte: 'Odoo, n8n' },
    { zone: 'commun', to: '/admin/webhooks', titre: '📤 Envoi vers une API', texte: 'événements vers n8n, IA' },
  ];
  const visible = (e: Entree) => e.zone === 'commun' || espaces.some((x) => x.slug === e.zone && (!e.module || x.modules.some((m) => m.slug === e.module)));
  const aTraiter = groupes.flatMap((g) => g.entrees).filter((e) => visible(e) && (e.compte ?? 0) > 0);
  const ouvrir = (e: Entree) => {
    if (e.zone !== 'commun' && e.zone !== ouvert.slug) choisir(e.zone);
    nav(e.to);
  };
  const tuile = (e: Entree) => {
    const esp = espaces.find((x) => x.slug === e.zone);
    return (
      <button key={e.to} type="button" className="adm-tuile" onClick={() => ouvrir(e)} title={esp ? `Propre à ${esp.nom}` : undefined}>
        <b>{e.titre}{!!e.compte && <span className="badge-rouge">{e.compte}</span>}</b>
        <small>{esp && <i className="adm-pastille" style={{ ['--c' as string]: esp.couleur }} />}{e.texte}</small>
      </button>
    );
  };

  return (
    <div className="page adm">
      <h1>Administration</h1>
      {aTraiter.length > 0 && (
        <div className="adm-traiter">
          <b>À traiter</b>
          {aTraiter.map((e) => (
            <button key={e.to} type="button" className="btn petit" onClick={() => ouvrir(e)}>{e.titre} <span className="badge-rouge">{e.compte}</span></button>
          ))}
        </div>
      )}
      {groupes.map((g) => (
        <section key={g.titre}>
          <h2 className="adm-groupe">{g.titre}</h2>
          <div className="adm-tuiles">{g.entrees.filter(visible).map(tuile)}</div>
        </section>
      ))}
      <details className="adm-section" open={reglages} onToggle={(ev) => {
        const o = (ev.target as HTMLDetailsElement).open;
        setReglages(o);
        localStorage.setItem(CLE_SECTIONS, o ? 'reglages' : '');
      }}>
        <summary><h2>⚙️ Réglages</h2></summary>
        <Notifications />
        <div className="adm-tuiles">{rares.map(tuile)}</div>
      </details>
    </div>
  );
}

export function AdminUtilisateurs() {
  const [users, setUsers] = useState<U[]>([]);
  const [catalogue, setCatalogue] = useState<FabricantAdmin[]>([]);
  const [selection, setSelection] = useState<U | null>(null);
  // machines à ajouter dès la création du client
  const [nouvellesMachines, setNouvellesMachines] = useState<NouvelleMachine[]>([]);
  const [err, setErr] = useState<unknown>();
  const { espace: espaceOuvert, espaces } = useEspace();
  const vide = () => ({ identifiant: '', motDePasse: '', nom: '', role: 'USER', numeroOdoo: '', modules: espaceOuvert.modules.slice(0, 1).map((m) => m.slug) });
  const [f, setF] = useState(vide);
  const [recherche, setRecherche] = useState('');
  const [filtreEspace, setFiltreEspace] = useState('');
  const lazzeko = (modules: string[]) => modules.includes('reglages-decapage');

  const charger = () => api<U[]>('/users').then(setUsers).catch(setErr);
  useEffect(() => {
    charger();
    api<FabricantAdmin[]>('/admin/catalogue').then(setCatalogue).catch(setErr);
  }, []);

  const creerUser = async (e: FormEvent) => {
    e.preventDefault();
    setErr(undefined);
    try {
      const u = await api<{ id: string }>('/users', { method: 'POST', json: { ...f, nom: f.nom || undefined, numeroOdoo: f.numeroOdoo.trim() || undefined, modules: f.role === 'ADMIN' ? [] : f.modules } });
      for (const m of f.role === 'ADMIN' ? [] : nouvellesMachines) await api(`/users/${u.id}/machines`, { method: 'POST', json: corpsMachine(m) });
      setF(vide());
      setNouvellesMachines([]);
      charger();
    } catch (x) { setErr(x); }
  };

  const basculerActif = async (u: U) => {
    await api(`/users/${u.id}`, { method: 'PATCH', json: { actif: !u.actif } }).catch(setErr);
    charger();
  };


  return (
    <div className="page">
      <EnteteAdmin titre="Utilisateurs" zone="commun" />
      <Erreur e={err} />
      <details className="carte adm-creer">
        <summary><b>+ Créer un utilisateur</b></summary>
      <form className="form" onSubmit={creerUser}>
        <label>Identifiant<input value={f.identifiant} autoCapitalize="none" onChange={(e) => setF({ ...f, identifiant: e.target.value })} required /></label>
        <label>
          Mot de passe provisoire (le client choisira le sien à la connexion)
          <span className="ba-libre">
            <input value={f.motDePasse} minLength={8} onChange={(e) => setF({ ...f, motDePasse: e.target.value })} required />
            <button type="button" className="btn petit" onClick={() => setF({ ...f, motDePasse: genererCode() })}>🎲 Générer</button>
          </span>
        </label>
        <label>Nom<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></label>
        <label>N° client Odoo (facultatif)<input value={f.numeroOdoo} maxLength={40} onChange={(e) => setF({ ...f, numeroOdoo: e.target.value })} placeholder="ex. C00123" /></label>
        <label>Rôle
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="USER">Utilisateur</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        {f.role === 'USER' && (
          <div>
            <b className="petit">Accès</b>
            <CasesModules valeur={f.modules} onChange={(modules) => setF({ ...f, modules })} />
          </div>
        )}
        {f.role === 'USER' && (
          <div>
            <b className="petit">Machines du client</b>
            {nouvellesMachines.map((m, i) => (
              <div key={i} className="petit sous-bloc ligne-machine">
                <span style={{ flex: 1 }}>{nomVariante(catalogue, m.varianteId)}{m.numeroSerie && ` · n° ${m.numeroSerie}`} · mise en service {m.miseEnService || "aujourd'hui"}</span>
                <button type="button" className="btn petit" onClick={() => setNouvellesMachines((l) => l.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <AjoutMachine catalogue={catalogue} onAjouter={(m) => setNouvellesMachines((l) => [...l, m])} />
          </div>
        )}
        <button className="btn prim">Créer</button>
      </form>
      </details>

      <h2>Utilisateurs ({users.length})</h2>
      <input className="recherche" placeholder="Rechercher (identifiant, nom, n° Odoo, n° client)…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <select value={filtreEspace} onChange={(e) => setFiltreEspace(e.target.value)} style={{ marginBottom: 10 }}>
        <option value="">Tous les espaces</option>
        {espaces.map((e) => <option key={e.slug} value={e.slug}>{e.nom}</option>)}
      </select>
      <div className="liste">
        {users.filter((u) => {
          const q = recherche.trim().toLowerCase();
          if (filtreEspace && !u.espaces.includes(filtreEspace)) return false;
          return !q || [u.identifiant, u.nom ?? '', u.numeroOdoo ?? '', u.numero ? String(u.numero) : ''].some((x) => x.toLowerCase().includes(q.replace(/^[a-z]-?(?=\d)/, '')));
        }).map((u) => (
          <div key={u.id} className={'carte ligne-machine' + (u.actif ? '' : ' inactif')}>
            <button type="button" className="lien-bloc" onClick={() => setSelection(selection?.id === u.id ? null : u)}>
              <b>{u.nom || u.identifiant}</b> <span className="muted petit">{u.identifiant} · {u.role === 'ADMIN' ? 'admin' : 'utilisateur'} · {date(u.createdAt)}</span>
              {u.role !== 'ADMIN' && (
                <span className="petit">
                  {u.espaces.map((s) => {
                    const e = espaces.find((x) => x.slug === s);
                    return ` · ${e?.nom ?? s} : ${u.conditions[s] ? `conditions v${u.conditions[s].version} ✓` : 'conditions non acceptées'}`;
                  }).join('')}
                  {u.accordPhotosMarketing ? ' · 📷 accord photos' : ''}
                </span>
              )}
              {u.role !== 'ADMIN' && u.espaces.map((s) => {
                const e = espaces.find((x) => x.slug === s);
                return <span key={s} className="badge-espace" style={{ ['--c' as string]: e?.couleur }}>{e?.nom ?? s}</span>;
              })}
              {u.role !== 'ADMIN' && !u.espaces.length && <span className="badge-masquee">Aucun accès</span>}
              {u.role !== 'ADMIN' && lazzeko(u.modules) && u.clientLazzeko && <span className="badge-client" title="Au moins une machine Lazzeko">Client Lazzeko</span>}
              {u.numero && <span className="badge-numero" title="N° client dans l'app (en haut à droite de son app)">📱 {u.numero}</span>}
              {u.numeroOdoo && <span className="badge-odoo">Odoo {u.numeroOdoo}</span>}
              {u.motDePasseProvisoire && u.role !== 'ADMIN' && <span className="badge-odoo" title="Pas encore connecté : il choisira son mot de passe à la première connexion">⏳ code provisoire</span>}
            </button>
            <button type="button" className="btn petit" onClick={() => basculerActif(u)}>{u.actif ? 'Désactiver' : 'Réactiver'}</button>
            {u.role !== 'ADMIN' && (
              <button type="button" className="btn petit danger" onClick={async () => {
                const ok = prompt(`Supprimer définitivement « ${u.identifiant} » et tout ce qui lui appartient (machines, fiches, photos, avis, réponses) ?\nTapez son identifiant pour confirmer :`);
                if (ok?.trim().toLowerCase() !== u.identifiant) return;
                await api(`/users/${u.id}`, { method: 'DELETE' }).then(charger).catch(setErr);
              }}>🗑 Supprimer</button>
            )}
            {selection?.id === u.id && (
              <div className="sous-bloc">
                <NumeroOdoo u={u} onMaj={charger} />
                {u.role !== 'ADMIN' && <CodeProvisoire u={u} onMaj={charger} />}
                {u.role !== 'ADMIN' && (
                  <>
                    <b className="petit">Accès</b>
                    <CasesModules
                      valeur={u.modules}
                      onChange={async (modules) => {
                        setUsers((l) => l.map((x) => (x.id === u.id ? { ...x, modules } : x))); // affichage immédiat
                        await api(`/users/${u.id}`, { method: 'PATCH', json: { modules } }).catch(setErr);
                        charger();
                      }}
                    />
                  </>
                )}
                {LANGUES.length > 1 && (
                  <label className="petit">
                    Langue de l'app{' '}
                    <select value={u.langue ?? ''} onChange={async (e) => { await api(`/users/${u.id}`, { method: 'PATCH', json: { langue: e.target.value || null } }); charger(); }}>
                      <option value="">Langue du téléphone</option>
                      {LANGUES.map((l) => <option key={l} value={l}>{NOMS_LANGUES[l] ?? l}</option>)}
                    </select>
                  </label>
                )}
                {u.role !== 'ADMIN' && <p><Link to={`/admin/comptes/${u.id}/activite`} className="lien">Voir son activité (connexions, pages, recherches) ›</Link></p>}
                {u.role !== 'ADMIN' && <Entretien userId={u.id} />}
                {lazzeko(u.modules) && <p><Link to={`/admin/fiches?userId=${u.id}`} className="lien">Voir ses fiches de réglage ({u._count?.fiches ?? 0}) ›</Link></p>}
                {u.role !== 'ADMIN' && <MachinesClient userId={u.id} catalogue={catalogue} />}
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}

/** Code provisoire facile à dicter : 8 caractères sans 0/O, 1/I/L (ex. K7PM-42QX). */
export function genererCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const n = crypto.getRandomValues(new Uint32Array(8));
  const c = Array.from(n, (x) => A[x % A.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/**
 * Client qui a perdu son mot de passe (au téléphone) : nouveau code provisoire, à dicter ou envoyer par SMS / WhatsApp.
 * Il choisira son mot de passe à la connexion ; ses autres téléphones sont déconnectés.
 */
function CodeProvisoire({ u, onMaj }: { u: U; onMaj: () => void }) {
  const { espace, espaces } = useEspace();
  // espace du client (adresse et nom de son app), sinon celui ouvert
  const sienne = espaces.find((x) => x.slug === u.espaces[0]) ?? espace;
  const [code, setCode] = useState('');
  const [err, setErr] = useState<unknown>();
  const generer = async () => {
    if (!confirm(`Nouveau code provisoire pour ${u.nom || u.identifiant} ? Son mot de passe actuel ne marchera plus.`)) return;
    const c = genererCode();
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', json: { motDePasse: c, motDePasseProvisoire: true } });
      setCode(c);
      onMaj();
    } catch (x) {
      setErr(x);
    }
  };
  const domaine = sienne.domaines?.[0];
  const lien = `${domaine && location.hostname !== 'localhost' ? `https://${domaine}` : location.origin}/?identifiant=${encodeURIComponent(u.identifiant)}`;
  const message = `Bonjour, voici votre code provisoire pour l'app ${sienne.nomApp} : ${code}\nIdentifiant : ${u.identifiant}\nÀ la connexion, vous choisirez votre mot de passe.\n${lien}`;
  return (
    <div className="carte form code-provisoire">
      <b className="petit">🔑 Mot de passe perdu</b>
      {!code ? (
        <button type="button" className="btn petit" onClick={generer}>Créer un code provisoire</button>
      ) : (
        <>
          <span className="code-gros">{code}</span>
          <small className="muted">Identifiant : <b>{u.identifiant}</b> · à la connexion, le client choisira son mot de passe. Le code ne sera plus affiché.</small>
          <div className="puces">
            <button type="button" className="btn petit" onClick={() => navigator.clipboard?.writeText(message)}>📋 Copier le message</button>
            <a className="btn petit" href={`sms:?&body=${encodeURIComponent(message)}`}>💬 SMS</a>
            <a className="btn petit" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
        </>
      )}
      <Erreur e={err} />
    </div>
  );
}

/** Administration → Clés API. */
export function AdminClesApi() {
  const [cles, setCles] = useState<Cle[]>([]);
  const [nouvelleCle, setNouvelleCle] = useState('');
  const [err, setErr] = useState<unknown>();
  const charger = () => api<Cle[]>('/admin/cles-api').then(setCles).catch(setErr);
  useEffect(() => {
    charger();
  }, []);
  const creerCle = async () => {
    const nom = prompt('Nom de la clé (ex. site web)')?.trim();
    if (!nom) return;
    const r = await api<{ cle: string }>('/admin/cles-api', { method: 'POST', json: { nom } }).catch((x) => { setErr(x); return null; });
    if (r) setNouvelleCle(r.cle);
    charger();
  };
  return (
    <div className="page">
      <EnteteAdmin titre="Clés API" zone="commun" />
      <Erreur e={err} />
      <p className="muted petit">Pour créer des comptes depuis un autre système : <code>POST /api/users</code> avec l'en-tête <code>X-Api-Key</code>.</p>
      {nouvelleCle && (
        <div className="succes">
          Copiez la clé maintenant, elle ne sera plus affichée :<br />
          <code className="cle">{nouvelleCle}</code>
        </div>
      )}
      <button type="button" className="btn" onClick={creerCle}>+ Nouvelle clé</button>
      <div className="liste">
        {cles.map((c) => (
          <div key={c.id} className={'carte ligne-machine' + (c.revoqueeLe ? ' inactif' : '')}>
            <div>
              <b>{c.nom}</b> <span className="muted petit">dk_{c.prefixe}_… · {c.derniereUtilisation ? 'utilisée le ' + date(c.derniereUtilisation) : 'jamais utilisée'}</span>
            </div>
            {!c.revoqueeLe && (
              <button type="button" className="btn petit danger" onClick={async () => { if (confirm('Révoquer cette clé ?')) { await api(`/admin/cles-api/${c.id}`, { method: 'DELETE' }); charger(); } }}>
                Révoquer
              </button>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}

/** Administration → Tags proposés par les clients (Lazzeko). */

/** Administration → Demandes d'aide (Lazzeko). */
export function AdminAide() {
  return (
    <div className="page">
      <EnteteAdmin titre="Demandes d'aide" zone="lazzeko" />
      <AideSupport />
    </div>
  );
}

/** Administration → Conditions d'utilisation (par espace). */
export function AdminConditions() {
  return (
    <div className="page">
      <EnteteAdmin titre="Conditions d'utilisation" zone="commun" />
      <ConditionsAdmin />
    </div>
  );
}

interface NouvelleMachine { varianteId: string; numeroSerie: string; miseEnService: string; surnom: string }
const corpsMachine = (m: NouvelleMachine) => ({
  varianteId: m.varianteId, numeroSerie: m.numeroSerie.trim() || undefined, surnom: m.surnom.trim() || undefined,
  ...(m.miseEnService ? { miseEnService: new Date(`${m.miseEnService}T12:00:00`).toISOString() } : {}),
});
const nomVariante = (cat: FabricantAdmin[], id: string) => {
  for (const f of cat) for (const mo of f.modeles) for (const v of mo.variantes) if (v.id === id) return `${f.nom} ${mo.nom}${v.nom === 'Standard' ? '' : ` ${v.nom}`}`;
  return '?';
};

/** Choisir une machine du catalogue, avec n° de série, mise en service (aujourd'hui par défaut) et surnom. */
function AjoutMachine({ catalogue, onAjouter }: { catalogue: FabricantAdmin[]; onAjouter: (m: NouvelleMachine) => void }) {
  const vide = { varianteId: '', numeroSerie: '', miseEnService: new Date().toISOString().slice(0, 10), surnom: '' };
  const [m, setM] = useState<NouvelleMachine>(vide);
  return (
    <div className="ajout-machine">
      <select value={m.varianteId} onChange={(e) => setM({ ...m, varianteId: e.target.value })}>
        <option value="">+ Machine…</option>
        {catalogue.map((fa) => (
          <optgroup key={fa.id} label={fa.nom}>
            {fa.modeles.flatMap((mo) => mo.variantes.filter((v) => v.actif).map((v) => (
              <option key={v.id} value={v.id}>{`${fa.nom} ${mo.nom}${v.nom === 'Standard' ? '' : ` ${v.nom}`}`} ({mo.espaces.join(', ') || 'non visible'})</option>
            )))}
          </optgroup>
        ))}
      </select>
      {m.varianteId && (
        <>
          <input value={m.numeroSerie} maxLength={60} placeholder="N° de série" onChange={(e) => setM({ ...m, numeroSerie: e.target.value })} />
          <label className="petit">Mise en service<input type="date" value={m.miseEnService} onChange={(e) => setM({ ...m, miseEnService: e.target.value })} /></label>
          <input value={m.surnom} maxLength={60} placeholder="Surnom (facultatif, ex. Atelier)" onChange={(e) => setM({ ...m, surnom: e.target.value })} />
          <button type="button" className="btn petit prim" onClick={() => { onAjouter(m); setM(vide); }}>Ajouter la machine</button>
        </>
      )}
    </div>
  );
}

/** Machines d'un client : n° de série, mise en service, surnom ; ajout et retrait par l'admin. */
function MachinesClient({ userId, catalogue }: { userId: string; catalogue: FabricantAdmin[] }) {
  const [liste, setListe] = useState<MaMachine[]>();
  const [err, setErr] = useState<unknown>();
  const [edition, setEdition] = useState<string | null>(null);
  const [v, setV] = useState({ numeroSerie: '', miseEnService: '', surnom: '' });
  const charger = () => api<MaMachine[]>(`/users/${userId}/machines`).then(setListe).catch(setErr);
  useEffect(() => {
    charger();
  }, [userId]);
  const faire = async (chemin: string, opts: RequestInit & { json?: unknown }) => {
    setErr(undefined);
    try {
      await api(chemin, opts);
      setEdition(null);
      charger();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="machines-client">
      <b>🔧 Machines ({liste?.length ?? '…'})</b>
      <Erreur e={err} />
      {liste?.map((m) => (
        <div key={m.id} className="sous-bloc petit">
          {edition === m.id ? (
            <div className="ajout-machine">
              <input value={v.numeroSerie} maxLength={60} placeholder="N° de série" onChange={(e) => setV({ ...v, numeroSerie: e.target.value })} />
              <label className="petit">Mise en service<input type="date" value={v.miseEnService} onChange={(e) => setV({ ...v, miseEnService: e.target.value })} /></label>
              <input value={v.surnom} maxLength={60} placeholder="Surnom" onChange={(e) => setV({ ...v, surnom: e.target.value })} />
              <span className="actions-avis">
                <button type="button" className="btn petit prim" onClick={() => faire(`/users/${userId}/machines/${m.id}`, {
                  method: 'PATCH',
                  json: { numeroSerie: v.numeroSerie.trim() || null, surnom: v.surnom, miseEnService: v.miseEnService ? new Date(`${v.miseEnService}T12:00:00`).toISOString() : null },
                })}>Enregistrer</button>
                <button type="button" className="btn petit" onClick={() => setEdition(null)}>Annuler</button>
              </span>
            </div>
          ) : (
            <div className="ligne-machine">
              <span style={{ flex: 1 }}>
                <b>{m.surnom ? `${m.surnom} · ` : ''}{m.nom}</b>
                <br />
                <span className="muted">
                  {m.numeroSerie ? `n° de série ${m.numeroSerie}` : 'sans n° de série'} · mise en service {m.miseEnService ? date(m.miseEnService) : '?'}
                  {' · '}{m.espaces.map((e) => e).join(', ') || 'non visible'}
                </span>
              </span>
              <Link to={`/admin/entretien/machines/${m.id}`} className="btn petit" title="Carnet d'entretien">📒</Link>
              <button type="button" className="btn petit" onClick={() => { setV({ numeroSerie: m.numeroSerie ?? '', miseEnService: m.miseEnService?.slice(0, 10) ?? '', surnom: m.surnom ?? '' }); setEdition(m.id); }}>✏️</button>
              <button type="button" className="btn petit danger" onClick={() => confirm(`Retirer ${m.surnom || m.nom} de ce client ? (ses fiches de réglage sont gardées)`) && faire(`/users/${userId}/machines/${m.id}`, { method: 'DELETE' })}>🗑</button>
            </div>
          )}
        </div>
      ))}
      <AjoutMachine catalogue={catalogue} onAjouter={(m) => faire(`/users/${userId}/machines`, { method: 'POST', json: corpsMachine(m) })} />
    </div>
  );
}

interface HistoriqueEntretien {
  reponses: { message: string; question: string | null; pasAPas: { id: string; titre: string } | null; valeur: string; dateFaite: string | null; le: string }[];
  termines: { pasAPas: { id: string; titre: string }; le: string; depuisRappel: boolean }[];
}

/** Historique d'entretien d'un client : réponses aux rappels (avec la date indiquée) et pas-à-pas terminés. */
function Entretien({ userId }: { userId: string }) {
  const [h, setH] = useState<HistoriqueEntretien>();
  useEffect(() => {
    api<HistoriqueEntretien>(`/admin/annonces/entretien/${userId}`).then(setH).catch(() => {});
  }, [userId]);
  if (!h || (!h.reponses.length && !h.termines.length)) return null;
  // une seule liste, la plus récente en haut
  const lignes = [
    ...h.reponses.map((r) => ({
      le: r.le,
      texte: <>{r.question || r.message} <b>{r.valeur === 'oui' ? 'Oui' : r.valeur === 'non' ? 'Non' : r.valeur}</b>{r.dateFaite && <> · 📅 fait le {date(r.dateFaite)}</>}</>,
    })),
    ...h.termines.map((t) => ({ le: t.le, texte: <>✅ Pas-à-pas terminé : <b>{t.pasAPas.titre}</b></> })),
  ].sort((a, b) => b.le.localeCompare(a.le));
  return (
    <details className="petit" open>
      <summary><b>🔧 Entretien</b> ({lignes.length})</summary>
      <ul className="historique-entretien">
        {lignes.slice(0, 30).map((l, i) => <li key={i}><span className="muted">{date(l.le)}</span> · {l.texte}</li>)}
      </ul>
    </details>
  );
}

interface Demande { id: string; message: string; traitee: boolean; createdAt: string; user: { identifiant: string; nom: string | null }; fiche: { id: string; titre: string } }

/** Bouton « Demander de l'aide à Lazzeko » : masqué par défaut, activable ici ; liste des demandes reçues. */
function AideSupport() {
  const [actif, setActif] = useState<boolean>();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const charger = () => {
    api<{ aideSupport: boolean }>('/parametres').then((p) => setActif(p.aideSupport));
    api<Demande[]>('/admin/aide?traitee=non').then(setDemandes);
  };
  useEffect(charger, []);
  return (
    <>
      <div className="carte">
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={!!actif}
            onChange={async (e) => {
              const v = e.target.checked;
              setActif(v); // affichage immédiat
              await api('/admin/parametres', { method: 'PATCH', json: { aideSupport: v } }).catch(() => setActif(!v));
            }}
          />
          <span>Afficher le bouton « Demander de l'aide à Lazzeko » sur les fiches</span>
        </label>
        <p className="muted petit">Désactivé par défaut. Chaque demande est aussi envoyée aux adresses configurées dans « Envoi vers une API » (événement « Demande d'aide »).</p>
        {demandes.length === 0 ? (
          <p className="muted petit">Aucune demande en cours.</p>
        ) : (
          demandes.map((d) => (
            <div key={d.id} className="sous-bloc">
              <div className="avis-h">
                <span className="petit"><b>{d.user.nom || d.user.identifiant}</b> sur <Link to={`/fiches/${d.fiche.id}`}>{d.fiche.titre}</Link> · {date(d.createdAt)}</span>
                <button type="button" className="btn petit" onClick={async () => { await api(`/admin/aide/${d.id}`, { method: 'PATCH', json: { traitee: true } }); charger(); }}>Traitée</button>
              </div>
              <p className="mon-texte petit" style={{ margin: '4px 0 0' }}>{d.message}</p>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/** Texte des conditions d'utilisation : publier une nouvelle version oblige chacun à les accepter de nouveau. */
function ConditionsAdmin() {
  const { espace: ouvert0, espaces } = useEspace();
  const [esp, setEsp] = useState(ouvert0.slug);
  const [c, setC] = useState<{ version: number; texte: string }>();
  const [texte, setTexte] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [ok, setOk] = useState('');
  useEffect(() => {
    setOuvert(false);
    setOk('');
    api<{ version: number; texte: string }>(`/conditions?espace=${esp}`).then((x) => { setC(x); setTexte(x.texte); });
  }, [esp]);
  if (!c) return null;
  return (
    <>
      <div className="seg" style={{ marginBottom: 8 }}>
        {espaces.map((e) => (
          <button key={e.slug} type="button" className={e.slug === esp ? 'on' : ''} onClick={() => setEsp(e.slug)}>{e.nom}</button>
        ))}
      </div>
      <div className="carte">
        <p className="petit" style={{ marginTop: 0 }}>Version en vigueur : <b>{c.version}</b>. Texte de départ à faire relire par un juriste.</p>
        {!ouvert ? (
          <button type="button" className="btn petit" onClick={() => setOuvert(true)}>Modifier le texte</button>
        ) : (
          <div className="form">
            <textarea rows={14} value={texte} onChange={(e) => setTexte(e.target.value)} />
            <div className="actions-avis">
              <button type="button" className="btn petit" onClick={() => { setOuvert(false); setTexte(c.texte); }}>Annuler</button>
              <button
                type="button"
                className="btn prim"
                disabled={texte.trim().length < 20 || texte === c.texte}
                onClick={async () => {
                  if (!confirm(`Publier une nouvelle version pour ${espaces.find((e) => e.slug === esp)?.nom} ? Chaque utilisateur de cet espace devra l'accepter à sa prochaine utilisation.`)) return;
                  const n = await api<{ version: number; texte: string }>('/admin/conditions', { method: 'POST', json: { espace: esp, texte } });
                  setC(n); setOuvert(false); setOk(`Version ${n.version} publiée.`);
                }}
              >
                Publier une nouvelle version
              </button>
            </div>
          </div>
        )}
        {ok && <div className="succes">{ok}</div>}
      </div>
    </>
  );
}

/** N° client Odoo d'un compte, modifiable en ligne. */
function NumeroOdoo({ u, onMaj }: { u: { id: string; numeroOdoo: string | null }; onMaj: () => void }) {
  const [v, setV] = useState(u.numeroOdoo ?? '');
  const [ok, setOk] = useState(false);
  return (
    <div className="ba-libre" style={{ margin: '6px 0' }}>
      <input value={v} maxLength={40} placeholder="N° client Odoo" onChange={(e) => { setV(e.target.value); setOk(false); }} />
      <button
        type="button"
        className="btn petit"
        disabled={v.trim() === (u.numeroOdoo ?? '')}
        onClick={async () => { await api(`/users/${u.id}`, { method: 'PATCH', json: { numeroOdoo: v.trim() || null } }); setOk(true); onMaj(); }}
      >
        {ok ? '✓' : 'Enregistrer'}
      </button>
    </div>
  );
}

/** Cases à cocher des modules, groupées par espace (Lazzeko, Kiavik). */
function CasesModules({ valeur, onChange }: { valeur: string[]; onChange: (modules: string[]) => void }) {
  const { espaces } = useEspace();
  const basculer = (m: string, oui: boolean) => onChange(oui ? [...valeur, m] : valeur.filter((x) => x !== m));
  return (
    <div className="cases-modules">
      {espaces.map((e) => (
        <fieldset key={e.slug}>
          <legend style={{ color: e.couleur }}>{e.nom}</legend>
          {e.modules.map((m) => (
            <label key={m.slug}>
              <input type="checkbox" checked={valeur.includes(m.slug)} onChange={(x) => basculer(m.slug, x.target.checked)} />
              {m.nom}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

/** Demandes de mot de passe en attente (compteur) et notifications sur ce téléphone. */
function Notifications() {
  const [abonne, setAbonne] = useState(false);
  const [info, setInfo] = useState('');
  useEffect(() => {
    abonnementActuel().then((a) => setAbonne(!!a));
  }, []);
  return (
    <div className="bandeau">
        <span>
          <b>🔔 Notifications sur ce téléphone</b> : {abonne ? 'activées' : 'pour être prévenu des demandes'}
          {info && <><br /><small>{info}</small></>}
        </span>
        {abonne ? (
          <button type="button" className="btn petit" onClick={async () => { await desactiverNotifications(); setAbonne(false); setInfo('Notifications désactivées sur ce téléphone.'); }}>Désactiver</button>
        ) : (
          <button
            type="button"
            className="btn petit prim"
            onClick={async () => {
              try {
                const r = await activerNotifications();
                setAbonne(true);
                setInfo(`Activées : notification d'essai envoyée (${r.telephones} téléphone(s)).`);
              } catch (e) {
                setInfo((e as Error).message);
              }
            }}
          >
            Activer
          </button>
        )}
      </div>
  );
}
