import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export interface ResumeProcedure {
  id: string; titre: string; categorie: string; resume: string | null; publiee: boolean; ordre: number; updatedAt: string;
  nbEtapes: number; textes: string[];
  /** Contient des questions (diagnostic). */
  diagnostic?: boolean;
  /** Admin seulement. */
  description?: string | null;
  liens: { guide: string; ecran: string; pastille: string | null }[];
}
export interface Etape {
  id: string; ordre: number; texte: string; avertissement: string | null;
  /** Première photo (adresse), et toutes les photos dans l'ordre. */
  photo: string | null; photos: { id: string; url: string }[];
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
  id: string; titre: string; categorie: string; resume: string | null; publiee: boolean; ordre: number; updatedAt: string; etapes: Etape[];
  /** Admin seulement (pour l'IA). */
  description?: string | null; prompt?: string | null; resumeIa?: string | null; resumeIaLe?: string | null;
}
/** La procédure contient des questions (diagnostic). */
export const estDiagnostic = (p: Procedure) => p.etapes.some((e) => e.choix.length > 0);

export const MODULE_PROCEDURES = 'procedures-kiavik';

/** Le compte a-t-il les procédures ? */
export function useAccesProcedures() {
  const { moi } = useAuth();
  return moi?.role === 'ADMIN' || !!moi?.modules.includes(MODULE_PROCEDURES);
}

let cache: Promise<ResumeProcedure[]> | null = null;
/** Liste des procédures (gardée en mémoire ; `vider` après une modification par l'admin). */
export function chargerProcedures(): Promise<ResumeProcedure[]> {
  if (!cache) {
    cache = api<ResumeProcedure[]>('/procedures');
    cache.catch(() => (cache = null));
  }
  return cache;
}
export const viderProcedures = () => (cache = null);

export function useProcedures() {
  const acces = useAccesProcedures();
  const [liste, setListe] = useState<ResumeProcedure[]>();
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    if (!acces) {
      setListe([]);
      return;
    }
    let actif = true;
    chargerProcedures()
      .then((l) => actif && setListe(l))
      .catch((e) => actif && setErreur(e));
    return () => {
      actif = false;
    };
  }, [acces]);
  return { liste, erreur, acces };
}

/** Fiche « Astuces & solutions ». */
export interface Solution {
  id: string; titre: string; categorie: string; cause: string | null; texte: string; avertissement: string | null; motsCles: string[];
  guide: string | null; ecran: string | null; pastille: string | null; procedureId: string | null;
  photo: string | null; publiee: boolean; ordre: number; updatedAt: string;
}

let cacheSolutions: Promise<Solution[]> | null = null;
export function chargerSolutions(): Promise<Solution[]> {
  if (!cacheSolutions) {
    cacheSolutions = api<Solution[]>('/solutions');
    cacheSolutions.catch(() => (cacheSolutions = null));
  }
  return cacheSolutions;
}
export const viderSolutions = () => (cacheSolutions = null);

/** Fiches « Astuces & solutions » (même accès que les procédures). */
export function useSolutions() {
  const acces = useAccesProcedures();
  const [liste, setListe] = useState<Solution[]>();
  const [erreur, setErreur] = useState<unknown>();
  useEffect(() => {
    if (!acces) {
      setListe([]);
      return;
    }
    let actif = true;
    chargerSolutions()
      .then((l) => actif && setListe(l))
      .catch((e) => actif && setErreur(e));
    return () => {
      actif = false;
    };
  }, [acces]);
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
