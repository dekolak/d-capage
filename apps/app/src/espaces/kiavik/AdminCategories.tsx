import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { Categorie, viderCategories, viderProcedures, viderSolutions } from './donneesProcedures';
import { normaliser } from './recherche';
import './guides.css';
import './categories.css';
import { BadgeZone } from '../../pages/Admin';

/* Administration → Accueil et catégories (admin, en français) : tout le classement de l'accueil au même endroit. */

type Type = 'procedure' | 'astuce' | 'animation';
interface Element {
  type: Type; id: string; guide?: string; titre: string; categorie: string; publiee: boolean; diagnostic?: boolean; logiciels: string[];
}
const cleDe = (e: Element) => `${e.type}:${e.guide ?? ''}:${e.id}`;
const TYPES: Record<string, string> = { procedure: '📋 Pas-à-pas', diagnostic: '🩺 Dépannage guidé', astuce: '💡 Bon à savoir', animation: '▶ Démo animée' };
const typeDe = (e: Element) => (e.type === 'procedure' && e.diagnostic ? 'diagnostic' : e.type);
const lienDe = (e: Element) =>
  e.type === 'procedure' ? `/admin/procedures/${e.id}` : e.type === 'astuce' ? `/admin/solutions/${e.id}` : `/guides/${e.guide}/animation/${e.id}`;
const ICONES = ['📁', '🚀', '🩺', '🖨️', '🎛️', '🧽', '⚪', '🎨', '🔧', '⚙️', '💧', '🧪', '📐', '🛠️', '⚠️', '📦', '🧰', '💡'];

