import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Erreur } from '../components/Composants';
import { api, Fabricant, MaMachine } from '../lib/api';
import { useEspace } from '../lib/espace';
import { LANGUES, NOMS_LANGUES } from '../lib/i18n';
import { abonnementActuel, activerNotifications, desactiverNotifications } from '../lib/notifications';
import { date } from '../lib/util';

interface U { id: string; identifiant: string; nom: string | null; role: 'ADMIN' | 'USER'; actif: boolean; createdAt: string; _count?: { fiches: number }; modules: string[]; espaces: string[]; conditions: Record<string, { version: number }>; accordPhotosMarketing: boolean; clientLazzeko: boolean; numeroOdoo: string | null; langue: string | null }
interface Cle { id: string; nom: string; prefixe: string; derniereUtilisation: string | null; revoqueeLe: string | null; createdAt: string }
interface TagAValider { id: string; nom: string; groupe: { nom: string } }

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
 * Administration : un menu court, rangé en sections Commun / Lazzeko / Kiavik (badge de couleur sur chaque entrée).
 * Ordre fixe Commun, Lazzeko, Kiavik, toutes repliables ; ouvrir une entrée d'un autre espace bascule dans cet espace.
 */
export default function Admin() {
  const { espace: ouvert, espaces, choisir } = useEspace();
  const nav = useNavigate();
  const [ouvertes, setOuvertes] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(CLE_SECTIONS) ?? '{}');
    } catch {
      return {};
    }
  });
  const [compte, setCompte] = useState<{ tags: number; aide: number; utilisateurs: number }>({ tags: 0, aide: 0, utilisateurs: 0 });
  useEffect(() => {
    Promise.all([
      api<TagAValider[]>('/tags/a-valider').catch(() => []),
      api<unknown[]>('/admin/aide?traitee=non').catch(() => []),
      api<U[]>('/users').catch(() => []),
    ]).then(([t, a, u]) => setCompte({ tags: t.length, aide: a.length, utilisateurs: u.length }));
  }, []);
  const entrees: Entree[] = [
    { zone: 'commun', to: '/admin/utilisateurs', titre: '👥 Utilisateurs', texte: `créer un compte, accès, machines, activité (${compte.utilisateurs})` },
    { zone: 'commun', to: '/admin/messages', titre: '💬 Messages', texte: "bulles d'info à l'ouverture de l'app" },
    { zone: 'commun', to: '/admin/conditions', titre: "📜 Conditions d'utilisation", texte: 'texte et version, par espace' },
    { zone: 'commun', to: '/admin/cles-api', titre: '🔑 Clés API', texte: 'créer des comptes depuis un autre système (Odoo, n8n)' },
    { zone: 'commun', to: '/admin/webhooks', titre: '📤 Envoi vers une API', texte: 'événements envoyés à n8n ou une IA' },
    { zone: 'lazzeko', to: '/admin/fiches', titre: '📝 Fiches de réglage', texte: 'voir qui les a faites, masquer' },
    { zone: 'lazzeko', to: '/admin/catalogue', titre: '🔧 Machines', texte: 'miniatures (image PNG)' },
    { zone: 'lazzeko', to: '/admin/avis', titre: '⭐ Avis', texte: 'masquer ceux qui ne conviennent pas' },
    { zone: 'lazzeko', to: '/admin/tags', titre: '🏷️ Tags proposés', texte: 'à valider', compte: compte.tags },
    { zone: 'lazzeko', to: '/admin/aide', titre: "🆘 Demandes d'aide", texte: 'bouton sur les fiches, demandes reçues', compte: compte.aide },
    { zone: 'kiavik', to: '/admin/categories', titre: "🏠 Accueil et catégories", texte: 'renommer, ajouter, ordonner, ranger', module: 'procedures-kiavik' },
    { zone: 'kiavik', to: '/admin/procedures', titre: '📋 Pas-à-pas', texte: 'créer, modifier, publier', module: 'procedures-kiavik' },
    { zone: 'kiavik', to: '/admin/diagnostics', titre: '🩺 Dépannages reçus', texte: 'résultats envoyés par les clients', module: 'procedures-kiavik' },
    { zone: 'kiavik', to: '/admin/solutions', titre: '💡 Bon à savoir', texte: 'problèmes déjà résolus, astuces', module: 'procedures-kiavik' },
  ].filter((e) => !e.module || espaces.some((x) => x.slug === e.zone && x.modules.some((m) => m.slug === e.module)));
  // ordre fixe : Commun, puis les espaces (Lazzeko, Kiavik) ; toutes repliables, ouvertes/fermées gardées sur ce téléphone
  const zones = ['commun', ...espaces.map((e) => e.slug)].filter((z) => entrees.some((e) => e.zone === z));
  const nomZone = (z: Zone) => espaces.find((e) => e.slug === z)?.nom ?? 'Commun';
  const ouvrir = (e: Entree) => {
    if (e.zone !== 'commun' && e.zone !== ouvert.slug) choisir(e.zone);
    nav(e.to);
  };
  const estOuverte = (z: Zone) => ouvertes[z] ?? z === ouvert.slug; // par défaut : la section de l'espace ouvert
  const basculer = (z: Zone, v: boolean) => {
    const n = { ...ouvertes, [z]: v };
    setOuvertes(n);
    localStorage.setItem(CLE_SECTIONS, JSON.stringify(n));
  };

  return (
    <div className="page adm">
      <h1>Administration</h1>
      <MotsDePasseEtNotifications />
      {zones.map((z) => {
        const n = entrees.filter((e) => e.zone === z).reduce((t, e) => t + (e.compte ?? 0), 0);
        return (
          <details key={z} className="adm-section" open={estOuverte(z)} onToggle={(ev) => basculer(z, (ev.target as HTMLDetailsElement).open)}>
            <summary>
              <h2>{nomZone(z)} <BadgeZone zone={z} />{n > 0 && <span className="badge-rouge">{n}</span>}</h2>
            </summary>
            <div className="adm-liste">
              {entrees.filter((e) => e.zone === z).map((e) => (
                <button key={e.to} type="button" className="bandeau lien-bandeau adm-entree" onClick={() => ouvrir(e)}>
                  <span><b>{e.titre}</b>{!!e.compte && <span className="badge-rouge">{e.compte}</span>} : {e.texte}</span>
                  <span>›</span>
                </button>
              ))}
            </div>
          </details>
        );
      })}
      <p className="muted petit">Une entrée d'un autre espace vous fait passer dans cet espace.</p>
    </div>
  );
}

