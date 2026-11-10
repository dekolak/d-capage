# Consignes pour Claude Code

Projet d-capage : une app (PWA) pour deux sociétés, **Lazzeko** (réglages des nettoyeurs laser) et **Kiavik** (guides et procédures).
Lire d'abord [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et [docs/BONNES-PRATIQUES.md](docs/BONNES-PRATIQUES.md).

## Avec l'utilisateur
- Répondre en français, simplement et brièvement.
- Faire le travail demandé sans redemander ; ne poser une question que si on est bloqué.
- Si on lui demande un **avis** (« on code rien pour l'instant »), donner l'avis et attendre son feu vert avant de coder.

## Travail
- Branche `claude/<sujet>` depuis `origin/main`, commit, push, pull request, fusion *squash* une fois les tests verts.
- Avant de fusionner : `npm run test:kit`, `npm run test:e2e`, `npx tsc --noEmit -p apps/app`, et vérification dans le navigateur pour un changement visible.
- Migration Prisma : nommée, reprend les données existantes, testée sur base vide ; ne jamais modifier une migration déjà fusionnée.
- Nouvelle fonction d'un espace : un **module** (`apps/api/src/espaces/espaces.ts`), `@ModuleRequis` côté API, écrans dans `apps/app/src/espaces/<espace>/`.
- Pas de couleur ni de nom de société en dur dans les écrans communs (variables CSS, `useEspace()`).
- Pas de texte en dur dans les écrans clients : clé dans `apps/app/src/textes/fr.ts` + `t()` (voir [docs/TRADUCTION.md](docs/TRADUCTION.md)). L'administration reste en français.
- Mettre à jour la doc (`README.md`, `docs/`) dans la même pull request.

## Base locale
`docker compose up -d db` (ou `service postgresql start`) ; base `decapage` (utilisateur `decapage` / `decapage`) ; une base vide (ex. `decapage_ombre`) sert à `prisma migrate diff`.
API : `cd apps/api && npm run build && node dist/main` ; app : `cd apps/app && npx vite --port 5173`.
