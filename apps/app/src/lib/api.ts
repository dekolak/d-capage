import type { ConfigMachine, Indicateur, Valeurs } from '@decapage/machine-kit';

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';
const CLE_JETON = 'decapage.jeton';

export const jeton = {
  get: () => localStorage.getItem(CLE_JETON),
  set: (t: string | null) => (t ? localStorage.setItem(CLE_JETON, t) : localStorage.removeItem(CLE_JETON)),
};

export class ErreurApi extends Error {
  constructor(public status: number, message: string, public erreurs?: { key?: string; message: string }[]) {
    super(message);
  }
}

/** Espace ouvert (lazzeko, kiavik…) : envoyé à chaque requête, l'API s'en sert pour les conditions et les messages. */
let espaceCourant = '';
export const definirEspace = (slug: string) => (espaceCourant = slug);

let surDeconnexion: () => void = () => {};
export const onDeconnexion = (f: () => void) => (surDeconnexion = f);
let surConditions: () => void = () => {};
/** Appelé quand l'API exige d'accepter (de nouveau) les conditions d'utilisation. */
export const onConditions = (f: () => void) => (surConditions = f);

export async function api<T = unknown>(chemin: string, opts: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  const t = jeton.get();
  if (t) headers.set('Authorization', `Bearer ${t}`);
  if (espaceCourant) headers.set('X-Espace', espaceCourant);
  let body = opts.body;
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.json);
  }
  const r = await fetch(BASE + chemin, { ...opts, headers, body });
  if (r.status === 401 && t) {
    jeton.set(null);
    surDeconnexion();
  }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    if (r.status === 403 && e.code === 'CONDITIONS_A_ACCEPTER') surConditions();
    const msg = Array.isArray(e.message) ? e.message.join(', ') : e.message || `Erreur ${r.status}`;
    throw new ErreurApi(r.status, msg, e.erreurs);
  }
  const type = r.headers.get('content-type') ?? '';
  return (type.includes('json') ? r.json() : r.blob()) as Promise<T>;
}

// ---------- types renvoyés par l'API ----------
export interface Moi {
  id: string; identifiant: string; nom: string | null; role: 'ADMIN' | 'USER';
  /** Conditions de l'espace ouvert acceptées (version en vigueur). */
  conditionsAJour: boolean;
  /** Conditions acceptées, par espace. */
  conditions: Record<string, { version: number; accepteeLe: string }>;
  accordPhotosMarketing: boolean;
  modules: string[];
  /** Espaces accessibles (tous pour l'admin). */
  espaces: { slug: string; conditionsAJour: boolean }[];
}
export interface ModuleDef { slug: string; nom: string }
export interface Espace {
  slug: string; nom: string; nomApp: string; nomCourt: string; domaines: string[];
  couleur: string; couleurFoncee: string; couleurDouce: string; icones: string;
  /** Partage communautaire (Lazzeko) ou non (Kiavik). */
  communaute: boolean;
  modules: ModuleDef[];
}
export interface Variante { id: string; slug: string; nom: string; version: { id: string; numero: number }; imageUrl: string | null; imagePropre: boolean }
export interface Fabricant { id: string; nom: string; modeles: { id: string; nom: string; technologie: string; imageUrl: string | null; variantes: Variante[] }[] }
export interface MaMachine {
  id: string; surnom: string | null; varianteId: string; modeleId: string; nom: string; varianteNom: string; imageUrl: string | null; technologie: string;
  version: { id: string; numero: number } | null;
}
export interface Tag { id: string; slug: string; nom: string; groupe?: string }
export interface GroupeTag { id: string; slug: string; nom: string; tags: Tag[] }
export type TypePhoto = 'AVANT' | 'APRES' | 'INTERFACE' | 'AUTRE';
export interface PhotoRef { id: string; type: TypePhoto; ordre: number }
export interface Fiche {
  id: string; titre: string; commentaire: string | null; valeurs: Valeurs; visibilite: 'PRIVEE' | 'PARTAGEE';
  createdAt: string; estAuteur: boolean; auteur: string; masquee: boolean;
  /** Présent uniquement pour les admins. */
  auteurAdmin?: { id: string; identifiant: string; nom: string | null; accordPhotosMarketing: boolean };
  machine: { userMachineId: string | null; surnom: string | null; varianteId: string; modeleId: string; nom: string; varianteNom: string; imageUrl: string | null };
  version: { id: string; numero: number }; tags: Tag[]; photos: PhotoRef[];
  note: { moyenne: number | null; nombre: number; maNote: number | null };
  parent: { id: string; titre: string } | null; nbCopies: number; indicateurs: Indicateur[];
  evaluations?: Avis[];
}
export type StatutAvis = 'VISIBLE' | 'EN_ATTENTE' | 'MASQUE';
export interface Avis {
  id: string; note: number; avis: string | null; date: string; auteur: string; estAuteurFiche: boolean;
  estMoi: boolean; statut: StatutAvis; moderationRaison?: string | null;
}
export interface PageFiches { total: number; page: number; parPage: number; fiches: Fiche[] }
export interface Version { id: string; numero: number; varianteId: string; nomMachine: string; config: ConfigMachine }

// ---------- cache simple des configs (immuables par version) ----------
const configs = new Map<string, Promise<Version>>();
export function chargerVersion(id: string) {
  if (!configs.has(id)) configs.set(id, api<Version>(`/catalogue/versions/${id}`).catch((e) => { configs.delete(id); throw e; }));
  return configs.get(id)!;
}

// ---------- photos protégées : chargées avec le jeton puis affichées en blob ----------
const images = new Map<string, Promise<string>>();
export function urlPhoto(id: string, min = false) {
  const k = id + (min ? ':min' : '');
  if (!images.has(k)) images.set(k, api<Blob>(`/photos/${id}${min ? '?taille=min' : ''}`).then((b) => URL.createObjectURL(b)));
  return images.get(k)!;
}

export async function envoyerPhoto(ficheId: string, type: TypePhoto, image: { fichier: Blob; miniature: Blob }) {
  const fd = new FormData();
  fd.append('type', type);
  fd.append('fichier', image.fichier, 'photo.jpg');
  fd.append('miniature', image.miniature, 'min.jpg');
  return api<PhotoRef>(`/fiches/${ficheId}/photos`, { method: 'POST', body: fd });
}
