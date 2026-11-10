import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { espaceDuModule } from '../espaces/espaces';

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
}
export interface Guide {
  slug: string;
  nom: string;
  marque?: string;
  description?: string;
  module: string;
  ecrans: Ecran[];
  navigation?: Record<string, unknown>;
  modesBlanc?: Record<string, unknown>;
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
    this.guides = json
      .filter((j) => Array.isArray(j.ecrans))
      .map((j): Guide => {
        const module = `guide-${j.slug}`;
        if (!espaceDuModule(module)) throw new Error(`Guide ${j.slug} : module ${module} absent de espaces.ts`);
        const ecrans: Ecran[] = j.ecrans.map((e: Ecran) => ({ ...e, image: urlImage(e.image) }));
        const blanc = annexes.find((a) => ecrans.some((e) => e.id === a.ecran));
        return {
          ...j,
          module,
          ecrans,
          modesBlanc: blanc && {
            ...blanc,
            modes: blanc.modes.map((m: { image_canal?: string; image_mur?: string }) => ({
              ...m,
              image_canal: urlImage(m.image_canal),
              image_mur: urlImage(m.image_mur),
            })),
          },
        };
      });
  }

  /** Guides accessibles avec ces modules (admin : tous). */
  lister(modules: string[] | 'tous') {
    return this.guides
      .filter((g) => modules === 'tous' || modules.includes(g.module))
      .map(({ slug, nom, description, module, ecrans }) => ({ slug, nom, description, module, ecrans: ecrans.length }));
  }

  /** Guide complet ; les conseils « à compléter » (notes internes) ne sont envoyés qu'à l'admin. */
  guide(slug: string, admin: boolean): Guide {
    const g = this.guides.find((x) => x.slug === slug);
    if (!g) throw new NotFoundException('Guide introuvable');
    if (admin) return g;
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

  /** Chemin d'une image du kit (null si en dehors du dossier ou absente). */
  cheminImage(relatif: string): string | null {
    const base = join(this.racine, 'images');
    const chemin = resolve(base, relatif);
    if (!chemin.startsWith(base + sep) || !existsSync(chemin)) return null;
    return chemin;
  }
}
