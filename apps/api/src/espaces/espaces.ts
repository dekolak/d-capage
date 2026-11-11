/**
 * Espaces de l'app : une seule app, une seule base, un seul admin, mais deux « marques » séparées.
 * Chaque espace a ses modules (fonctions), ses conditions d'utilisation, son apparence et son adresse.
 * Un compte a accès à un espace s'il a au moins un module de cet espace (UserModule).
 *
 * Ajouter un espace ou un module = modifier ce fichier (aucune migration : les slugs sont stockés en texte).
 */
export interface ModuleDef {
  slug: string;
  nom: string;
}

export interface EspaceDef {
  slug: string;
  nom: string;
  /** Nom affiché dans l'app et sur l'écran d'accueil du téléphone. */
  nomApp: string;
  nomCourt: string;
  /** Adresses qui ouvrent cet espace (le premier espace sert pour les autres adresses, ex. localhost). */
  domaines: string[];
  /** Couleur principale, foncée (appui), douce (fonds). */
  couleur: string;
  couleurFoncee: string;
  couleurDouce: string;
  /** Dossier des icônes de l'app (icone.svg, icone-192.png, icone-512.png) dans apps/app/public. */
  icones: string;
  /** Partage communautaire (fiches, photos, avis) : Lazzeko oui, Kiavik non. */
  communaute: boolean;
  modules: ModuleDef[];
}

export const ESPACES: EspaceDef[] = [
  {
    slug: 'lazzeko',
    nom: 'Lazzeko',
    nomApp: 'Lazzeko Réglages',
    nomCourt: 'Lazzeko',
    domaines: ['app.lazzeko.com'],
    couleur: '#f15a21',
    couleurFoncee: '#d9480f',
    couleurDouce: '#fff1ea',
    icones: '/',
    communaute: true,
    modules: [{ slug: 'reglages-decapage', nom: 'Réglages décapage' }],
  },
  {
    slug: 'kiavik',
    nom: 'Kiavik',
    nomApp: 'Kiavik Copilot',
    nomCourt: 'Kiavik',
    domaines: ['app.kiavikcopilot.ovh'],
    // Couleurs provisoires : à remplacer par celles de Kiavik.
    couleur: '#1d6fb8',
    couleurFoncee: '#155a96',
    couleurDouce: '#e9f2fb',
    icones: '/espaces/kiavik/',
    communaute: false,
    modules: [
      { slug: 'guide-flexiprint', nom: 'Guide Flexiprint' },
      { slug: 'guide-dxonjet', nom: 'Guide DXonJet' },
      { slug: 'procedures-kiavik', nom: 'Procédures et astuces' },
    ],
  },
];

/** Module donné par défaut à un compte créé sans préciser `modules` (compatibilité avec l'automatisation Odoo). */
export const MODULE_DEFAUT = 'reglages-decapage';

export const ESPACE_DEFAUT = ESPACES[0];

export function espace(slug?: string | null): EspaceDef | undefined {
  return ESPACES.find((e) => e.slug === slug);
}

export function espaceDuModule(module: string): EspaceDef | undefined {
  return ESPACES.find((e) => e.modules.some((m) => m.slug === module));
}

export function espaceDuDomaine(hote?: string | null): EspaceDef {
  const h = (hote ?? '').split(':')[0].toLowerCase();
  return ESPACES.find((e) => e.domaines.includes(h)) ?? ESPACE_DEFAUT;
}

export const TOUS_MODULES = ESPACES.flatMap((e) => e.modules.map((m) => m.slug));

/** Espaces accessibles avec ces modules. */
export function espacesDesModules(modules: string[]): EspaceDef[] {
  return ESPACES.filter((e) => e.modules.some((m) => modules.includes(m.slug)));
}

export function modulesDeLEspace(slug: string): string[] {
  return espace(slug)?.modules.map((m) => m.slug) ?? [];
}

/** Espace d'une requête HTTP : en-tête X-Espace (envoyé par l'app), sinon l'adresse (Host). */
export function espaceDeLaRequete(req: { headers: Record<string, string | string[] | undefined> }): EspaceDef {
  const h = req.headers['x-espace'];
  const e = espace(Array.isArray(h) ? h[0] : h);
  if (e) return e;
  const hote = req.headers['x-forwarded-host'] ?? req.headers.host;
  return espaceDuDomaine(Array.isArray(hote) ? hote[0] : hote);
}
