import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Erreur } from '../components/Composants';
import { api, Fabricant, MaMachine } from '../lib/api';
import { date } from '../lib/util';

interface U { id: string; identifiant: string; nom: string | null; role: 'ADMIN' | 'USER'; actif: boolean; createdAt: string; _count?: { fiches: number } }
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
  const [f, setF] = useState({ identifiant: '', motDePasse: '', nom: '', role: 'USER' });

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
      await api('/users', { method: 'POST', json: { ...f, nom: f.nom || undefined } });
      setF({ identifiant: '', motDePasse: '', nom: '', role: 'USER' });
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
      <Link to="/admin/fiches" className="bandeau lien-bandeau">
        <span><b>Toutes les fiches</b> : voir qui les a faites, masquer</span>
        <span>›</span>
      </Link>
      <Link to="/admin/avis" className="bandeau lien-bandeau">
        <span><b>Avis</b> : masquer ceux qui ne conviennent pas</span>
        <span>›</span>
      </Link>
      <Link to="/admin/webhooks" className="bandeau lien-bandeau">
        <span><b>Envoi vers une API</b> : fiches et avis (modération IA)</span>
        <span>›</span>
      </Link>

      <h2>Créer un utilisateur</h2>
      <form className="form" onSubmit={creerUser}>
        <label>Identifiant<input value={f.identifiant} autoCapitalize="none" onChange={(e) => setF({ ...f, identifiant: e.target.value })} required /></label>
        <label>Mot de passe (8 min.)<input value={f.motDePasse} minLength={8} onChange={(e) => setF({ ...f, motDePasse: e.target.value })} required /></label>
        <label>Nom<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></label>
        <label>Rôle
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="USER">Utilisateur</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <button className="btn prim">Créer</button>
      </form>

      <h2>Utilisateurs ({users.length})</h2>
      <div className="liste">
        {users.map((u) => (
          <div key={u.id} className={'carte ligne-machine' + (u.actif ? '' : ' inactif')}>
            <button type="button" className="lien-bloc" onClick={() => setSelection(selection?.id === u.id ? null : u)}>
              <b>{u.nom || u.identifiant}</b> <span className="muted petit">{u.identifiant} · {u.role === 'ADMIN' ? 'admin' : 'utilisateur'} · {date(u.createdAt)}</span>
            </button>
            <button type="button" className="btn petit" onClick={() => basculerActif(u)}>{u.actif ? 'Désactiver' : 'Réactiver'}</button>
            {selection?.id === u.id && (
              <div className="sous-bloc">
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
