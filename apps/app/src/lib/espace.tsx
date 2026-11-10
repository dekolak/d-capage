import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Chargement } from '../components/Composants';
import { api, definirEspace, Espace } from './api';

/**
 * Espace ouvert : Lazzeko (app.lazzeko.com) ou Kiavik (app.kiavikcopilot.ovh).
 * Choisi par l'adresse ; un compte qui a accès aux deux peut changer d'espace (choix gardé sur le téléphone).
 * Applique la couleur, le nom et l'icône de l'espace.
 */
interface Ctx {
  espace: Espace;
  espaces: Espace[];
  choisir(slug: string): void;
}
const EspaceCtx = createContext<Ctx>(null!);
const CLE_CHOIX = 'decapage.espace';
const CLE_CACHE = 'decapage.espaces';

function espaceInitial(espaces: Espace[]): Espace {
  const choix = espaces.find((e) => e.slug === localStorage.getItem(CLE_CHOIX));
  if (choix) return choix;
  return espaces.find((e) => e.domaines.includes(location.hostname)) ?? espaces[0];
}

function appliquer(e: Espace) {
  definirEspace(e.slug);
  const r = document.documentElement.style;
  r.setProperty('--o', e.couleur);
  r.setProperty('--od', e.couleurFoncee);
  r.setProperty('--o-doux', e.couleurDouce);
  r.setProperty('--anneau', `0 0 0 3px ${e.couleur}38`);
  document.title = e.nomApp;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', e.couleur);
  document.querySelector('link[rel="icon"]')?.setAttribute('href', `${e.icones}icone.svg`);
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', `${e.icones}icone-192.png`);
  document.documentElement.dataset.espace = e.slug;
}

export function EspaceProvider({ children }: { children: ReactNode }) {
  const [espaces, setEspaces] = useState<Espace[]>(() => JSON.parse(localStorage.getItem(CLE_CACHE) ?? '[]'));
  const [espace, setEspace] = useState<Espace | undefined>(() => (espaces.length ? espaceInitial(espaces) : undefined));

  useEffect(() => {
    api<Espace[]>('/espaces')
      .then((l) => {
        localStorage.setItem(CLE_CACHE, JSON.stringify(l));
        setEspaces(l);
        setEspace((avant) => l.find((e) => e.slug === avant?.slug) ?? espaceInitial(l));
      })
      .catch(() => {}); // hors ligne : dernière liste connue
  }, []);

  useEffect(() => {
    if (espace) appliquer(espace);
  }, [espace]);

  const choisir = useCallback(
    (slug: string) => {
      const e = espaces.find((x) => x.slug === slug);
      if (!e) return;
      localStorage.setItem(CLE_CHOIX, slug);
      appliquer(e);
      setEspace(e);
    },
    [espaces],
  );

  if (!espace) return <Chargement />;
  appliquer(espace); // avant le premier appel à l'API des enfants
  return <EspaceCtx.Provider value={{ espace, espaces, choisir }}>{children}</EspaceCtx.Provider>;
}

export const useEspace = () => useContext(EspaceCtx);
