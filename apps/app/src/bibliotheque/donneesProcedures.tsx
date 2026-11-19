import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Forme } from '../components/Annotateur';
import type { Repere } from '../components/Reperes';
import { api, espaceActuel } from '../lib/api';
import { useEspace } from '../lib/espace';
import { useAuth } from '../lib/auth';

/** Type d'un pas-à-pas (choisi par l'admin, icône pour le client). */
export type TypePasAPas = 'tuto' | 'procedure' | 'depannage' | 'entretien';
export const TYPES_PAS_A_PAS: TypePasAPas[] = ['tuto', 'procedure', 'depannage', 'entretien'];
export const ICONE_TYPE: Record<TypePasAPas, string> = { tuto: '🎓', procedure: '📋', depannage: '🩺', entretien: '🧽' };

export interface ResumeProcedure {
  id: string; titre: string; categorie: string; resume: string | null; publiee: boolean; ordre: number; updatedAt: string;
  /** Catégories en plus : le pas-à-pas apparaît aussi dans ces sections. */
  autresCategories?: string[];
  nbEtapes: number; textes: string[];
  /** Espace (lazzeko ou kiavik) et étiquettes des machines concernées (vide = toutes). */
  espace: 'lazzeko' | 'kiavik'; etiquettes: string[]; type: TypePasAPas; cibleCategories: string[]; cibleModeles: string[];
  /** Procédure proposée à la fin. */
  suivanteId: string | null;
  /** Contient des questions (diagnostic). */
  diagnostic?: boolean;
  /** Admin seulement. */
  description?: string | null;
  liens: { guide: string; ecran: string; pastille: string | null }[];
}
export interface Etape {
  id: string; ordre: number; texte: string; avertissement: string | null;
  /** Première photo (adresse), et toutes les photos dans l'ordre. */
  photo: string | null; photos: { id: string; url: string; reperes?: Repere[] | null; annotee?: boolean; annotations?: Forme[] | null }[];
  guide: string | null; ecran: string | null; pastille: string | null;
  /** Étape de contrôle : réponse Oui / Non ; si Non, astuce `solutionId` proposée. */
  controle: boolean; solutionId: string | null;
  /** Détour : l'étape fait partie de la réponse `brancheId` ; null = route principale. */
  brancheId: string | null;
  /** Réponses possibles : l'étape est une question si elle en a. */
  choix: Choix[];
  /** Admin seulement : note interne (pour l'admin et l'IA). */
  note?: string | null;
}
/** Réponse à une question : détour, puis suite (retour, étape, resolu, contact). */
export interface Choix {
  id: string; ordre: number; libelle: string; suite: 'retour' | 'etape' | 'resolu' | 'contact'; etapeCibleId: string | null;
  conclusion: string | null; solutionId: string | null; procedureCibleId: string | null;
  /** Admin seulement. */
  signification?: string | null;
}
export interface Procedure {
  /** « Ce contenu était-il clair ? » à la fin (activé par l'admin). */
  demanderAvis?: boolean;
  id: string; titre: string; categorie: string; autresCategories?: string[]; resume: string | null; publiee: boolean; ordre: number; updatedAt: string; etapes: Etape[];
  espace: 'lazzeko' | 'kiavik'; etiquettes: string[]; type: TypePasAPas; cibleCategories: string[]; cibleModeles: string[];
  /** Procédure proposée à la fin (« Continuer avec … ? »). */
  suivanteId: string | null;
  /** Admin seulement (pour l'IA). */
  description?: string | null; prompt?: string | null; resumeIa?: string | null; resumeIaLe?: string | null;
}
/** La procédure contient des questions (diagnostic). */
export const estDiagnostic = (p: Procedure) => p.etapes.some((e) => e.choix.length > 0);

/** Module « Pas-à-pas et Bon à savoir » de l'espace ouvert. */
export const moduleProcedures = (espace: string) => (espace === 'lazzeko' ? 'procedures-lazzeko' : 'procedures-kiavik');

/** Catégorie de l'accueil (Administration → Catégories) : nom, icône, ordre, masquée. */
/** `espaces` : sociétés où elle est proposée (vide = toutes). */
export interface Categorie { id: string; nom: string; icone: string; ordre: number; masquee: boolean; espaces?: string[] }

