import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

/** Format des guides (voir kit-guides/CAHIER_DES_CHARGES.md et apps/api/src/guides). */
export interface Zone { x: number; y: number; largeur: number; hauteur: number; libelle?: string }
export interface Pastille {
  id: string; x: number; y: number; titre: string; texte: string;
  conseil?: string; niveau?: 'avertissement' | 'astuce' | 'a_completer';
  etat?: 'actif' | 'non_utilise' | 'preregle'; zone?: Zone; special?: string;
  /** Mots-clés pour la recherche (synonymes, mots du client : « bouché », « pause »…). */
  mots_cles?: string[];
}
export interface Ecran {
  id: string; code: string; titre: string; groupe: string; intro?: string;
  type: 'capture' | 'fenetre_recreee'; image?: string; fenetre?: string;
  largeur: number; hauteur: number; pastilles: Pastille[];
}
export interface ModeBlanc { nom: string; image_canal: string; image_mur: string; texte: string }
export interface Guide {
  slug: string; nom: string; description?: string; module: string; ecrans: Ecran[];
  navigation?: Navigation;
  modesBlanc?: { ecran: string; pastille: string; convention?: string; plus_utilises?: string[]; modes: ModeBlanc[] };
  animations?: Animation[];
  /** Textes de la fenêtre « Quel blanc choisir ? » (par mode). */
  fenetreBlanc?: Record<string, { titre: string; usage: string; resultat: string }>;
}
export interface ResumeAnimation { id: string; titre: string; resume?: string; image?: string }
export interface ResumeGuide { slug: string; nom: string; description?: string; module: string; ecrans: number; animations: ResumeAnimation[] }

/** Étape d'une animation sur les écrans (format du prototype, voir kit-guides/animations.json). */
export interface EtapeAnim {
  cur?: [number, number]; sel?: string; fx?: number; fy?: number; ring?: number; click?: number;
  go?: string; eff?: string; val?: string; hl?: number; cap?: string; d?: number;
}
export interface EtatAnim { f?: string | null; j?: number; a?: number; wm?: string; t9?: number }
export interface SceneEcrans { titre: string; ecran: string; etat: EtatAnim; etapes: EtapeAnim[] }
export interface SceneBlanc { titre: string; mode: string | null; cap: string }
export interface Animation extends ResumeAnimation {
  guide: string; type: 'ecrans' | 'blanc'; liens?: [string, string][];
  scenes: (SceneEcrans | SceneBlanc)[];
}

interface Reference { largeur: number; hauteur: number }
interface BoutonInfo { titre: string; texte: string; x: number; y: number }
export interface Navigation {
  /** Onglets cliquables communs à plusieurs écrans (ex. T1–T11 de FlexiPRINT). */
  onglets_proprietes?: { ecrans: string[]; x: number[]; y: number; reference: Reference };
  /** Boutons d'information affichés sur les écrans des onglets (ex. E / A). */
  boutons_bas?: { reference: Reference } & Record<string, BoutonInfo | Reference>;
  /** Menus du haut, sur tous les écrans (ex. D1–D8 de DXonJet). */
  menus_haut?: { y: number; boutons: { code: string; x: number; ecran: string | null; titre?: string; texte?: string }[] };
  /** Sous-menus : écrans d'un même menu, en colonne. */
  sous_menus?: { x: number; y_premier: number; ecart: number; groupes: Record<string, string[]> };
}

/** Pastille de navigation : vers un autre écran (`vers`) ou simple information (`info`). */
export interface PastilleNav { id: string; label: string; x: number; y: number; vers?: string; info?: Pastille; actif?: boolean }

const cache = new Map<string, Promise<Guide>>();

/** Guide complet (gardé en mémoire pendant la session). */
export function chargerGuide(slug: string): Promise<Guide> {
  let p = cache.get(slug);
  if (!p) {
    p = api<Guide>(`/guides/${slug}`);
    p.catch(() => cache.delete(slug));
    cache.set(slug, p);
  }
  return p;
}

export function useGuide(slug: string) {
  const [guide, setGuide] = useState<Guide>();
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    let actif = true;
    setGuide(undefined);
    chargerGuide(slug)
      .then((g) => actif && setGuide(g))
      .catch((e) => actif && setErreur(e));
    return () => {
      actif = false;
    };
  }, [slug]);
  return { guide, erreur };
}

/** Pastilles de navigation d'un écran, d'après `navigation` du guide (coordonnées ramenées à l'image de l'écran). */
export function pastillesNavigation(g: Guide, e: Ecran): PastilleNav[] {
  const n = g.navigation;
  const res: PastilleNav[] = [];
  if (!n || e.type !== 'capture') return res;
  const code = (id: string) => g.ecrans.find((x) => x.id === id)?.code ?? id;
  const onglets = n.onglets_proprietes;
  if (onglets?.ecrans.includes(e.id)) {
    const { largeur, hauteur } = onglets.reference;
    onglets.ecrans.forEach((id, i) => {
      if (id !== e.id) res.push({ id: `nav-${id}`, label: code(id), x: (onglets.x[i] * e.largeur) / largeur, y: (onglets.y * e.hauteur) / hauteur, vers: id });
    });
    if (n.boutons_bas) {
      const ref = n.boutons_bas.reference;
      for (const [k, b] of Object.entries(n.boutons_bas)) {
        if (k === 'reference') continue;
        const bi = b as BoutonInfo;
        const x = (bi.x * e.largeur) / ref.largeur;
        const y = (bi.y * e.hauteur) / ref.hauteur;
        res.push({ id: k, label: k, x, y, info: { id: k, x, y, titre: bi.titre, texte: bi.texte, etat: 'actif' } });
      }
    }
  }
  if (n.menus_haut) {
    for (const b of n.menus_haut.boutons) {
      const cible = g.ecrans.find((x) => x.id === b.ecran);
      res.push({
        id: `nav-${b.code}`,
        label: b.code,
        x: b.x,
        y: n.menus_haut.y,
        vers: b.ecran ?? undefined,
        actif: cible?.groupe === e.groupe,
        info: b.ecran ? undefined : { id: b.code, x: b.x, y: n.menus_haut.y, titre: b.titre ?? b.code, texte: b.texte ?? '', etat: 'actif' },
      });
    }
  }
  if (n.sous_menus) {
    const sm = n.sous_menus;
    const groupe = Object.values(sm.groupes).find((l) => l.includes(e.id));
    groupe?.forEach((id, i) => {
      if (id !== e.id) res.push({ id: `nav-${id}`, label: code(id), x: sm.x, y: sm.y_premier + i * sm.ecart, vers: id });
    });
  }
  return res;
}

/** Écran cité dans un texte (« … (écran M0-a) ») : permet un bouton « Ouvrir ». */
export function ecranCite(g: Guide, texte: string, courant: string): Ecran | undefined {
  const m = /écran ([A-Za-z0-9-]+)/i.exec(texte);
  if (!m) return undefined;
  const c = m[1].toLowerCase();
  return g.ecrans.find((e) => e.id !== courant && (e.id.toLowerCase() === c || e.code.toLowerCase() === c));
}

/** Groupes du menu, dans l'ordre des écrans. */
export function groupes(g: Guide): [string, Ecran[]][] {
  const m = new Map<string, Ecran[]>();
  for (const e of g.ecrans) m.set(e.groupe, [...(m.get(e.groupe) ?? []), e]);
  return [...m];
}
