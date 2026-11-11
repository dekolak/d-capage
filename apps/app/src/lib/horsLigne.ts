import { useEffect, useState } from 'react';

/**
 * Hors ligne (atelier sans réseau) :
 * - les lectures de l'API (GET) sont gardées dans le cache du téléphone ; sans réseau, l'app relit la dernière version ;
 *   les routes d'administration ne sont pas gardées ; le cache est vidé à la déconnexion / au changement de compte ;
 * - les envois importants (résultat de diagnostic, « pas clair ? », suivi) partent dans une file et sont renvoyés au retour du réseau.
 */
export const CACHE_API = 'decapage-api';
const NON_GARDEES = ['/admin', '/ia', '/users', '/webhooks', '/push', '/auth', '/cles-api', '/mot-de-passe'];
const disponible = () => typeof window !== 'undefined' && 'caches' in window;

export const aGarder = (chemin: string) => !NON_GARDEES.some((p) => chemin === p || chemin.startsWith(`${p}/`) || chemin.startsWith(`${p}?`));

/** Garde une réponse (copie) ; ne bloque jamais. */
export function garder(url: string, r: Response) {
  if (!disponible() || !r.ok) return;
  const copie = r.clone();
  caches.open(CACHE_API).then((c) => c.put(url, copie)).catch(() => {});
}

/** Réponse gardée pour cette adresse, s'il y en a une. */
export async function relire(url: string): Promise<Response | undefined> {
  if (!disponible()) return undefined;
  return caches.open(CACHE_API).then((c) => c.match(url)).catch(() => undefined);
}

export function viderCache() {
  if (disponible()) caches.delete(CACHE_API).catch(() => {});
}

// ---------- file d'envoi ----------
const CLE_FILE = 'decapage.envois';
export interface EnvoiEnAttente { chemin: string; method: string; json?: unknown; cle?: string; date: number }
const lireFile = (): EnvoiEnAttente[] => {
  try {
    return JSON.parse(localStorage.getItem(CLE_FILE) ?? '[]');
  } catch {
    return [];
  }
};
const ecrireFile = (l: EnvoiEnAttente[]) => {
  localStorage.setItem(CLE_FILE, JSON.stringify(l));
  abonnes.forEach((f) => f(l.length));
};
const abonnes = new Set<(n: number) => void>();

/** Met un envoi de côté (un seul par `cle` : le plus récent remplace l'ancien). */
export function mettreDeCote(e: Omit<EnvoiEnAttente, 'date'>) {
  const l = lireFile().filter((x) => !e.cle || x.cle !== e.cle);
  ecrireFile([...l, { ...e, date: Date.now() }].slice(-100));
}

let enCours = false;
/** Renvoie la file. `envoyer` lève une erreur avec `status` 0 si le réseau manque encore (on garde l'envoi). */
export async function viderFile(envoyer: (e: EnvoiEnAttente) => Promise<unknown>) {
  if (enCours || !lireFile().length) return;
  enCours = true;
  try {
    for (const e of lireFile()) {
      try {
        await envoyer(e);
      } catch (err) {
        if ((err as { status?: number }).status === 0) break; // toujours hors ligne
        // refus du serveur (procédure supprimée…) : on abandonne cet envoi
      }
      ecrireFile(lireFile().filter((x) => x.date !== e.date || x.chemin !== e.chemin));
    }
  } finally {
    enCours = false;
  }
}

/** En ligne ? et nombre d'envois en attente. */
export function useEnLigne() {
  const [enLigne, setEnLigne] = useState(() => navigator.onLine);
  const [attente, setAttente] = useState(() => lireFile().length);
  useEffect(() => {
    const oui = () => setEnLigne(true);
    const non = () => setEnLigne(false);
    window.addEventListener('online', oui);
    window.addEventListener('offline', non);
    abonnes.add(setAttente);
    return () => {
      window.removeEventListener('online', oui);
      window.removeEventListener('offline', non);
      abonnes.delete(setAttente);
    };
  }, []);
  return { enLigne, attente };
}
