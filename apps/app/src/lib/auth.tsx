import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, jeton, Moi, onConditions, onDeconnexion } from './api';

interface Ctx {
  moi: Moi | null;
  pret: boolean;
  connexion(identifiant: string, motDePasse: string): Promise<void>;
  deconnexion(): void;
  /** Relit le compte (après acceptation des conditions, changement d'accord photos…). */
  rafraichir(m?: Moi): Promise<void>;
}
const AuthCtx = createContext<Ctx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [moi, setMoi] = useState<Moi | null>(null);
  const [pret, setPret] = useState(false);

  const deconnexion = useCallback(() => {
    jeton.set(null);
    setMoi(null);
  }, []);

  const rafraichir = useCallback(async (m?: Moi) => {
    setMoi(m ?? (await api<Moi>('/moi')));
  }, []);

  useEffect(() => {
    onDeconnexion(() => setMoi(null));
    // Nouvelles conditions publiées pendant l'utilisation : on relit le compte, l'écran d'accueil s'affiche.
    onConditions(() => api<Moi>('/moi').then(setMoi).catch(() => {}));
    if (!jeton.get()) return setPret(true);
    api<Moi>('/moi').then(setMoi).catch(() => jeton.set(null)).finally(() => setPret(true));
  }, []);

  const connexion = async (identifiant: string, motDePasse: string) => {
    const r = await api<{ jeton: string }>('/auth/connexion', { method: 'POST', json: { identifiant, motDePasse } });
    jeton.set(r.jeton);
    setMoi(await api<Moi>('/moi'));
  };

  return <AuthCtx.Provider value={{ moi, pret, connexion, deconnexion, rafraichir }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
