/**
 * Brouillon de la fiche en cours, conservé sur le téléphone :
 * - les champs (machine, tags, réglages, titre…) dans localStorage ;
 * - les photos (déjà compressées) dans IndexedDB, qui accepte les fichiers.
 * Un seul brouillon à la fois ; effacé quand la fiche est enregistrée.
 */
import type { Valeurs } from '@decapage/machine-kit';
import type { TypePhoto } from './api';

export interface Brouillon {
  userMachineId: string;
  valeurs: Valeurs | null;
  tagIds: string[];
  titre: string;
  commentaire: string;
  note: number | null;
  etape: number;
  /** Horodatage de la dernière modification. */
  maj?: number;
}
export interface PhotoBrouillon { type: TypePhoto; fichier: Blob; miniature: Blob }

const CLE = 'decapage.brouillon';

export function lireBrouillon(): Brouillon | null {
  try {
    const s = localStorage.getItem(CLE);
    return s ? (JSON.parse(s) as Brouillon) : null;
  } catch {
    return null;
  }
}

export function ecrireBrouillon(b: Brouillon) {
  localStorage.setItem(CLE, JSON.stringify({ ...b, maj: Date.now() }));
}

/** true si le brouillon contient autre chose que le choix de la machine. */
export function brouillonUtile(b: Brouillon | null, nbPhotos = 0) {
  return !!b && (b.tagIds.length > 0 || !!b.valeurs || !!b.titre || !!b.commentaire || !!b.note || nbPhotos > 0);
}

// ---------- photos (IndexedDB) ----------
function base(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('decapage', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('brouillon');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function operation<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await base();
  return new Promise((ok, ko) => {
    const req = f(db.transaction('brouillon', mode).objectStore('brouillon'));
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
}

export async function lirePhotosBrouillon(): Promise<PhotoBrouillon[]> {
  try {
    return ((await operation('readonly', (s) => s.get('photos'))) as PhotoBrouillon[] | undefined) ?? [];
  } catch {
    return [];
  }
}

export async function ecrirePhotosBrouillon(photos: PhotoBrouillon[]) {
  try {
    await operation('readwrite', (s) => s.put(photos.map(({ type, fichier, miniature }) => ({ type, fichier, miniature })), 'photos'));
  } catch {
    /* stockage plein ou indisponible : on garde au moins les champs */
  }
}

export async function effacerBrouillon() {
  localStorage.removeItem(CLE);
  try {
    await operation('readwrite', (s) => s.delete('photos'));
  } catch {
    /* rien */
  }
}
