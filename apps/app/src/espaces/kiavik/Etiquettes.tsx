import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useEspace } from '../../lib/espace';

/*
 * Espace (technologie) et étiquettes d'un contenu (pas-à-pas, Bon à savoir) — administration, en français.
 * Un contenu appartient à UN espace ; sans étiquette il concerne toutes les machines de l'espace,
 * sinon les clients dont une machine (modèle) porte au moins une de ses étiquettes.
 */

export type EspaceContenu = 'lazzeko' | 'kiavik';
interface InfoEtiquette { etiquette: string; espace: string; modeles: string[]; contenus: number }
interface ModeleCat { id: string; nom: string; espaces: string[]; etiquettes: string[]; categorie: string | null }
interface FabricantCat { id: string; nom: string; modeles: ModeleCat[] }

const norm = (e: string) => e.trim().toLowerCase();

let cacheEtiquettes: Promise<InfoEtiquette[]> | null = null;
let cacheCatalogue: Promise<FabricantCat[]> | null = null;
/** À appeler après une modification d'étiquettes (suggestions et aperçu à jour). */
export const viderEtiquettes = () => {
  cacheEtiquettes = null;
  cacheCatalogue = null;
};
function useEtiquettes() {
  const [l, setL] = useState<InfoEtiquette[]>([]);
  useEffect(() => {
    if (!cacheEtiquettes) cacheEtiquettes = api<InfoEtiquette[]>('/admin/catalogue/etiquettes').catch(() => (cacheEtiquettes = null, []) as never);
    cacheEtiquettes.then(setL);
  }, []);
  return l;
}
function useCatalogue() {
  const [l, setL] = useState<FabricantCat[]>([]);
  useEffect(() => {
    if (!cacheCatalogue) cacheCatalogue = api<FabricantCat[]>('/admin/catalogue').catch(() => (cacheCatalogue = null, []) as never);
    cacheCatalogue.then(setL);
  }, []);
  return l;
}

/** Choix de l'espace : Lazzeko ou Kiavik (obligatoire, un seul). */
export function ChoixEspace({ valeur, onChange }: { valeur: EspaceContenu; onChange: (e: EspaceContenu) => void }) {
  const { espaces } = useEspace();
  return (
    <div className="seg">
      {espaces.map((e) => (
        <button key={e.slug} type="button" className={valeur === e.slug ? 'on' : ''} onClick={() => onChange(e.slug as EspaceContenu)}>{e.nom}</button>
      ))}
    </div>
  );
}