let cacheCategories: Promise<Categorie[]> | null = null;
export function chargerCategories(): Promise<Categorie[]> {
  if (!cacheCategories) {
    cacheCategories = api<Categorie[]>('/categories');
    cacheCategories.catch(() => (cacheCategories = null));
  }
  return cacheCategories;
}
export const viderCategories = () => (cacheCategories = null);

/** Catégories de l'accueil, dans leur ordre. */
export function useCategories() {
  const [liste, setListe] = useState<Categorie[]>();
  useEffect(() => {
    let actif = true;
    chargerCategories()
      .then((l) => actif && setListe(l))
      .catch(() => actif && setListe([]));
    return () => {
      actif = false;
    };
  }, []);
  return liste;
}

/** Tri des noms de catégories : dans l'ordre de l'administration, les inconnues à la fin (ordre alphabétique). */
export function trierCategories(l: string[], cats: Categorie[] = []): string[] {
  const rang = (c: string) => {
    const i = cats.findIndex((x) => x.nom === c);
    return i < 0 ? cats.length : i;
  };
  return [...new Set(l)].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b, 'fr'));
}

/** Choix de la catégorie dans les écrans d'administration (les catégories se créent dans « Catégories »). */
/** `espace` : société du contenu (sinon celle ouverte) ; seules ses catégories sont proposées. */
export function ChoixCategorie({ valeur, onChange, espace }: { valeur: string; onChange: (v: string) => void; espace?: string }) {
  const tous = useCategories();
  const { espace: ouvert } = useEspace();
  const soc = espace ?? ouvert.slug;
  const cats = tous?.filter((c) => !c.espaces?.length || c.espaces.includes(soc) || c.nom === valeur);
  const noms = [...(cats ?? []).map((c) => c.nom), ...(valeur && !cats?.some((c) => c.nom === valeur) ? [valeur] : [])];
  return (
    <>
      <select value={valeur} onChange={(e) => onChange(e.target.value)}>
        {!valeur && <option value="">—</option>}
        {noms.map((n) => {
          const c = cats?.find((x) => x.nom === n);
          return <option key={n} value={n}>{c ? `${c.icone} ${n}${c.masquee ? ' (masquée)' : ''}` : n}</option>;
        })}
      </select>
      <Link to="/admin/categories" className="petit">Gérer les catégories ›</Link>
    </>
  );
}

/** Toutes les catégories d'un pas-à-pas : la principale, puis celles en plus. */
export const categoriesDe = (p: { categorie: string; autresCategories?: string[] }) => [p.categorie, ...(p.autresCategories ?? [])];

/** « Aussi dans » : 3 catégories en plus au plus, pour qu'un client stressé trouve le pas-à-pas où il le cherche. */
export function AutresCategories({ principale, valeur, onChange, espace }: { principale: string; valeur: string[]; onChange: (v: string[]) => void; espace?: string }) {
  const tous = useCategories();
  const { espace: ouvert } = useEspace();
  const soc = espace ?? ouvert.slug;
  const cats = (tous ?? []).filter((c) => c.nom !== principale && (!c.espaces?.length || c.espaces.includes(soc) || valeur.includes(c.nom)));
  return (
    <div className="pq-cases">
      {cats.map((c) => {
        const on = valeur.includes(c.nom);
        return (
          <label key={c.nom} className={`pq-case ${on ? 'on' : ''}`}>
            <input type="checkbox" checked={on} disabled={!on && valeur.length >= 3}
              onChange={() => onChange(on ? valeur.filter((x) => x !== c.nom) : [...valeur, c.nom])} />
            {c.icone} {c.nom}
          </label>
        );
      })}
    </div>
  );
}

/** Le compte a-t-il les procédures ? */
export function useAccesProcedures() {
  const { moi } = useAuth();
  const { espace } = useEspace();
  return moi?.role === 'ADMIN' || !!moi?.modules.includes(moduleProcedures(espace.slug));
}

let cache: Promise<ResumeProcedure[]> | null = null;
let cacheEspace = '';
/** Liste des procédures de l'espace ouvert (gardée en mémoire ; `vider` après une modification par l'admin). */
export function chargerProcedures(): Promise<ResumeProcedure[]> {
  if (!cache || cacheEspace !== espaceActuel()) {
    cacheEspace = espaceActuel();
    cache = api<ResumeProcedure[]>('/procedures');
    cache.catch(() => (cache = null));
  }
  return cache;
}
export const viderProcedures = () => (cache = null);

