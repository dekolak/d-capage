# d-capage — app Lazzeko & Kiavik

Une seule app mobile (PWA), une seule base, un seul admin, **deux espaces** :

| Espace | Adresse | Contenu |
|---|---|---|
| **Lazzeko** | https://app.lazzeko.com | Réglages des nettoyeurs laser (miroir de l'écran machine, photos, note), communauté, aide aux réglages |
| **Kiavik** | https://app.kiavikcopilot.ovh | Guides logiciels FlexiPRINT et DXonJet, recherche, procédures |

## Documentation
| Document | Pour qui | Contenu |
|---|---|---|
| [docs/ADMIN.md](docs/ADMIN.md) | Admin | Utiliser l'administration : comptes, accès, messages, modération, conditions |
| [docs/API.md](docs/API.md) | Intégrations (Odoo, IA) | Routes, clé API, webhooks, exemples |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Développement | Structure, données, espaces, machines |
| [docs/BONNES-PRATIQUES.md](docs/BONNES-PRATIQUES.md) | Développement | Règles du projet : branches, migrations, tests, ajouter une machine / un module |
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | Mise en ligne | VPS, Coolify, Traefik, DNS OVH, sauvegardes |
| [kit-guides/](kit-guides/) | Développement Kiavik | Cahier des charges et données des guides |
| [docs/presentation-app.html](docs/presentation-app.html) | Clients | Présentation animée de l'app Lazzeko |

## Démarrer en local
Prérequis : Node 22, Docker (ou PostgreSQL 16).
```bash
npm install
docker compose up -d db                  # PostgreSQL
cp apps/api/.env.example apps/api/.env   # puis changer JWT_SECRET et ADMIN_PASSWORD
npm run build:kit
cd apps/api && npx prisma migrate deploy && npm run seed && cd ../..
npm run api                              # API  http://localhost:3000/api
npm run app                              # App  http://localhost:5173 (accessible depuis le téléphone sur le même wifi)
```
En local, l'app s'ouvre sur l'espace Lazzeko ; l'admin passe à Kiavik par **Compte → Mes espaces**.

## Tests
```bash
npm run test:kit     # configs machines + calculs
npm run test:e2e     # parcours complet de l'API (base locale, seed lancé)
```

## Mettre en ligne
Merge sur `main` puis **Redeploy** dans Coolify. Au démarrage du conteneur : migrations, seed (idempotent), API.
Détails : [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).