/** Administration → Utilisateurs : créer un compte, liste, accès, machines. */
export function AdminUtilisateurs() {
  const [users, setUsers] = useState<U[]>([]);
  const [catalogue, setCatalogue] = useState<Fabricant[]>([]);
  const [selection, setSelection] = useState<U | null>(null);
  const [machinesSel, setMachinesSel] = useState<MaMachine[]>([]);
  const [err, setErr] = useState<unknown>();
  const { espace: espaceOuvert, espaces } = useEspace();
  const vide = () => ({ identifiant: '', motDePasse: '', nom: '', role: 'USER', clientLazzeko: true, numeroOdoo: '', modules: espaceOuvert.modules.slice(0, 1).map((m) => m.slug) });
  const [f, setF] = useState(vide);
  const [recherche, setRecherche] = useState('');
  const [filtreEspace, setFiltreEspace] = useState('');
  const lazzeko = (modules: string[]) => modules.includes('reglages-decapage');

  const charger = () => api<U[]>('/users').then(setUsers).catch(setErr);
  useEffect(() => {
    charger();
    api<Fabricant[]>('/catalogue').then(setCatalogue).catch(setErr);
  }, []);
  useEffect(() => {
    if (selection) api<MaMachine[]>(`/users/${selection.id}/machines`).then(setMachinesSel).catch(setErr);
  }, [selection]);

  const creerUser = async (e: FormEvent) => {
    e.preventDefault();
    setErr(undefined);
    try {
      await api('/users', { method: 'POST', json: { ...f, nom: f.nom || undefined, numeroOdoo: f.numeroOdoo.trim() || undefined, modules: f.role === 'ADMIN' ? [] : f.modules } });
      setF(vide());
      charger();
    } catch (x) { setErr(x); }
  };

  const basculerActif = async (u: U) => {
    await api(`/users/${u.id}`, { method: 'PATCH', json: { actif: !u.actif } }).catch(setErr);
    charger();
  };

  const attribuer = async (varianteId: string) => {
    if (!selection || !varianteId) return;
    await api(`/users/${selection.id}/machines`, { method: 'POST', json: { varianteId } }).catch(setErr);
    setMachinesSel(await api<MaMachine[]>(`/users/${selection.id}/machines`));
  };

  return (
    <div className="page">
      <EnteteAdmin titre="Utilisateurs" zone="commun" />
      <Erreur e={err} />
      <details className="carte adm-creer">
        <summary><b>+ Créer un utilisateur</b></summary>
      <form className="form" onSubmit={creerUser}>
        <label>Identifiant<input value={f.identifiant} autoCapitalize="none" onChange={(e) => setF({ ...f, identifiant: e.target.value })} required /></label>
        <label>Mot de passe (8 min.)<input value={f.motDePasse} minLength={8} onChange={(e) => setF({ ...f, motDePasse: e.target.value })} required /></label>
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
        {f.role === 'USER' && lazzeko(f.modules) && (
          <label className="interrupteur">
            <input type="checkbox" checked={f.clientLazzeko} onChange={(e) => setF({ ...f, clientLazzeko: e.target.checked })} />
            <span>Client Lazzeko <small className="muted">(décocher pour un utilisateur d'une autre marque)</small></span>
          </label>
        )}
        <button className="btn prim">Créer</button>
      </form>
      </details>

      <h2>Utilisateurs ({users.length})</h2>
      <input className="recherche" placeholder="Rechercher (identifiant, nom, n° Odoo)…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <select value={filtreEspace} onChange={(e) => setFiltreEspace(e.target.value)} style={{ marginBottom: 10 }}>
        <option value="">Tous les espaces</option>
        {espaces.map((e) => <option key={e.slug} value={e.slug}>{e.nom}</option>)}
      </select>
      <div className="liste">
        {users.filter((u) => {
          const q = recherche.trim().toLowerCase();
          if (filtreEspace && !u.espaces.includes(filtreEspace)) return false;
          return !q || [u.identifiant, u.nom ?? '', u.numeroOdoo ?? ''].some((x) => x.toLowerCase().includes(q));
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
              {u.role !== 'ADMIN' && lazzeko(u.modules) && <span className={'badge-client' + (u.clientLazzeko ? '' : ' autre')}>{u.clientLazzeko ? 'Client Lazzeko' : 'Autre marque'}</span>}
              {u.numeroOdoo && <span className="badge-odoo">Odoo {u.numeroOdoo}</span>}
            </button>
            <button type="button" className="btn petit" onClick={() => basculerActif(u)}>{u.actif ? 'Désactiver' : 'Réactiver'}</button>
            {selection?.id === u.id && (
              <div className="sous-bloc">
                <NumeroOdoo u={u} onMaj={charger} />
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
                {u.role !== 'ADMIN' && lazzeko(u.modules) && (
                  <label className="interrupteur petit">
                    <input type="checkbox" checked={u.clientLazzeko} onChange={async (e) => { await api(`/users/${u.id}`, { method: 'PATCH', json: { clientLazzeko: e.target.checked } }); charger(); }} />
                    Client Lazzeko
                  </label>
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
                {lazzeko(u.modules) && <>
                <Link to={`/admin/fiches?userId=${u.id}`} className="lien">Voir ses fiches ({u._count?.fiches ?? 0}) ›</Link>
                <br />
                <b>Machines</b>
                <ul>{machinesSel.map((m) => <li key={m.id}>{m.surnom ? `${m.surnom} · ` : ''}{m.nom}</li>)}</ul>
                <select value="" onChange={(e) => attribuer(e.target.value)}>
                  <option value="">+ Attribuer une machine…</option>
                  {catalogue.flatMap((fa) => fa.modeles.flatMap((mo) => mo.variantes.map((v) => (
                    <option key={v.id} value={v.id}>{`${fa.nom} ${mo.nom} ${v.nom}`}</option>
                  ))))}
                </select>
                </>}
              </div>
            )}
          </div>
        ))}
      </div>

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
export function AdminTags() {
  const [tags, setTags] = useState<TagAValider[]>([]);
  const [err, setErr] = useState<unknown>();
  const charger = () => api<TagAValider[]>('/tags/a-valider').then(setTags).catch(setErr);
  useEffect(() => {
    charger();
  }, []);
  return (
    <div className="page">
      <EnteteAdmin titre="Tags proposés" zone="lazzeko" />
      <Erreur e={err} />
      {!tags.length && <p className="muted">Aucun tag à valider.</p>}
      <div className="liste">
        {tags.map((t) => (
          <div key={t.id} className="carte ligne-machine">
            <div>{t.nom} <span className="muted petit">({t.groupe.nom})</span></div>
            <button type="button" className="btn petit prim" onClick={async () => { await api(`/tags/${t.id}`, { method: 'PATCH', json: { valide: true } }); charger(); }}>
              Valider
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

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
function MotsDePasseEtNotifications() {
  const [attente, setAttente] = useState(0);
  const [abonne, setAbonne] = useState<boolean | null>(null);
  const [info, setInfo] = useState('');
  useEffect(() => {
    api<{ enAttente: number }>('/admin/mots-de-passe').then((r) => setAttente(r.enAttente)).catch(() => {});
    abonnementActuel().then((a) => setAbonne(!!a));
  }, []);
  return (
    <>
      <Link to="/admin/mots-de-passe" className="bandeau lien-bandeau">
        <span><b>🔐 Mots de passe oubliés</b>{attente > 0 && <span className="badge-rouge">{attente}</span>} : donner un code au client</span>
        <span>›</span>
      </Link>
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
    </>
  );
}