export function AdminCategories() {
  const [cats, setCats] = useState<Categorie[]>();
  const [elements, setElements] = useState<Element[]>();
  const [erreur, setErreur] = useState<unknown>();
  // filtres
  const [fCat, setFCat] = useState('');
  const [fType, setFType] = useState('');
  const [fLog, setFLog] = useState('');
  const [fEtat, setFEtat] = useState('');
  const [q, setQ] = useState('');
  const [coches, setCoches] = useState<string[]>([]);
  const [vers, setVers] = useState('');
  const [nouvelle, setNouvelle] = useState({ nom: '', icone: '📁' });

  const recharger = async () => {
    viderCategories();
    viderProcedures();
    viderSolutions();
    const [c, e] = await Promise.all([api<Categorie[]>('/categories'), api<Element[]>('/admin/categories/elements')]);
    setCats(c);
    setElements(e);
  };
  useEffect(() => {
    recharger().catch(setErreur);
  }, []);
  /** Action puis rechargement de tout (les renommages déplacent le contenu). */
  const faire = async (chemin: string, opts: RequestInit & { json?: unknown }) => {
    setErreur(undefined);
    try {
      await api(chemin, opts);
      await recharger();
      return true;
    } catch (e) {
      setErreur(e);
      return false;
    }
  };

  const logiciels = useMemo(() => [...new Set((elements ?? []).flatMap((e) => e.logiciels))].sort(), [elements]);
  const visibles = useMemo(() => {
    const mots = normaliser(q).split(' ').filter(Boolean);
    return (elements ?? []).filter(
      (e) =>
        (!fCat || (fCat === '∅' ? !cats?.some((c) => c.nom === e.categorie) : e.categorie === fCat)) &&
        (!fType || typeDe(e) === fType) &&
        (!fLog || e.logiciels.includes(fLog)) &&
        (!fEtat || (fEtat === 'publiee') === e.publiee) &&
        mots.every((w) => normaliser(e.titre).includes(w)),
    );
  }, [elements, cats, fCat, fType, fLog, fEtat, q]);

  if (!cats || !elements) return erreur ? <Erreur e={erreur} /> : <Chargement />;
  const compte = (nom: string) => elements.filter((e) => e.categorie === nom).length;
  const sansCategorie = elements.filter((e) => !cats.some((c) => c.nom === e.categorie));
  const ranger = (l: Element[], categorie: string) =>
    faire('/admin/categories/ranger', { method: 'POST', json: { categorie, elements: l.map((e) => ({ type: e.type, id: e.id, guide: e.guide })) } });
  const choisis = visibles.filter((e) => coches.includes(cleDe(e)));
  const tousCoches = visibles.length > 0 && choisis.length === visibles.length;

  return (
    <div className="page gx ca">
      <Link to="/admin" className="btn-lien">← Administration</Link>
      <h1>🏠 Accueil et catégories <BadgeZone zone="kiavik" /></h1>
      <p className="muted petit">
        Les sections de l'accueil Kiavik : nom, icône, ordre, masquées. Rangez ici les pas-à-pas, dépannages guidés, « Bon à savoir » et démos animées.
        Renommer une catégorie déplace tout son contenu.
      </p>
      <Erreur e={erreur} />

      <div className="ca-grille">
        <section className="carte ca-cats">
          <h4>Catégories <small className="muted">· ordre de l'accueil</small></h4>
          <ul>
            {cats.map((c, i) => (
              <LigneCategorie key={c.id} c={c} n={compte(c.nom)} premier={i === 0} dernier={i === cats.length - 1} autres={cats.filter((x) => x.id !== c.id)}
                actif={fCat === c.nom} filtrer={() => setFCat(fCat === c.nom ? '' : c.nom)} faire={faire} />
            ))}
          </ul>
          {sansCategorie.length > 0 && (
            <button type="button" className={`btn petit ca-sans ${fCat === '∅' ? 'choisi' : ''}`} onClick={() => setFCat(fCat === '∅' ? '' : '∅')}>
              ⚠️ {sansCategorie.length} élément(s) dans une catégorie inconnue
            </button>
          )}
          <div className="ca-ajout">
            <select value={nouvelle.icone} aria-label="Icône" onChange={(e) => setNouvelle({ ...nouvelle, icone: e.target.value })}>
              {ICONES.map((x) => <option key={x}>{x}</option>)}
            </select>
            <input type="text" value={nouvelle.nom} maxLength={40} placeholder="Nouvelle catégorie" onChange={(e) => setNouvelle({ ...nouvelle, nom: e.target.value })} />
            <button type="button" className="btn prim petit" disabled={nouvelle.nom.trim().length < 2}
              onClick={() => faire('/admin/categories', { method: 'POST', json: { nom: nouvelle.nom.trim(), icone: nouvelle.icone } }).then((ok) => ok && setNouvelle({ nom: '', icone: '📁' }))}>
              + Ajouter
            </button>
          </div>
        </section>

        <section className="carte ca-elements">
          <div className="ca-filtres">
            <input type="search" value={q} placeholder="Rechercher un titre…" onChange={(e) => setQ(e.target.value)} />
            <select value={fCat} aria-label="Catégorie" onChange={(e) => setFCat(e.target.value)}>
              <option value="">Toutes les catégories</option>
              {cats.map((c) => <option key={c.id} value={c.nom}>{c.icone} {c.nom}</option>)}
              {sansCategorie.length > 0 && <option value="∅">⚠️ Catégorie inconnue</option>}
            </select>
            <select value={fType} aria-label="Type" onChange={(e) => setFType(e.target.value)}>
              <option value="">Tous les types</option>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {logiciels.length > 0 && (
              <select value={fLog} aria-label="Logiciel" onChange={(e) => setFLog(e.target.value)}>
                <option value="">Tous les logiciels</option>
                {logiciels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            <select value={fEtat} aria-label="État" onChange={(e) => setFEtat(e.target.value)}>
              <option value="">Publiés et non publiés</option>
              <option value="publiee">Publiés</option>
              <option value="brouillon">Non publiés</option>
            </select>
          </div>

          <div className="ca-lot">
            <label><input type="checkbox" checked={tousCoches} onChange={() => setCoches(tousCoches ? [] : visibles.map(cleDe))} /> {visibles.length} élément(s)</label>
            {choisis.length > 0 && (
              <span>
                Ranger les {choisis.length} cochés dans
                <select value={vers} onChange={(e) => setVers(e.target.value)}>
                  <option value="">—</option>
                  {cats.map((c) => <option key={c.id} value={c.nom}>{c.icone} {c.nom}</option>)}
                </select>
                <button type="button" className="btn prim petit" disabled={!vers} onClick={() => ranger(choisis, vers).then((ok) => ok && setCoches([]))}>OK</button>
              </span>
            )}
          </div>

          <ul className="ca-liste">
            {visibles.map((e) => (
              <li key={cleDe(e)} className={coches.includes(cleDe(e)) ? 'coche' : ''}>
                <input type="checkbox" aria-label="Cocher" checked={coches.includes(cleDe(e))}
                  onChange={() => setCoches((l) => (l.includes(cleDe(e)) ? l.filter((x) => x !== cleDe(e)) : [...l, cleDe(e)]))} />
                <span className="ca-titre">
                  <Link to={lienDe(e)}>{e.titre}</Link>
                  <small className="muted">
                    {TYPES[typeDe(e)]}
                    {e.logiciels.length > 0 && ` · ${e.logiciels.join(', ')}`}
                    {e.publiee ? '' : <span className="gx-brouillon">🔒 non publiée</span>}
                  </small>
                </span>
                <select value={e.categorie} aria-label="Catégorie" onChange={(ev) => ranger([e], ev.target.value)}>
                  {!cats.some((c) => c.nom === e.categorie) && <option value={e.categorie}>⚠️ {e.categorie || '(aucune)'}</option>}
                  {cats.map((c) => <option key={c.id} value={c.nom}>{c.icone} {c.nom}</option>)}
                </select>
              </li>
            ))}
            {!visibles.length && <li className="muted">Rien avec ces filtres.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Une catégorie : renommer, icône, ordre, masquer, supprimer (en déplaçant son contenu). */
function LigneCategorie({ c, n, premier, dernier, autres, actif, filtrer, faire }: {
  c: Categorie; n: number; premier: boolean; dernier: boolean; autres: Categorie[]; actif: boolean; filtrer: () => void;
  faire: (chemin: string, opts: RequestInit & { json?: unknown }) => Promise<boolean>;
}) {
  const [edition, setEdition] = useState(false);
  const [nom, setNom] = useState(c.nom);
  const [suppr, setSuppr] = useState(false);
  const [vers, setVers] = useState('');
  const url = `/admin/categories/${c.id}`;
  if (edition)
    return (
      <li className="ca-cat edition">
        <select value={c.icone} aria-label="Icône" onChange={(e) => faire(url, { method: 'PATCH', json: { icone: e.target.value } })}>
          {[...new Set([c.icone, ...ICONES])].map((x) => <option key={x}>{x}</option>)}
        </select>
        <input type="text" value={nom} maxLength={40} onChange={(e) => setNom(e.target.value)} />
        <button type="button" className="btn prim petit" disabled={nom.trim().length < 2}
          onClick={() => (nom.trim() === c.nom ? Promise.resolve(true) : faire(url, { method: 'PATCH', json: { nom: nom.trim() } })).then((ok) => ok && setEdition(false))}>
          OK
        </button>
        <button type="button" className="btn petit" onClick={() => { setNom(c.nom); setEdition(false); }}>Annuler</button>
        {n > 0 && nom.trim() !== c.nom && <small className="muted">Ses {n} élément(s) suivront.</small>}
      </li>
    );
  return (
    <li className={`ca-cat ${actif ? 'actif' : ''} ${c.masquee ? 'masquee' : ''}`}>
      <button type="button" className="ca-nom" onClick={filtrer} title="Voir son contenu">
        <span aria-hidden="true">{c.icone}</span> <b>{c.nom}</b> <small className="muted">{n}</small>
        {c.masquee && <small className="gx-brouillon">masquée</small>}
      </button>
      <span className="ca-actions">
        <button type="button" className="btn petit" aria-label="Monter" disabled={premier} onClick={() => faire(`${url}/deplacer`, { method: 'POST', json: { sens: -1 } })}>↑</button>
        <button type="button" className="btn petit" aria-label="Descendre" disabled={dernier} onClick={() => faire(`${url}/deplacer`, { method: 'POST', json: { sens: 1 } })}>↓</button>
        <button type="button" className="btn petit" title="Renommer, icône" onClick={() => setEdition(true)}>✏️</button>
        <button type="button" className="btn petit" title={c.masquee ? 'Afficher sur l\'accueil' : 'Masquer de l\'accueil'}
          onClick={() => faire(url, { method: 'PATCH', json: { masquee: !c.masquee } })}>{c.masquee ? '🙈' : '👁'}</button>
        <button type="button" className="btn petit" title="Supprimer"
          onClick={() => (n ? setSuppr(!suppr) : confirm(`Supprimer la catégorie « ${c.nom} » ?`) && faire(url, { method: 'DELETE' }))}>🗑</button>
      </span>
      {suppr && (
        <span className="ca-suppr">
          Ses {n} élément(s) vont dans
          <select value={vers} onChange={(e) => setVers(e.target.value)}>
            <option value="">—</option>
            {autres.map((x) => <option key={x.id} value={x.id}>{x.icone} {x.nom}</option>)}
          </select>
          <button type="button" className="btn petit" disabled={!vers} onClick={() => faire(`${url}?vers=${encodeURIComponent(vers)}`, { method: 'DELETE' })}>Supprimer</button>
        </span>
      )}
    </li>
  );
}