/** Étiquettes : puces, suggestions (celles déjà utilisées dans l'espace), Entrée ou virgule pour ajouter. */
export function ChoixEtiquettes({ espace, valeur, onChange, placeholder }: {
  espace: string; valeur: string[]; onChange: (l: string[]) => void; placeholder?: string;
}) {
  const toutes = useEtiquettes();
  const [saisie, setSaisie] = useState('');
  const ajouter = (e: string) => {
    const x = e.trim().replace(/\s+/g, ' ');
    if (x.length < 2 || valeur.some((v) => norm(v) === norm(x))) return setSaisie('');
    onChange([...valeur, x]);
    setSaisie('');
  };
  const suggestions = toutes.filter((t) => t.espace === espace && !valeur.some((v) => norm(v) === norm(t.etiquette)));
  return (
    <div className="et-choix">
      <div className="et-puces">
        {valeur.map((e) => (
          <span key={e} className="et-puce">
            🏷 {e}
            <button type="button" aria-label={`Retirer ${e}`} onClick={() => onChange(valeur.filter((x) => x !== e))}>✕</button>
          </span>
        ))}
        <input value={saisie} placeholder={placeholder ?? (valeur.length ? '+ étiquette' : 'Aucune = toutes les machines (Entrée pour ajouter)')}
          list={`etiquettes-${espace}`}
          onChange={(e) => (e.target.value.endsWith(',') ? ajouter(e.target.value.slice(0, -1)) : setSaisie(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              ajouter(saisie);
            } else if (e.key === 'Backspace' && !saisie && valeur.length) onChange(valeur.slice(0, -1));
          }}
          onBlur={() => saisie && ajouter(saisie)} />
        <datalist id={`etiquettes-${espace}`}>{suggestions.map((t) => <option key={t.etiquette} value={t.etiquette} />)}</datalist>
      </div>
      {suggestions.length > 0 && (
        <div className="et-suggestions">
          {suggestions.slice(0, 12).map((t) => (
            <button key={t.etiquette} type="button" className="et-suggestion" title={t.modeles.length ? `Portée par : ${t.modeles.join(', ')}` : 'Aucune machine ne la porte encore'}
              onClick={() => ajouter(t.etiquette)}>+ {t.etiquette}{t.modeles.length ? '' : ' ⚠️'}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Aperçu : quelles machines (modèles) verront ce contenu. */
export function VisiblePar({ espace, etiquettes }: { espace: string; etiquettes: string[] }) {
  const cat = useCatalogue();
  const modeles = cat.flatMap((f) => f.modeles.filter((m) => m.espaces.includes(espace)).map((m) => ({ ...m, nom: `${f.nom} ${m.nom}` })));
  const voient = etiquettes.length ? modeles.filter((m) => m.etiquettes.some((e) => etiquettes.some((x) => norm(x) === norm(e)))) : modeles;
  return (
    <small className={`et-visible ${etiquettes.length && !voient.length ? 'alerte' : ''}`}>
      👁 Visible par :{' '}
      {!etiquettes.length
        ? `toutes les machines ${espace === 'lazzeko' ? 'Lazzeko' : 'Kiavik'}${modeles.length ? ` (${modeles.length} modèle${modeles.length > 1 ? 's' : ''})` : ''}`
        : voient.length
          ? voient.map((m) => m.nom).join(', ')
          : <>aucune machine ne porte ces étiquettes — ajoutez-les dans <Link to="/admin/catalogue">Machines</Link></>}
    </small>
  );
}

/** Espace + étiquettes + aperçu, en un bloc (éditeurs, mode terrain). */
export function BlocEtiquettes({ espace, etiquettes, onChange }: {
  espace: EspaceContenu; etiquettes: string[]; onChange: (v: { espace: EspaceContenu; etiquettes: string[] }) => void;
}) {
  return (
    <div className="et-bloc">
      <b className="petit">Espace (technologie)</b>
      <ChoixEspace valeur={espace} onChange={(e) => onChange({ espace: e, etiquettes })} />
      <b className="petit">Machines concernées (étiquettes)</b>
      <ChoixEtiquettes espace={espace} valeur={etiquettes} onChange={(l) => onChange({ espace, etiquettes: l })} />
      <VisiblePar espace={espace} etiquettes={etiquettes} />
    </div>
  );
}

// ---------- « Pour qui ? » : catégories de machines et machines précises (remplace la saisie d'étiquettes) ----------
interface CategorieMachine { espace: string; categorie: string; modeles: { id: string; nom: string }[] }
let cacheCategoriesMachines: Promise<CategorieMachine[]> | null = null;
export const viderCategoriesMachines = () => (cacheCategoriesMachines = null);
export function useCategoriesMachines() {
  const [l, setL] = useState<CategorieMachine[]>([]);
  useEffect(() => {
    if (!cacheCategoriesMachines) cacheCategoriesMachines = api<CategorieMachine[]>('/admin/catalogue/categories').catch(() => (cacheCategoriesMachines = null, []) as never);
    cacheCategoriesMachines.then(setL);
  }, []);
  return l;
}

export interface Cible { espace: EspaceContenu; cibleCategories: string[]; cibleModeles: string[]; etiquettes: string[] }

/**
 * Espace + « Pour qui ? » : toutes les machines de l'espace, ou des catégories (Décapeuse, Soudeuse…) et/ou des machines précises.
 * Une nouvelle machine d'une catégorie cochée reçoit automatiquement la ressource.
 */
export function BlocPourQui({ valeur, onChange }: { valeur: Cible; onChange: (v: Cible) => void }) {
  const cats = useCategoriesMachines().filter((c) => c.espace === valeur.espace);
  const catalogue = useCatalogue();
  const modeles = catalogue.flatMap((f) => f.modeles.filter((m) => m.espaces.includes(valeur.espace)).map((m) => ({ ...m, nom: `${f.nom} ${m.nom}` })));
  const toutes = !valeur.cibleCategories.length && !valeur.cibleModeles.length && !valeur.etiquettes.length;
  const [ouvert, setOuvert] = useState(!toutes);
  const basculer = <K extends 'cibleCategories' | 'cibleModeles'>(k: K, x: string) =>
    onChange({ ...valeur, [k]: valeur[k].includes(x) ? valeur[k].filter((y) => y !== x) : [...valeur[k], x] });
  // aperçu : les modèles qui verront la ressource
  const voient = toutes ? modeles : modeles.filter((m) =>
    valeur.cibleModeles.includes(m.id)
    || cats.some((c) => valeur.cibleCategories.some((x) => norm(x) === norm(c.categorie)) && c.modeles.some((cm) => cm.id === m.id))
    || m.etiquettes.some((e) => valeur.etiquettes.some((x) => norm(x) === norm(e))));
  return (
    <div className="et-bloc pq">
      <b className="petit">Espace (technologie)</b>
      <ChoixEspace valeur={valeur.espace} onChange={(e) => onChange({ espace: e, cibleCategories: [], cibleModeles: [], etiquettes: [] })} />
      <b className="petit">Pour qui ?</b>
      <div className="seg">
        <button type="button" className={!ouvert ? 'on' : ''} onClick={() => { setOuvert(false); onChange({ ...valeur, cibleCategories: [], cibleModeles: [], etiquettes: [] }); }}>
          Toutes les machines
        </button>
        <button type="button" className={ouvert ? 'on' : ''} onClick={() => setOuvert(true)}>Certaines machines</button>
      </div>
      {ouvert && (
        <>
          <small className="muted">Catégories (les nouvelles machines de la catégorie suivent automatiquement)</small>
          <div className="pq-cases">
            {cats.map((c) => (
              <label key={c.categorie} className={`pq-case ${valeur.cibleCategories.some((x) => norm(x) === norm(c.categorie)) ? 'on' : ''}`}>
                <input type="checkbox" checked={valeur.cibleCategories.some((x) => norm(x) === norm(c.categorie))}
                  onChange={() => basculer('cibleCategories', valeur.cibleCategories.find((x) => norm(x) === norm(c.categorie)) ?? c.categorie)} />
                {c.categorie} <small className="muted">({c.modeles.length})</small>
              </label>
            ))}
          </div>
          <small className="muted">Machines précises</small>
          <div className="pq-cases">
            {modeles.map((m) => (
              <label key={m.id} className={`pq-case ${valeur.cibleModeles.includes(m.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={valeur.cibleModeles.includes(m.id)} onChange={() => basculer('cibleModeles', m.id)} />
                {m.nom}
              </label>
            ))}
            {!modeles.length && <small className="muted">Aucune machine dans cet espace (Administration → Machines).</small>}
          </div>
          {valeur.etiquettes.length > 0 && (
            <div className="et-puces">
              <small className="muted">Anciennes étiquettes :</small>
              {valeur.etiquettes.map((e) => (
                <span key={e} className="et-puce">🏷 {e}<button type="button" onClick={() => onChange({ ...valeur, etiquettes: valeur.etiquettes.filter((x) => x !== e) })}>✕</button></span>
              ))}
            </div>
          )}
        </>
      )}
      <small className={`et-visible ${!toutes && !voient.length ? 'alerte' : ''}`}>
        👁 Visible par : {toutes ? `toutes les machines ${valeur.espace === 'lazzeko' ? 'Lazzeko' : 'Kiavik'}` : voient.length ? voient.map((m) => m.nom).join(', ') : 'aucune machine pour l\'instant (les futures machines des catégories cochées suivront)'}
      </small>
    </div>
  );
}
