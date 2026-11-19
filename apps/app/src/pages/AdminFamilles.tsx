import { useEffect, useState } from 'react';
import { Chargement, Erreur } from '../components/Composants';
import { api, GroupeTag } from '../lib/api';
import { EnteteAdmin } from './Admin';

/* Admin (en français) : familles (listes courtes) et précisions libres des clients, par groupe (Matériau, À enlever, Application). */

interface PrecisionAdmin { texte: string; nb: number; variantes: string[]; familles: { nom: string; nb: number }[] }
interface GroupePrecisions { id: string; nom: string; slug: string; precisions: PrecisionAdmin[] }

export default function AdminFamilles() {
  const [groupes, setGroupes] = useState<GroupeTag[]>();
  const [precisions, setPrecisions] = useState<GroupePrecisions[]>([]);
  const [err, setErr] = useState<unknown>();
  const [q, setQ] = useState('');
  const charger = async () => {
    const [g, p] = await Promise.all([api<GroupeTag[]>('/tags'), api<GroupePrecisions[]>('/admin/precisions')]);
    setGroupes(g);
    setPrecisions(p);
  };
  useEffect(() => {
    charger().catch(setErr);
  }, []);
  const faire = async (f: () => Promise<unknown>) => {
    setErr(undefined);
    try {
      await f();
      await charger();
    } catch (e) {
      setErr(e);
    }
  };
  if (!groupes) return err ? <Erreur e={err} /> : <Chargement />;
  const mots = q.trim().toLowerCase();

  return (
    <div className="page af">
      <EnteteAdmin titre="🏷️ Familles et précisions" zone="lazzeko" />
      <p className="muted petit">
        Les <b>familles</b> sont des listes courtes que vous gérez (le client choisit dedans). Le client peut ajouter une <b>précision</b> libre
        (ex. Aluminium → « 6082 brossé ») : affichée sur la fiche et trouvée par la recherche, sans grossir la liste.
        Corrigez ou fusionnez les précisions mal écrites ; faites-en une famille seulement si elle revient très souvent.
      </p>
      <input className="recherche" type="search" value={q} placeholder="Rechercher une précision…" onChange={(e) => setQ(e.target.value)} />
      <Erreur e={err} />
      {groupes.map((g) => {
        const liste = (precisions.find((x) => x.id === g.id)?.precisions ?? []).filter(
          (p) => !mots || p.variantes.some((v) => v.toLowerCase().includes(mots)),
        );
        return (
          <section key={g.id} className="carte af-groupe">
            <h2>
              {g.nom} <small className="muted">· {g.univers?.length ? g.univers.map((u) => (u === 'soudure' ? 'Soudure' : 'Décapage')).join(', ') : 'tous les métiers'} · {g.choixUnique ? 'un seul choix par fiche' : 'plusieurs choix possibles'}</small>
            </h2>
            <b className="petit">Familles</b>
            <div className="puces">
              {g.tags.map((t) => (
                <button key={t.id} type="button" className="puce" title="Renommer"
                  onClick={() => {
                    const nom = prompt(`Renommer « ${t.nom} »`, t.nom)?.trim();
                    if (nom && nom !== t.nom) faire(() => api(`/tags/${t.id}`, { method: 'PATCH', json: { nom } }));
                  }}>
                  {t.nom} ✏️
                </button>
              ))}
              <button type="button" className="puce ajout"
                onClick={() => {
                  const nom = prompt(`Nouvelle famille dans « ${g.nom} »`)?.trim();
                  if (nom && nom.length >= 2) faire(() => api('/tags', { method: 'POST', json: { groupeId: g.id, nom } }));
                }}>
                + Nouvelle famille
              </button>
            </div>

            <b className="petit">Précisions des clients {liste.length ? `(${liste.length})` : ''}</b>
            {!liste.length && <p className="muted petit">{mots ? 'Aucune précision ne correspond.' : 'Aucune précision pour l\'instant.'}</p>}
            <ul className="af-liste">
              {liste.map((p) => (
                <li key={p.texte}>
                  <span className="af-texte">
                    <span><b>{p.texte}</b> <span className="muted petit">· {p.nb} fiche{p.nb > 1 ? 's' : ''}</span></span>
                    <small className="muted">
                      {p.familles.map((f) => `${f.nom} (${f.nb})`).join(', ') || 'sans famille'}
                      {p.variantes.length > 1 && ` · écrit aussi : ${p.variantes.filter((v) => v !== p.texte).join(', ')}`}
                    </small>
                  </span>
                  <span className="af-actions">
                    <button type="button" className="btn petit"
                      onClick={() => {
                        const vers = prompt('Corriger (ou écrire une précision existante pour fusionner)', p.texte)?.trim();
                        if (vers && vers !== p.texte) faire(() => api('/admin/precisions/corriger', { method: 'POST', json: { groupeId: g.id, de: p.texte, vers } }));
                      }}>
                      ✏️ Corriger / fusionner
                    </button>
                    <button type="button" className="btn petit"
                      onClick={() => {
                        const nom = prompt(`Nouvelle famille dans « ${g.nom} » (les ${p.nb} fiche(s) y seront rangées)`, p.texte)?.trim();
                        if (nom && nom.length >= 2) faire(() => api('/admin/precisions/promouvoir', { method: 'POST', json: { groupeId: g.id, texte: p.texte, nom } }));
                      }}>
                      ⬆ En faire une famille
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
