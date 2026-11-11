# Bonnes pratiques du projet

## Principes
1. **Une seule app** pour Lazzeko et Kiavik : une base, un admin. On ne duplique pas, on ajoute un espace ou un module.
2. **Piloté par la configuration** : une machine = un fichier JSON, un espace / module = une entrée dans `espaces.ts`. Pas de cas particulier écrit en dur dans le code.
3. **Même code partout** : la validation et les calculs des réglages sont dans `packages/machine-kit`, utilisés par l'API et l'app.
4. **Simple pour le client** : écrans mobiles, gros boutons, textes courts, pas de jargon. Français de référence, app prête à être traduite.
5. **Rien n'est perdu** : migrations qui reprennent les données, brouillon local des fiches, file d'envoi des webhooks en base.

## Organisation du code
| Où | Quoi |
|---|---|
| `packages/machine-kit` | schéma des configs machine, validation, calculs (un fichier par technologie) |
| `machines/<fabricant>/<variante>/v<N>.json` | configs machines |
| `apps/api/src/<domaine>/` | un dossier NestJS par domaine : `*.controller.ts` (routes), `*.service.ts` (logique), `*.dto.ts` (validation) |
| `apps/api/src/espaces/espaces.ts` | espaces et modules |
| `apps/api/prisma/` | schéma, migrations, seed |
| `apps/app/src/espaces/<espace>/` | écrans et barre du bas propres à un espace |
| `apps/app/src/pages`, `components`, `lib` | écrans communs ou Lazzeko, composants, accès API / auth / espace |
| `docs/` | documentation ; `kit-guides/` : données et cahier des charges Kiavik |

## Règles API
- **Tout est protégé par défaut** (garde globale). Ouvrir une route : `@Public()`. Restreindre : `@Roles(Role.ADMIN)`.
- **Route d'un module** : `@ModuleRequis('<module>')` sur le contrôleur. Le module donne l'espace, donc les conditions à accepter.
- **Clé API** : seulement si la route porte `@AutoriseCleApi()`.
- **Routes du compte** (avant acceptation des conditions) : `@SansConditions()`.
- **Toute entrée passe par un DTO** `class-validator` (champs inconnus refusés). Les messages d'erreur sont en français.
- Les **mots de passe et clés** ne sont jamais stockés en clair (bcrypt, hash). Ne jamais logger un jeton ou une clé.
- Les **événements externes** (webhooks) partent en arrière-plan et ne bloquent jamais l'utilisateur.

## Base de données (Prisma)
- Modifier `schema.prisma`, puis créer une migration **nommée** dans `prisma/migrations/<date>_<nom>/migration.sql`.
- Une migration doit **reprendre les données existantes** (ex. comptes existants → module `reglages-decapage`). La tester sur une base vide **et** sur une copie de la base de dev.
- Pour générer le SQL sans invite (suppression de colonnes…) :
  ```bash
  cd apps/api
  npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url <base vide> --script > prisma/migrations/<date>_<nom>/migration.sql
  npx prisma migrate deploy
  ```
- **Ne jamais modifier une migration déjà en production.** En corriger une = nouvelle migration.
- Le **seed** doit rester idempotent : il est relancé à chaque démarrage du conteneur.
- Les slugs d'espaces et de modules sont stockés en texte : ne pas renommer un slug existant (sinon migration de données).

