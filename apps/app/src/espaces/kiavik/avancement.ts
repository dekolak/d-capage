import { useEffect, useMemo, useState } from 'react';
import { envoyerOuPlusTard } from '../../lib/api';
import { calculerChemin } from './chemin';
import { Choix, estDiagnostic, Etape, Procedure } from './donneesProcedures';

/** Lit / garde une valeur JSON sur le téléphone. */
function useGarde<T>(cle: string, defaut: T) {
  const [v, setV] = useState<T>(() => {
    try {
      return JSON.parse(localStorage.getItem(cle) ?? '') as T;
    } catch {
      return defaut;
    }
  });
  useEffect(() => {
    localStorage.setItem(cle, JSON.stringify(v));
  }, [cle, v]);
  return [v, setV] as const;
}

/**
 * Avancement d'un client dans une procédure, gardé sur le téléphone :
 * étapes cochées, étapes de contrôle répondues « Non », réponses aux questions (diagnostic) et chemin qui en découle.
 */
export function useAvancement(p: Procedure | undefined, id: string) {
  const [faites, setFaites] = useGarde<string[]>(`kiavik.etapes.${id}`, []);
  const [non, setNon] = useGarde<string[]>(`kiavik.controles.${id}`, []);
  const [reponses, setReponses] = useGarde<Record<string, string>>(`kiavik.reponses.${id}`, {});
  // réponses déjà envoyées à Kiavik (pour ne pas envoyer deux fois le même résultat)
  const [envoyees, setEnvoyees] = useGarde<string | null>(`kiavik.envoye.${id}`, null);
  const [plusTard, setPlusTard] = useGarde<boolean>(`kiavik.envoyePlusTard.${id}`, false);
  const chemin = useMemo(() => calculerChemin<Choix, Etape>(p?.etapes ?? [], reponses), [p, reponses]);
  // tentative en cours (identifiant tiré au hasard, anonyme) : pour les statistiques
  const [session, setSession] = useGarde<string | null>(`kiavik.session.${id}`, null);
  const nbFaites = chemin.pas.filter(({ e }) => faites.includes(e.id) || (e.choix.length > 0 && !!reponses[e.id])).length;

  useEffect(() => {
    if (!p || p.id !== id) return;
    if (!faites.length && !non.length && !Object.keys(reponses).length) return;
    if (!session) {
      setSession(typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      return;
    }
    const faitesIci = chemin.pas.filter(({ e }) => faites.includes(e.id) || (e.choix.length > 0 && !!reponses[e.id]));
    const derniere = faitesIci.length ? faitesIci[faitesIci.length - 1].e.id : chemin.pas[0]?.e.id ?? null;
    const fin = estDiagnostic(p) ? chemin.fin?.type ?? null : chemin.pas.length > 0 && faitesIci.length >= chemin.pas.length ? 'termine' : null;
    const minuteur = setTimeout(() => {
      envoyerOuPlusTard(`/procedures/${p.id}/suivi`, 'PUT', { session, reponses, faites: faitesIci.length, total: chemin.pas.length, derniere, fin }, `suivi:${session}`).catch(() => {});
      // ouvert depuis le carnet d'entretien : terminé → tâche notée (sauf photo demandée : le client la note dans le carnet)
      const carnet = localStorage.getItem(`kiavik.carnet.${p.id}`);
      if (fin && carnet) {
        try {
          const c = JSON.parse(carnet) as { machine: string; tache: string; photo: boolean };
          if (!c.photo) {
            localStorage.removeItem(`kiavik.carnet.${p.id}`);
            envoyerOuPlusTard(`/moi/carnet/${c.machine}/faits`, 'POST', { tacheId: c.tache, source: 'pasapas' }, `carnet:${c.machine}:${c.tache}`).catch(() => {});
          }
        } catch {
          localStorage.removeItem(`kiavik.carnet.${p.id}`);
        }
      }
      // ouvert depuis un rappel d'entretien : terminé → historique d'entretien du client
      const rappel = localStorage.getItem(`kiavik.rappel.${p.id}`);
      if (fin && rappel) {
        localStorage.removeItem(`kiavik.rappel.${p.id}`);
        envoyerOuPlusTard(`/procedures/${p.id}/termine`, 'POST', { annonceId: rappel }, `termine:${p.id}:${rappel}`).catch(() => {});
      }
    }, 1500);
    return () => clearTimeout(minuteur);
  }, [p, id, faites, non, reponses, session, chemin]);

  return {
    faites, non, reponses, chemin,
    basculer: (e: string) => setFaites((f) => (f.includes(e) ? f.filter((x) => x !== e) : [...f, e])),
    cocher: (e: string) => setFaites((f) => (f.includes(e) ? f : [...f, e])),
    /** Étape de contrôle : « Oui » la coche, « Non » affiche l'aide. */
    controler: (e: string, oui: boolean) => {
      setFaites((f) => (oui ? [...f.filter((x) => x !== e), e] : f.filter((x) => x !== e)));
      setNon((n) => (oui ? n.filter((x) => x !== e) : [...n.filter((x) => x !== e), e]));
    },
    /** Question : choisit la réponse (le chemin se recalcule). */
    repondre: (question: string, choix: string) => setReponses((r) => ({ ...r, [question]: choix })),
    recommencer: () => {
      setFaites([]);
      setNon([]);
      setReponses({});
      setEnvoyees(null);
      setSession(null); // nouvelle tentative
    },
    /** Le résultat actuel a déjà été envoyé. */
    envoye: envoyees === JSON.stringify(reponses),
    /** Envoi parti (ou mis de côté, sans réseau : il partira tout seul). */
    marquerEnvoye: (enAttente = false) => {
      setEnvoyees(JSON.stringify(reponses));
      setPlusTard(enAttente);
    },
    envoyePlusTard: plusTard,
    /** Étapes faites (cochées, contrôlées « Oui » ou questions répondues) parmi celles du chemin. */
    nbFaites,
  };
}
export type Avancement = ReturnType<typeof useAvancement>;
