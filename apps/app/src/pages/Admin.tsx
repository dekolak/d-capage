import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Erreur } from '../components/Composants';
import { api, Fabricant, MaMachine } from '../lib/api';
import { useEspace } from '../lib/espace';
import { LANGUES, NOMS_LANGUES } from '../lib/i18n';
import { date } from '../lib/util';

interface U { id: string; identifiant: string; nom: string | null; role: 'ADMIN' | 'USER'; actif: boolean; createdAt: string; _count?: { fiches: number }; modules: string[]; espaces: string[]; conditions: Record<string, { version: number }>; accordPhotosMarketing: boolean; clientLazzeko: boolean; numeroOdoo: string | null; langue: string | null }
interface Cle { id: string; nom: string; prefixe: string; derniereUtilisation: string | null; revoqueeLe: string | null; createdAt: string }
interface TagAValider { id: string; nom: string; groupe: { nom: string } }

export default function Admin() {
  const [users, setUsers] = useState<U[]>([]);
  const [cles, setCles] = useState<Cle[]>([]);
  const [tags, setTags] = useState<TagAValider[]>([]);
  const [catalogue, setCatalogue] = useState<Fabricant[]>([]);
  const [nouvelleCle, setNouvelleCle] = useState('');
  const [selection, setSelection] = useState<U | null>(null);
  const [machinesSel, setMachinesSel] = useState<MaMachine[]>([]);
  const [err, setErr] = useState<unknown>();
  const { espace: espaceOuvert, espaces } = useEspace();
  const vide = () => ({ identifiant: '', motDePasse: '', nom: '', role: 'USER', clientLazzeko: true, numeroOdoo: '', modules: espaceOuvert.modules.slice(0, 1).map((m) => m.slug) });
  const [f, setF] = useState(vide);
  const [recherche, setRecherche] = useState('');
  const [filtreEspace, setFiltreEspace] = useState('');
  const lazzeko = (modules: string[]) => modules.includes('reglages-decapage');

  const charger = () =>
    Promise.all([api<U[]>('/users'), api<Cle[]>('/admin/cles-api'), api<TagAValider[]>('/tags/a-valider')])
      .then(([u, c, t]) => { setUsers(u); setCles(c); setTags(t); })
      .catch(setErr);
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

  const creerCle = async () => {
    const nom = prompt('Nom de la clé (ex. site web)')?.trim();
    if (!nom) return;
    const r = await api<{ cle: string }>('/admin/cles-api', { method: 'POST', json: { nom } }).catch((x) => { setErr(x); return null; });
    if (r) setNouvelleCle(r.cle);
    charger();
  };

  return (
    <div className="page">
      <h1>Administration</h1>
      <Erreur e={err} />
      <Link to="/admin/messages" className="bandeau lien-bandeau">
        <span><b>💬 Messages</b> : bulles d'info à l'ouverture de l'app</span>
        <span>›</span>
      </Link>
      <Link to="/admin/fiches" className="bandeau lien-bandeau">
        <span><b>Toutes les fiches</b> : voir qui les a faites, masquer</span>
        <span>›</span>
      </Link>
      <Link to="/admin/catalogue" className="bandeau lien-bandeau">
        <span><b>Machines</b> : miniatures (image PNG)</span>
        <span>›</span>
      </Link>
      <Link to="/admin/avis" className="bandeau lien-bandeau">
        <span><b>Avis</b> : masquer ceux qui ne conviennent pas</span>
        <span>›</span>
      </Link>
      {espaceOuvert.modules.some((m) => m.slug === 'procedures-kiavik') && (
        <Link to="/admin/procedures" className="bandeau lien-bandeau">
          <span><b>📋 Procédures</b> : créer, modifier, publier</span>
          <span>›</span>
        </Link>
      )}
      <Link to="/admin/webhooks" className="bandeau lien-bandeau">
        <span><b>Envoi vers une API</b> : fiches et avis (modération IA)</span>
        <span>›</span>
      </Link>

      <AideSupport />

      <ConditionsAdmin />

      <h2>Créer un utilisateur</h2>
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

      <h2>Clés API</h2>
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

      <h2>Tags proposés ({tags.length})</h2>
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
      <h2>Demandes d'aide</h2>
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
      <h2>Conditions d'utilisation</h2>
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
