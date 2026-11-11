import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { espaceDuModule, TOUS_MODULES } from '../espaces/espaces';

/**
 * Guides Kiavik : un guide = un fichier JSON dans kit-guides/guides/ (écrans, pastilles, navigation).
 * Ajouter un guide = ajouter son JSON + son module `guide-<slug>` dans espaces.ts. Pas de base de données :
 * les fichiers sont lus au démarrage. Les images (kit-guides/images/) sont servies par /api/guides/images/.
 */
export interface Pastille {
  id: string;
  x: number;
  y: number;
  titre: string;
  texte: string;
  conseil?: string;
  niveau?: 'avertissement' | 'astuce' | 'a_completer';
  etat?: 'actif' | 'non_utilise' | 'preregle';
  zone?: { x: number; y: number; largeur: number; hauteur: number; libelle?: string };
  special?: string;
  mots_cles?: string[];
  /** Modifié dans l'app (admin). */
  corrige?: boolean;
}
export interface Ecran {
  id: string;
  code: string;
  titre: string;
  groupe: string;
  intro?: string;
  type: 'capture' | 'fenetre_recreee';
  image?: string;
  fenetre?: string;
  largeur: number;
  hauteur: number;
  pastilles: Pastille[];
  corrige?: boolean;
  /** Zone interactive (T5 : échantillon à taille réelle ; T9 : aperçu canal par canal). */
  interactif?: { type: string; images?: Record<string, string> } & Record<string, unknown>;
}
export interface Guide {
  slug: string;
  nom: string;
  /** Pour l'accueil : nom court, rôle (« Préparer le fichier »), miniature (sinon la première capture). */
  nom_court?: string;
  role?: string;
  miniature?: string;
  marque?: string;
  description?: string;
  module: string;
  ecrans: Ecran[];
  navigation?: Record<string, unknown>;
  modesBlanc?: Record<string, unknown>;
  /** Animations explicatives du guide (kit-guides/animations.json). */
  animations?: Animation[];
  fenetreBlanc?: Record<string, unknown>;
}
export interface Animation {
  id: string;
  guide: string;
  titre: string;
  resume?: string;
  image?: string;
  type: 'ecrans' | 'blanc';
  liens?: [string, string][];
  scenes: unknown[];
  photos?: Record<string, { image: string; largeur: number; hauteur: number }>;
}

const URL_IMAGES = '/api/guides/images/';

/** Dossier kit-guides : variable GUIDES_DIR, sinon cherché en remontant depuis l'API (dev, dist, Docker). */
function racineKit(): string {
  if (process.env.GUIDES_DIR) return resolve(process.env.GUIDES_DIR);
  let d = __dirname;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, 'kit-guides', 'guides'))) return join(d, 'kit-guides');
    d = dirname(d);
  }
  throw new Error('Dossier kit-guides introuvable (définir GUIDES_DIR)');
}

