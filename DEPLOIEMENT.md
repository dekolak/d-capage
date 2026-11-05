# Déploiement sur Coolify + domaine OVH

## 1. DNS chez OVH
Espace client OVH → **Noms de domaine** → ton domaine → **Zone DNS** → **Ajouter une entrée** :
- type **A**, sous-domaine `reglages` (par ex.), cible = **IP du serveur Coolify**.

Compter de quelques minutes à 1 h pour la propagation.

## 2. Base de données (Coolify)
Projet → **+ New** → **Database** → **PostgreSQL**. Démarrer, puis copier l'**URL interne** (`postgres://…`).

## 3. Application (Coolify)
Projet → **+ New** → **Public/Private repository (GitHub App)** → `dekolak/d-capage`, branche `main`.
- **Build pack** : `Dockerfile`
- **Port** : `3000`
- **Domaine** : `https://reglages.ton-domaine.fr` (Coolify crée le certificat HTTPS tout seul)
- **Health check** : chemin `/api/health`

**Variables d'environnement** :
| Variable | Valeur |
|---|---|
| `DATABASE_URL` | URL interne de la base (étape 2) |
| `JWT_SECRET` | longue chaîne aléatoire (ex. `openssl rand -base64 48`) |
| `ADMIN_IDENTIFIANT` | `admin` |
| `ADMIN_PASSWORD` | mot de passe admin (8 caractères min.) |
| `UPLOAD_DIR` | `/data/uploads` |

**Stockage persistant** (onglet *Storages*) : volume monté sur `/data/uploads`, sinon les photos sont perdues à chaque redéploiement.

**Deploy**. Au démarrage : migrations → catalogue machines et tags → API + app.

## 4. Vérifier
- `https://reglages.ton-domaine.fr/api/health` → `{"ok":true}`
- Ouvrir le site sur le téléphone, se connecter avec `admin`, puis **Compte → Administration** pour créer les comptes clients.
- Sur le téléphone : menu du navigateur → **Ajouter à l'écran d'accueil**.

## 5. Sauvegardes
- Base : dans la ressource PostgreSQL de Coolify → **Backups** → activer une sauvegarde planifiée (idéalement vers un stockage S3).
- Photos : sauvegarder le volume `/data/uploads`.

## Mises à jour
Chaque merge sur `main` peut redéployer automatiquement (option *Auto Deploy* de Coolify).
Ajouter une machine = ajouter son JSON dans `machines/` puis redéployer.
