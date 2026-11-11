/**
 * Seed idempotent (relançable sans risque) :
 *  1. compte admin (ADMIN_IDENTIFIANT / ADMIN_PASSWORD) s'il n'existe pas ;
 *  2. catalogue : chaque fichier machines/<fabricant>/<variante>/v<N>.json est validé puis publié ;
 *  3. groupes de tags et tags de départ ;
 *  4. procédures Kiavik de départ (kit-guides/procedures.json), créées seulement si leur clé n'existe pas
 *     (elles se modifient ensuite dans l'app : le seed ne les écrase jamais) ;
 *  5. fiches « Astuces & solutions » de départ (kit-guides/solutions.json), même principe.
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { chargerConfig } from '@decapage/machine-kit';
import * as bcrypt from 'bcryptjs';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();
const RACINE_MACHINES = join(__dirname, '../../../machines');
const RACINE_KIT = join(__dirname, '../../../kit-guides');

const TAGS: { slug: string; nom: string; tags: [string, string][] }[] = [
  {
    slug: 'materiau',
    nom: 'Matériau',
    tags: [
      ['acier', 'Acier'], ['inox', 'Acier inox'], ['aluminium', 'Aluminium'], ['fonte', 'Fonte'],
      ['cuivre-laiton', 'Cuivre / laiton'], ['bois', 'Bois'], ['pierre', 'Pierre'], ['beton', 'Béton'],
      ['plastique-composite', 'Plastique / composite'],
    ],
  },
  {
    slug: 'a-enlever',
    nom: 'À enlever',
    tags: [
      ['peinture', 'Peinture'], ['rouille', 'Rouille'], ['oxyde', 'Couche d\'oxyde'], ['graisse', 'Graisse / huile'],
      ['calamine', 'Calamine'], ['vernis', 'Vernis'], ['colle', 'Colle'], ['suie', 'Suie / calcination'],
    ],
  },
  {
    slug: 'application',
    nom: 'Application',
    tags: [
      ['degraissage', 'Dégraissage'], ['derouillage', 'Dérouillage'], ['soudure', 'Préparation / nettoyage soudure'],
      ['moule', 'Nettoyage de moule'], ['decapage-peinture', 'Décapage peinture'], ['restauration', 'Restauration'],
    ],
  },
];

function fichiersConfig(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return fichiersConfig(p);
    return /^v\d+\.json$/.test(n) ? [p] : [];
  });
}

async function admin() {
  const identifiant = (process.env.ADMIN_IDENTIFIANT ?? 'admin').toLowerCase();
  const motDePasse = process.env.ADMIN_PASSWORD;
  if (await prisma.user.findUnique({ where: { identifiant } })) return console.log(`Admin « ${identifiant} » déjà présent`);
  if (!motDePasse || motDePasse.length < 8) throw new Error('ADMIN_PASSWORD (8 caractères min.) requis pour créer l\'admin');
  await prisma.user.create({
    data: { identifiant, passwordHash: await bcrypt.hash(motDePasse, 12), role: 'ADMIN', nom: 'Administrateur' },
  });
  console.log(`Admin « ${identifiant} » créé`);
}

async function catalogue() {
  for (const f of fichiersConfig(RACINE_MACHINES)) {
    const cfg = chargerConfig(JSON.parse(readFileSync(f, 'utf8')));
    const tech = await prisma.technologie.upsert({
      where: { slug: cfg.technologie },
      update: {},
      create: { slug: cfg.technologie, nom: cfg.technologie },
    });
    const fab = await prisma.fabricant.upsert({
      where: { slug: cfg.fabricant.slug },
      update: { nom: cfg.fabricant.nom },
      create: cfg.fabricant,
    });
    const modele = await prisma.modele.upsert({
      where: { fabricantId_slug: { fabricantId: fab.id, slug: cfg.modele.slug } },
      update: { nom: cfg.modele.nom },
      create: { ...cfg.modele, fabricantId: fab.id, technologieId: tech.id },
    });
    const variante = await prisma.variante.upsert({
      where: { modeleId_slug: { modeleId: modele.id, slug: cfg.variante.slug } },
      update: { nom: cfg.variante.nom },
      create: { ...cfg.variante, modeleId: modele.id },
    });
    // Une version publiée ne change plus de numéro ; on met à jour son contenu
    // (corrections de libellés, d'aide…). Changement de menu = nouveau fichier vN+1.
    await prisma.versionInterface.upsert({
      where: { varianteId_numero: { varianteId: variante.id, numero: cfg.versionInterface } },
      update: { config: cfg as unknown as Prisma.InputJsonValue },
      create: { varianteId: variante.id, numero: cfg.versionInterface, config: cfg as unknown as Prisma.InputJsonValue },
    });
    console.log(`Machine : ${cfg.fabricant.nom} ${cfg.modele.nom} ${cfg.variante.nom} v${cfg.versionInterface}`);
  }
}

async function tags() {
  for (const [ordre, g] of TAGS.entries()) {
    const groupe = await prisma.groupeTag.upsert({
      where: { slug: g.slug },
      update: { nom: g.nom, ordre },
      create: { slug: g.slug, nom: g.nom, ordre },
    });
    for (const [slug, nom] of g.tags)
      await prisma.tag.upsert({
        where: { groupeId_slug: { groupeId: groupe.id, slug } },
        update: { nom },
        create: { slug, nom, groupeId: groupe.id },
      });
  }
  console.log(`Tags : ${TAGS.reduce((n, g) => n + g.tags.length, 0)}`);
}

interface EtapeSeed { texte: string; avertissement?: string; lien?: [string, string, string] }
interface ProcedureSeed { cle: string; titre: string; categorie: string; resume?: string; publiee?: boolean; etapes: EtapeSeed[] }

async function procedures() {
  const fichier = join(RACINE_KIT, 'procedures.json');
  if (!existsSync(fichier)) return;
  const liste: ProcedureSeed[] = JSON.parse(readFileSync(fichier, 'utf8')).procedures;
  let crees = 0;
  for (const [i, p] of liste.entries()) {
    if (await prisma.procedure.findUnique({ where: { cle: p.cle } })) continue;
    await prisma.procedure.create({
      data: {
        cle: p.cle, titre: p.titre, categorie: p.categorie, resume: p.resume, publiee: p.publiee ?? false, ordre: i,
        etapes: {
          create: p.etapes.map((e, n) => ({
            ordre: n, texte: e.texte, avertissement: e.avertissement,
            guide: e.lien?.[0], ecran: e.lien?.[1], pastille: e.lien?.[2],
          })),
        },
      },
    });
    crees++;
  }
  console.log(`Procédures : ${crees} créée(s), ${liste.length - crees} déjà présente(s)`);
}

interface SolutionSeed {
  cle: string; titre: string; categorie: string; cause?: string; texte: string; avertissement?: string;
  motsCles?: string[]; lien?: [string, string, string]; publiee?: boolean;
}

async function solutions() {
  const fichier = join(RACINE_KIT, 'solutions.json');
  if (!existsSync(fichier)) return;
  const liste: SolutionSeed[] = JSON.parse(readFileSync(fichier, 'utf8')).solutions;
  let crees = 0;
  for (const [i, s] of liste.entries()) {
    if (await prisma.solution.findUnique({ where: { cle: s.cle } })) continue;
    await prisma.solution.create({
      data: {
        cle: s.cle, titre: s.titre, categorie: s.categorie, cause: s.cause, texte: s.texte, avertissement: s.avertissement,
        motsCles: s.motsCles ?? [], guide: s.lien?.[0], ecran: s.lien?.[1], pastille: s.lien?.[2], publiee: s.publiee ?? false, ordre: i,
      },
    });
    crees++;
  }
  console.log(`Astuces & solutions : ${crees} créée(s), ${liste.length - crees} déjà présente(s)`);
}

admin()
  .then(catalogue)
  .then(tags)
  .then(procedures)
  .then(solutions)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
