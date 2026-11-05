import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, jeton, Moi, onDeconnexion } from './api';

interface Ctx {
  moi: Moi | null;
  pret: boolean;
  connexion(identifiant: string, motDePasse: string): Promise<void>;
  deconnexion(): void;
}
const AuthCtx = createContext<Ctx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [moi, setMoi] = useState<Moi | null>(null);
  const [pret, setPret] = useState(false);

  const deconnexion = useCallback(() => {
    jeton.set(null);
    setMoi(null);
  }, []);

  useEffect(() => {
    onDeconnexion(() => setMoi(null));
    if (!jeton.get()) return setPret(true);
    api<Moi>('/moi').then(setMoi).catch(() => jeton.set(null)).finally(() => setPret(true));
  }, []);

  const connexion = async (identifiant: string, motDePasse: string) => {
    const r = await api<{ jeton: string; user: Moi }>('/auth/connexion', { method: 'POST', json: { identifiant, motDePasse } });
    jeton.set(r.jeton);
    setMoi(r.user);
  };

  return <AuthCtx.Provider value={{ moi, pret, connexion, deconnexion }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
