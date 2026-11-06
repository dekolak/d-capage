import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chargement, Erreur, FiltreTags, ImageProtegee, NoteResume } from '../components/Composants';
import { api, Fiche, GroupeTag, PageFiches } from '../lib/api';
import { date } from '../lib/util';

interface U { id: string; identifiant: string; nom: string | null }

/** Admin : toutes les fiches, qui les a faites, et masquage (modération). */
export default function AdminFiches() {
  const [qs, setQs] = useSearchParams();
  const [users, setUsers] = useState<U[]>([]);
  const [groupes, setGroupes] = useState<GroupeTag[]>([]);
  const [data, setData] = useState<PageFiches>();
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [err, setErr] = useState<unknown>();
  const userId = qs.get('userId') ?? '';
  const etat = qs.get('masquee') ?? '';
  const photosOk = qs.get('photos') === 'oui';
  const changer = (k: string, v: string) => {
    const n = new URLSearchParams(qs);
    if (v) n.set(k, v);
    else n.delete(k);
    setQs(n, { replace: true });
  };

  useEffect(() => {
    Promise.all([api<U[]>('/users'), api<GroupeTag[]>('/tags')]).then(([u, g]) => { setUsers(u); setGroupes(g); }).catch(setErr);
  }, []);

  const charger = () => {
    const p = new URLSearchParams({ parPage: '50' });
    if (q.trim()) p.set('q', q.trim());
    if (tags.length) p.set('tags', tags.join(','));
    if (userId) p.set('userId', userId);
    if (etat) p.set('masquee', etat);
    if (photosOk) p.set('photosUtilisables', 'oui');
    return api<PageFiches>(`/admin/fiches?${p}`).then(setData).catch(setErr);
  };
  useEffect(() => {
    const h = setTimeout(charger, 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tags, userId, etat, photosOk]);

  const basculer = async (f: Fiche) => {
    if (!f.masquee && !confirm(`Masquer « ${f.titre} » ? Elle ne sera plus visible que par son auteur et les admins.`)) return;
    await api(`/admin/fiches/${f.id}`, { method: 'PATCH', json: { masquee: !f.masquee } }).catch(setErr);
    charger();
  };

  return (
    <div className="page">
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>Toutes les fiches</h1>
      <div className="filtres">
        <input className="recherche" placeholder="Rechercher (titre, commentaire)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="champ-tag">
          <span>Auteur</span>
          <select value={userId} onChange={(e) => changer('userId', e.target.value)}>
            <option value="">Tous</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.nom ? `${u.nom} (${u.identifiant})` : u.identifiant}</option>)}
          </select>
        </label>
        <div className="seg">
          <button type="button" className={photosOk ? 'on' : ''} onClick={() => changer('photos', photosOk ? '' : 'oui')}>📷 Photos utilisables</button>
          {[['', 'Toutes'], ['non', 'Visibles'], ['oui', 'Masquées']].map(([v, l]) => (
            <button key={v} type="button" className={etat === v ? 'on' : ''} onClick={() => changer('masquee', v)}>{l}</button>
          ))}
        </div>
        <FiltreTags groupes={groupes} tags={tags} onChange={setTags} />
      </div>
      <Erreur e={err} />
      {!data ? (
        <Chargement />
      ) : (
        <>
          <p className="muted petit">{data.total} fiche{data.total > 1 ? 's' : ''}</p>
          <div className="liste">
            {data.fiches.map((f) => {
              const photo = f.photos.find((p) => p.type === 'APRES') ?? f.photos[0];
              return (
                <div key={f.id} className={'carte-fiche admin' + (f.masquee ? ' masquee' : '')}>
                  <Link to={`/fiches/${f.id}`} className="cf-lien">
                    {photo ? <ImageProtegee id={photo.id} min className="vignette" /> : <div className="vignette vide">◎</div>}
                    <div className="cf-corps">
                      <b>{f.titre}</b>
                      <div className="petit"><b>{f.auteurAdmin?.nom || f.auteurAdmin?.identifiant}</b> <span className="muted">({f.auteurAdmin?.identifiant})</span></div>
                      <div className="muted petit">{f.machine.nom} · {date(f.createdAt)}</div>
                      <NoteResume moyenne={f.note.moyenne} nombre={f.note.nombre} />
                      {f.masquee && <span className="badge-masquee">Masquée</span>}
                      {f.accordPhotos && f.photos.length > 0 && <span className="badge-accord">📷 Photos utilisables</span>}
                    </div>
                  </Link>
                  <button type="button" className="btn petit" onClick={() => basculer(f)}>{f.masquee ? 'Réafficher' : 'Masquer'}</button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