const urlImage = (chemin?: string) => (chemin ? URL_IMAGES + chemin.replace(/^images\//, '') : undefined);

@Injectable()
export class GuidesService implements OnModuleInit {
  private guides: Guide[] = [];
  private racine = '';

  onModuleInit() {
    this.racine = racineKit();
    const dossier = join(this.racine, 'guides');
    const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.json')).sort();
    const json = fichiers.map((f) => JSON.parse(readFileSync(join(dossier, f), 'utf8')));
    // Données annexes rattachées à un écran (ex. modes-blanc.json → écran t4 de FlexiPRINT).
    const annexes = json.filter((j) => !Array.isArray(j.ecrans) && j.ecran && Array.isArray(j.modes));
    const fichierAnim = join(this.racine, 'animations.json');
    const anims: { animations: Animation[]; fenetre_blanc?: Record<string, unknown> } = existsSync(fichierAnim)
      ? JSON.parse(readFileSync(fichierAnim, 'utf8'))
      : { animations: [] };
    this.guides = json
      .filter((j) => Array.isArray(j.ecrans))
      .map((j): Guide => {
        const module = `guide-${j.slug}`;
        if (!espaceDuModule(module)) throw new Error(`Guide ${j.slug} : module ${module} absent de espaces.ts`);
        const ecrans: Ecran[] = j.ecrans.map((e: Ecran) => ({
          ...e,
          image: urlImage(e.image),
          ...(e.interactif?.images
            ? { interactif: { ...e.interactif, images: Object.fromEntries(Object.entries(e.interactif.images).map(([k, v]) => [k, urlImage(v)!])) } }
            : {}),
        }));
        const blanc = annexes.find((a) => ecrans.some((e) => e.id === a.ecran));
        const animations = anims.animations
          .filter((a) => a.guide === j.slug)
          .map((a) => ({
            ...a,
            image: urlImage(a.image),
            ...(a.photos ? { photos: Object.fromEntries(Object.entries(a.photos).map(([k, ph]) => [k, { ...ph, image: urlImage(ph.image)! }])) } : {}),
          }));
        return {
          ...j,
          module,
          ecrans,
          animations,
          fenetreBlanc: animations.length ? anims.fenetre_blanc : undefined,
          modesBlanc: blanc && {
            ...blanc,
            modes: blanc.modes.map((m: { image_canal?: string; image_mur?: string }) => ({
              ...m,
              image_canal: urlImage(m.image_canal),
              image_mur: urlImage(m.image_mur),
            })),
          },
        };
      })
      // même ordre que les modules dans espaces.ts (FlexiPRINT avant DXonJet : on prépare, puis on imprime)
      .sort((a, b) => TOUS_MODULES.indexOf(a.module) - TOUS_MODULES.indexOf(b.module));
  }

  /** Guides accessibles avec ces modules (admin : tous). */
  lister(modules: string[] | 'tous') {
    return this.guides
      .filter((g) => modules === 'tous' || modules.includes(g.module))
      .map(({ slug, nom, nom_court, role, miniature, description, module, ecrans, animations }) => ({
        slug, nom, nomCourt: nom_court ?? nom, role: role ?? null, description, module, ecrans: ecrans.length,
        miniature: urlImage(miniature) ?? ecrans.find((e) => e.type === 'capture' && e.image)?.image ?? null,
        animations: (animations ?? []).map(({ id, titre, resume, image, scenes }) => ({ id, titre, resume, image, nbScenes: scenes.length })),
      }));
  }

  /** Guide tel que dans les fichiers (sans les corrections faites dans l'app). */
  brut(slug: string): Guide {
    const g = this.guides.find((x) => x.slug === slug);
    if (!g) throw new NotFoundException('Guide introuvable');
    return g;
  }

  /** Guide complet ; les conseils « à compléter » (notes internes) ne sont envoyés qu'à l'admin. */
  guide(slug: string, admin: boolean): Guide {
    const g = this.brut(slug);
    return admin ? g : this.pourClient(g);
  }

  /** Retire les notes internes (conseils « à compléter »). */
  pourClient(g: Guide): Guide {
    return {
      ...g,
      ecrans: g.ecrans.map((e) => ({
        ...e,
        pastilles: e.pastilles.map((p) => {
          if (p.niveau !== 'a_completer') return p;
          const { conseil: _c, niveau: _n, ...reste } = p;
          return reste;
        }),
      })),
    };
  }

  /** Le lien guide / écran / pastille existe-t-il ? (pastille d'écran ou bouton de navigation, ex. E, D8) */
  /** Libellé lisible d'un lien vers un bouton : « Pompe à encre » — DXonJet, écran DC, P.9. */
  libelleLien(guide: string, ecran: string, pastille?: string | null): string {
    const g = this.guides.find((x) => x.slug === guide);
    const e = g?.ecrans.find((x) => x.id === ecran);
    const p = pastille ? e?.pastilles.find((x) => x.id === pastille) : undefined;
    const ou = [g?.nom.split(' ')[0] ?? guide, `écran ${e?.code ?? ecran}`, pastille].filter(Boolean).join(', ');
    return p ? `« ${p.titre} » — ${ou}` : e ? `écran « ${e.titre} » — ${ou}` : ou;
  }

  lienValide(guide: string, ecran: string, pastille?: string | null): boolean {
    const g = this.guides.find((x) => x.slug === guide);
    const e = g?.ecrans.find((x) => x.id === ecran);
    if (!g || !e) return false;
    if (!pastille || e.pastilles.some((p) => p.id === pastille)) return true;
    const n = (g.navigation ?? {}) as { boutons_bas?: Record<string, unknown>; menus_haut?: { boutons: { code: string }[] } };
    return Object.keys(n.boutons_bas ?? {}).some((k) => k !== 'reference' && k === pastille) || !!n.menus_haut?.boutons.some((b) => b.code === pastille);
  }

  /** Chemin d'une image du kit (null si en dehors du dossier ou absente). */
  cheminImage(relatif: string): string | null {
    const base = join(this.racine, 'images');
    const chemin = resolve(base, relatif);
    if (!chemin.startsWith(base + sep) || !existsSync(chemin)) return null;
    return chemin;
  }
}