## Règles app
- Appels serveur uniquement via `api()` (`lib/api.ts`) : jeton, en-tête `X-Espace`, déconnexion et conditions gérés au même endroit.
- Couleurs via les variables CSS (`--o`, `--od`, `--o-doux`) : jamais de couleur de marque en dur (elles changent selon l'espace).
- Nom de la société via `useEspace().espace.nom`, pas « Lazzeko » écrit en dur dans un écran commun.
- Cases à cocher qui enregistrent tout de suite : mise à jour **optimiste** (affichage immédiat, retour arrière si erreur).
- Photos : compressées sur le téléphone avant envoi (les métadonnées GPS sont supprimées).
- **Textes** : aucun texte en dur dans un écran client. Ajouter la clé dans `src/textes/fr.ts` (groupée par écran) et utiliser `t()` / `tn()` (pluriel) / `tr()` (avec un lien ou du gras) ; dates avec `dateCourte()` / `dateHeure()`. Voir [TRADUCTION.md](TRADUCTION.md). Les écrans d'administration restent en français.

## Recettes
### Ajouter une machine
1. Copier `machines/lazzeko/laser-pulse-300w/v1.json` dans `machines/<fabricant>/<variante>/v1.json` et l'adapter.
2. `npm run test:kit`, puis `npm run seed` (en production : redéployer).
3. Si le fabricant change son menu : nouveau fichier `v2.json`. Les anciennes fiches restent sur `v1`.

### Ajouter un module (ex. un nouveau guide Kiavik)
1. Ajouter `{ slug, nom }` dans `modules` de l'espace (`apps/api/src/espaces/espaces.ts`).
2. API : nouveau dossier `apps/api/src/<module>/`, contrôleur avec `@ModuleRequis('<slug>')`, l'ajouter dans `app.module.ts`.
3. App : écran dans `apps/app/src/espaces/<espace>/`, route et onglet dans `index.tsx` de l'espace.
4. Test e2e : un compte sans le module reçoit `403 MODULE_NON_AUTORISE`.
5. L'admin coche le module sur les comptes concernés.

### Ajouter ou corriger un guide Kiavik
Les petites corrections (textes, sous-titres, photos d'animation) se font **dans l'app** par l'admin (voir [ADMIN.md](ADMIN.md)). Une correction faite dans l'app reste prioritaire sur le fichier : si on modifie aussi le fichier, penser à « Revenir à l'original » dans l'app.

1. Corriger / ajouter `kit-guides/guides/<slug>.json` (images dans `kit-guides/images/`). Pastilles en pixels de l'image. Pour la recherche, ajouter à une pastille `"mots_cles": ["bouché", "pause"]` (mots du client, synonymes).
2. Nouveau guide : module `guide-<slug>` dans l'espace Kiavik (`espaces.ts`), sinon l'API refuse de démarrer.
3. Redéployer (les fichiers sont lus au démarrage), vérifier sur téléphone.

### Animations Kiavik
- Modifier un sous-titre ou une durée : `kit-guides/animations.json` (champ `cap`, `d` en ms), puis redéployer. Le sous-titre est aussi la phrase lue par la voix off.
- Lier une animation à un bouton : ajouter `["<écran>", "<pastille>"]` dans ses `liens`.
- Nouvelle animation à partir d'une vidéo : tirer les images utiles avec `ffmpeg` (`-ss <seconde> -frames:v 1 -vf crop=…`), les mettre dans `kit-guides/images/`, les déclarer dans `photos` ; les étapes sur le logiciel utilisent les captures du guide (coordonnées en pixels de la capture ou de la photo). Une photo peu lisible au téléphone peut être remplacée par une image simulée (SVG dans `kit-guides/images/`). Faire valider les étapes par Teddy.

### Procédures Kiavik
- Elles se créent dans l'app (Administration → Procédures) : rien à déployer.
- `kit-guides/procedures.json` ne sert qu'au départ (base vide) : modifier ce fichier ne change pas une procédure déjà créée.

### Ajouter un espace
1. Entrée dans `ESPACES` (`espaces.ts`) : slug, noms, adresse, couleurs, icônes, communauté, modules.
2. Icônes dans `apps/app/public/espaces/<slug>/` (`icone.svg`, `icone-192.png`, `icone-512.png`).
3. Texte de conditions par défaut dans `apps/api/src/parametres/conditions-defaut.ts`.
4. `apps/app/src/espaces/<slug>/index.tsx` + l'ajouter dans `apps/app/src/espaces/index.ts`.
5. Adresse : règle Traefik dans `docker-compose.prod.yml` + DNS (voir [DEPLOIEMENT.md](DEPLOIEMENT.md)).

## Tests
| Commande | Quand |
|---|---|
| `npm run test:kit` | après toute modification d'une config machine ou des calculs |
| `npm run test:e2e` | avant chaque fusion (base locale, seed lancé) |
| `npx tsc --noEmit -p apps/app` | après une modification de l'app |

- Chaque nouvelle fonction a son scénario dans `apps/api/test/parcours.e2e-spec.ts` : cas permis **et** cas refusé.
- Données de test uniques par lancement (suffixe `id`) et nettoyées à la fin du test (messages, paramètres).
- Changement visible : vérifier dans le navigateur en format téléphone (390 × 844), avec un compte client **et** l'admin.

## Git et mise en ligne
1. Une branche par sujet depuis `main` : `claude/<sujet>` ou `<prénom>/<sujet>`.
2. Commits en français, titre court qui dit ce que ça change pour l'utilisateur.
3. Pull request → tests verts → fusion *squash* sur `main`.
4. Coolify → **Redeploy** (migrations et seed se lancent seuls). Vérifier `/api/health`.
5. Mettre à jour la doc concernée dans la même pull request.

## Sécurité et données
- Secrets uniquement dans les variables d'environnement (Coolify). Jamais dans le code ni dans un commit.
- `JWT_SECRET` ne change plus une fois en production (sinon tout le monde est déconnecté).
- Changer le mot de passe admin du seed après la première connexion.
- Les photos ne sortent de l'app que pour les comptes qui ont donné l'**accord photos**.
- Sauvegarder la base et les photos (voir [DEPLOIEMENT.md](DEPLOIEMENT.md)).
