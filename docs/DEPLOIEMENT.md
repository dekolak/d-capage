# Déploiement : Coolify + Traefik n8n + domaines OVH

Une seule app sert `app.lazzeko.com` (Lazzeko) et `app.kiavikcopilot.ovh` (Kiavik).

## Contexte du VPS
Le VPS fait déjà tourner **n8n avec son propre Traefik** (`n8n-compose-traefik-1`) sur les ports 80/443,
avec des webhooks en production. Le proxy de Coolify (`coolify-proxy`) ne peut pas démarrer
(« Port 80 is in use ») et **doit rester arrêté**.
L'app est donc routée par le **Traefik de n8n** via les labels de `docker-compose.prod.yml`
(même méthode que le projet pose). Rien n'est modifié côté n8n.

## 1. DNS chez OVH
Zone DNS de `lazzeko.com` → entrée **A** `app` → `51.178.183.183` (IP du VPS, sans port).

## 2. Ressource Coolify
**+ New** → **Private Repository (with GitHub App)** → `dekolak/d-capage`, branche `main`.
- **Build pack** : `Docker Compose`
- **Docker Compose file** : `/docker-compose.prod.yml`
- **Domains** : **laisser vide** (sinon Coolify active son propre proxy).

La base PostgreSQL est incluse dans ce compose (service `db`) : pas besoin de ressource PostgreSQL séparée.

## 3. Variables d'environnement
| Variable | Valeur |
|---|---|
| `POSTGRES_PASSWORD` | mot de passe de la base (aléatoire, long) |
| `JWT_SECRET` | longue chaîne aléatoire — ne plus la changer ensuite |
| `ADMIN_PASSWORD` | mot de passe du 1er compte admin (8 caractères min.) |
| `ADMIN_IDENTIFIANT` | facultatif, `admin` par défaut |
| `PUBLIC_URL` | facultatif, `https://app.lazzeko.com` par défaut (liens envoyés aux webhooks) |
| `MODERATION_PREALABLE_AVIS` | facultatif, `true` = avis avec texte en attente jusqu'à validation |

Le compte admin n'est créé qu'au premier démarrage.

## 4. Proxy Coolify
**Servers → localhost → Proxy** : il doit rester **arrêté** (Stop Proxy s'il tente de démarrer).

## 5. Déployer et vérifier
**Deploy**, puis :
- `https://app.lazzeko.com/api/health` → `{"ok":true}`
- `https://app.lazzeko.com` → page de connexion (certificat émis par le Traefik n8n, `mytlschallenge`).

Données persistantes : volumes Docker `decapage_db` (base) et `decapage_uploads` (photos).

## 6. Sauvegardes
La base est dans le compose : sauvegarde par tâche planifiée Coolify (*Scheduled Tasks*, service `db`) :
```
pg_dump -U decapage decapage > /var/lib/postgresql/data/sauvegarde.sql
```
ou sauvegarde des volumes `decapage_db` et `decapage_uploads` au niveau du VPS.

## Mises à jour
Merge sur `main` → **Redeploy** (ou *Auto Deploy*). Au démarrage : migrations, seed (idempotent), API.
Ajouter une machine = un JSON dans `machines/` + redéployer.
Après une mise à jour avec migration : faire une sauvegarde **avant** le Redeploy.

## Deuxième adresse : Kiavik (app.kiavikcopilot.ovh)
La même app sert les deux espaces : l'adresse choisit la marque (nom, couleur, icône).
1. OVH → zone DNS de `kiavikcopilot.ovh` → entrée **A** `app` → `51.178.183.183`.
2. Rien à changer dans Coolify : la règle Traefik de `docker-compose.prod.yml` contient déjà les deux adresses. Faire **Redeploy**.
3. Vérifier `https://app.kiavikcopilot.ovh/api/espace` → `"slug":"kiavik"` (le certificat est créé au premier accès, compter une minute).
