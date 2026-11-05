# Décapage — réglages machines

App mobile pour enregistrer et partager des réglages de machines de décapage (laser, etc.).
Voir [ARCHITECTURE.md](ARCHITECTURE.md).

## Démarrer
```bash
npm install
docker compose up -d                 # PostgreSQL
cp apps/api/.env.example apps/api/.env   # puis changer JWT_SECRET et ADMIN_PASSWORD
npm run build:kit
cd apps/api && npx prisma migrate deploy && npm run seed && cd ../..
npm run api                          # http://localhost:3000/api
```

## Tests
```bash
npm run test:kit
```

## API (étape 1)
| Méthode | Route | Accès |
|---|---|---|
| POST | `/api/auth/connexion` `{identifiant, motDePasse}` | public |
| GET | `/api/moi` | connecté |
| POST | `/api/moi/mot-de-passe` `{ancien, nouveau}` | connecté |
| POST | `/api/users` `{identifiant, motDePasse, nom?, role?}` | admin **ou clé API** |
| GET / PATCH | `/api/users`, `/api/users/:id` | admin |
| POST / GET / DELETE | `/api/admin/cles-api` | admin |

Créer un compte avec une clé API :
```bash
curl -X POST http://localhost:3000/api/users \
  -H "X-Api-Key: dk_xxxxxxxx_…" -H "Content-Type: application/json" \
  -d '{"identifiant":"client1","motDePasse":"motdepasse1","nom":"Client 1"}'
```

## Ajouter une machine
1. Créer `machines/<fabricant>/<variante>/v1.json` (copier celui de Lazzeko).
2. `npm run test:kit` puis `npm run seed`.