export function useProcedures() {
  const acces = useAccesProcedures();
  const { espace } = useEspace();
  const [liste, setListe] = useState<ResumeProcedure[]>();
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    if (!acces) {
      setListe([]);
      return;
    }
    let actif = true;
    // la société ouverte seulement (l'admin reçoit tout : il ne voit pas les contenus de l'autre société ici)
    chargerProcedures()
      .then((l) => actif && setListe(l.filter((x) => x.espace === espace.slug)))
      .catch((e) => actif && setErreur(e));
    return () => {
      actif = false;
    };
  }, [acces, espace.slug]);
  return { liste, erreur, acces };
}

/** Fiche « Astuces & solutions ». */
export interface Solution {
  id: string; titre: string; categorie: string; cause: string | null; texte: string; avertissement: string | null; motsCles: string[];
  guide: string | null; ecran: string | null; pastille: string | null; procedureId: string | null;
  photo: string | null; publiee: boolean; ordre: number; updatedAt: string;
  espace: 'lazzeko' | 'kiavik'; etiquettes: string[]; cibleCategories: string[]; cibleModeles: string[];
}

let cacheSolutions: Promise<Solution[]> | null = null;
let cacheSolutionsEspace = '';
export function chargerSolutions(): Promise<Solution[]> {
  if (!cacheSolutions || cacheSolutionsEspace !== espaceActuel()) {
    cacheSolutionsEspace = espaceActuel();
    cacheSolutions = api<Solution[]>('/solutions');
    cacheSolutions.catch(() => (cacheSolutions = null));
  }
  return cacheSolutions;
}
export const viderSolutions = () => (cacheSolutions = null);

/** Fiches « Astuces & solutions » (même accès que les procédures). */
export function useSolutions() {
  const acces = useAccesProcedures();
  const { espace } = useEspace();
  const [liste, setListe] = useState<Solution[]>();
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    if (!acces) {
      setListe([]);
      return;
    }
    let actif = true;
    // la société ouverte seulement (l'admin reçoit tout : il ne voit pas les contenus de l'autre société ici)
    chargerSolutions()
      .then((l) => actif && setListe(l.filter((x) => x.espace === espace.slug)))
      .catch((e) => actif && setErreur(e));
    return () => {
      actif = false;
    };
  }, [acces, espace.slug]);
  return { liste, erreur, acces };
}

/** Adresse de l'écran du guide pour le lien d'une étape. */
export const lienGuide = (l: { guide: string | null; ecran: string | null; pastille: string | null }) =>
  l.guide && l.ecran ? `/guides/${l.guide}/${l.ecran}${l.pastille ? `?p=${encodeURIComponent(l.pastille)}` : ''}` : null;

const images = new Map<string, Promise<string>>();
/** Image servie par l'API avec le jeton (photos d'étapes). */
export function ImageApi({ chemin, className, onClick }: { chemin: string; className?: string; onClick?: () => void }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let vivant = true;
    if (!images.has(chemin)) images.set(chemin, api<Blob>(chemin).then((b) => URL.createObjectURL(b)));
    images.get(chemin)!.then((u) => vivant && setSrc(u)).catch(() => images.delete(chemin));
    return () => {
      vivant = false;
    };
  }, [chemin]);
  return src ? <img src={src} className={className} onClick={onClick} alt="" /> : <div className={`img-vide ${className ?? ''}`} />;
}

const normC = (e: string) => e.trim().toLowerCase();
/** « Pour qui ? » : la ressource concerne-t-elle cette machine (modèle) ? Rien de coché = toutes les machines de l'espace. */
export function pourModele(
  c: { etiquettes: string[]; cibleCategories?: string[]; cibleModeles?: string[] },
  m: { modeleId: string; categorie: string | null; etiquettes: string[] },
): boolean {
  const cc = c.cibleCategories ?? [];
  const cm = c.cibleModeles ?? [];
  if (!c.etiquettes.length && !cc.length && !cm.length) return true;
  return cm.includes(m.modeleId)
    || (!!m.categorie && cc.some((x) => normC(x) === normC(m.categorie!)))
    || c.etiquettes.some((e) => m.etiquettes.some((x) => normC(x) === normC(e)));
}
