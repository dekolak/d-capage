# Décapage — réglages machines

App mobile (PWA) pour enregistrer et partager des réglages de machines de décapage (laser, etc.).
Voir [ARCHITECTURE.md](ARCHITECTURE.md).

## Démarrer en local
```bash
npm install
docker compose up -d db                  # PostgreSQL
cp apps/api/.env.example apps/api/.env   # puis changer JWT_SECRET et ADMIN_PASSWORD
npm run build:kit
cd apps/api && npx prisma migrate deploy && npm run seed && cd ../..
npm run api                              # API  http://localhost:3000/api
npm run app                              # App  http://localhost:5173 (accessible depuis le téléphone sur le même wifi)
```

## Mettre en ligne
Sur le VPS (Coolify + Traefik n8n + OVH) : voir [DEPLOIEMENT.md](DEPLOIEMENT.md), fichier `docker-compose.prod.yml`.

Un seul service : l'API sert aussi l'app compilée.
```bash
JWT_SECRET=… ADMIN_PASSWORD=… docker compose --profile prod up -d --build
```
Au démarrage : migrations, puis seed (catalogue machines + tags, idempotent), puis l'API sur le port 3000.
Mettre un HTTPS devant (obligatoire pour l'installation en PWA et l'appareil photo).

## Tests
```bash
npm run test:kit     # configs machines + calculs
npm run test:e2e     # parcours complet de l'API (base locale, seed lancé)
```

## Utilisation
1. **Admin** : se connecter avec le compte du seed → Compte → Administration (créer des comptes, attribuer des machines, clés API, valider les tags proposés).
2. **Client** : Mes machines → ajouter sa machine, puis **+ Nouvelle** :
   machine → surface (tags) → photo avant → réglages (miroir de l'écran) → photo de l'écran → photo après, note, partage.
3. **Communauté** : réglages partagés, filtrés par machine et tags, triés par note ; « Dupliquer » pour partir d'un réglage existant.

## API
| Méthode | Route | Accès |
|---|---|---|
| POST | `/api/auth/connexion` `{identifiant, motDePasse}` | public |
| GET · POST | `/api/moi`, `/api/moi/mot-de-passe` | connecté |
| POST | `/api/users` `{identifiant, motDePasse, nom?, role?}` | admin **ou clé API** |
| GET · PATCH | `/api/users`, `/api/users/:id` | admin |
| GET · POST | `/api/users/:id/machines` `{varianteId, surnom?}` | admin **ou clé API** |
| POST · GET · DELETE | `/api/admin/cles-api` | admin |
| GET | `/api/catalogue`, `/api/catalogue/versions/:id` | connecté |
| GET · POST · PATCH · DELETE | `/api/moi/machines` | connecté |
| GET · POST | `/api/tags` (proposer un tag) · PATCH `/api/tags/:id` (admin) | connecté |
| GET · POST | `/api/fiches` · GET/PATCH/DELETE `/api/fiches/:id` | connecté (auteur pour modifier) |
| POST · DELETE | `/api/fiches/:id/evaluation` `{note 1–5, avis?}` | connecté |
| GET | `/api/communaute?varianteId=&modeleId=&tags=id1,id2&tri=note\|recent` | connecté |
| POST | `/api/fiches/:id/photos` (multipart `fichier`, `miniature`, `type`) | auteur |
| GET · PATCH · DELETE | `/api/photos/:id[?taille=min]` | selon visibilité de la fiche |
| GET | `/api/admin/avis?statut=VISIBLE\|EN_ATTENTE\|MASQUE&q=` | admin **ou clé API** |
| PATCH | `/api/admin/avis/:id` `{statut, raison?}` | admin **ou clé API** |
| PATCH | `/api/admin/fiches/:id` `{masquee, raison?}` | admin **ou clé API** |
| GET · POST · PATCH · DELETE | `/api/admin/webhooks` (+ `/:id/test`, `/:id/livraisons`) | admin |
| GET | `/api/catalogue/modeles/:id/image`, `/api/catalogue/variantes/:id/image` | public (miniature) |
| POST · DELETE | idem, champ multipart `image` (PNG conseillé, 5 Mo max) | admin |
| GET | `/api/top?varianteId=` (3 meilleurs réglages par tag) | connecté |
| GET · PATCH | `/api/parametres`, `/api/admin/parametres` `{aideSupport}` | connecté · admin |
| POST | `/api/fiches/:id/aide` `{message}` (si `aideSupport` activé) | connecté |
| GET · PATCH | `/api/admin/aide`, `/api/admin/aide/:id` `{traitee}` | admin **ou clé API** |

## Miniatures des machines
Administration → **Machines** : envoyer un PNG par modèle (machine entière, fond transparent ou clair, ~800 × 800 px).
Une variante peut avoir sa propre image, sinon elle reprend celle du modèle. Sans image, l'app affiche une illustration par défaut.

## Accord pour les photos
À l'enregistrement d'une fiche avec photos, l'auteur peut cocher « J'accepte que Lazzeko utilise mes photos ». Filtre admin : Toutes les fiches → **📷 Photos utilisables**.
À compléter dans vos conditions d'utilisation / politique de confidentialité (usage des photos, retrait de l'accord).

## Modération et envoi vers une API (IA)
- Chaque **nouvelle fiche**, **fiche modifiée**, **nouvel avis** ou **avis modifié** peut être envoyé en `POST` JSON à une ou plusieurs adresses (Administration → *Envoi vers une API*).
- Chaque envoi est signé : en-tête `X-Decapage-Signature: sha256=<HMAC-SHA256(secret, corps)>`, plus `X-Decapage-Evenement` et `X-Decapage-Livraison`.
- File d'envoi en base : rien n'est perdu au redémarrage, 6 tentatives espacées (jusqu'à 2 h), journal visible dans l'admin.
- Le corps contient le texte à modérer et l'adresse pour agir (`moderation.url`). Le service répond en appelant, avec une **clé API** :
```bash
curl -X PATCH https://app.lazzeko.com/api/admin/avis/<id> -H "X-Api-Key: dk_…" \
  -H "Content-Type: application/json" -d '{"statut":"MASQUE","raison":"hors sujet"}'
```
- `MODERATION_PREALABLE_AVIS=true` : les avis avec texte restent *en attente* jusqu'à validation (`statut: VISIBLE`).
- Un avis masqué n'est plus visible (sauf par son auteur, qui voit la raison) et ne compte plus dans la moyenne.

Créer un compte et lui attribuer une machine avec une clé API :
```bash
curl -X POST https://…/api/users -H "X-Api-Key: dk_…" -H "Content-Type: application/json" \
  -d '{"identifiant":"client1","motDePasse":"motdepasse1","nom":"Client 1"}'
curl -X POST https://…/api/users/<id>/machines -H "X-Api-Key: dk_…" -H "Content-Type: application/json" \
  -d '{"varianteId":"<id du catalogue>"}'
```

## Ajouter une machine
1. Créer `machines/<fabricant>/<variante>/v1.json` (copier celui de Lazzeko).
2. `npm run test:kit` puis `npm run seed` (ou redémarrer le conteneur).
Si le fabricant change son menu : nouveau fichier `v2.json` ; les anciennes fiches restent sur `v1`.
