# Déploiement : Coolify (proxy Coolify) + domaines OVH

Une seule app sert `app.lazzeko.com` (Lazzeko) et `app.kiavikcopilot.ovh` (Kiavik).

## Contexte du VPS
Tout est géré par **Coolify**, n8n compris, et le **proxy de Coolify** (Traefik, `coolify-proxy`) route les adresses et
crée les certificats HTTPS. L'app n'a ni labels Traefik ni réseau externe dans `docker-compose.prod.yml` : c'est le champ
**Domains** de Coolify qui fait le lien.

> Avant novembre 2026, n8n avait son propre Traefik hors de Coolify et l'app passait par lui (labels + réseau
> `n8n-compose_default`). Si l'app répond « 503 Service Unavailable — The domain is not configured on a resource in
> Coolify », c'est que le champ Domains du service `app` est vide : voir l'étape 2.

## 1. DNS chez OVH
Zone DNS de `lazzeko.com` → entrée **A** `app` → `51.178.183.183` (IP du VPS, sans port).

## 2. Ressource Coolify
**+ New** → **Private Repository (with GitHub App)** → `dekolak/d-capage`, branche `main`.
- **Build pack** : `Docker Compose`
- **Docker Compose file** : `/docker-compose.prod.yml`
- **Domains** du service **`app`** (dans la page de la ressource, partie *Services* ou *Domains for app*) :
  ```
  https://app.lazzeko.com:3000,https://app.kiavikcopilot.ovh:3000
  ```
  Le `:3000` est le port **du conteneur** (l'API) : les visiteurs, eux, passent par 443 (HTTPS) sans port.
- Service `db` : **pas de domaine**.

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
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | facultatif : clés des notifications ; sinon générées au premier usage et gardées en base (ne pas les changer ensuite, sinon réactiver les notifications sur chaque téléphone) |

Le compte admin n'est créé qu'au premier démarrage.

## 4. Proxy Coolify
**Servers → localhost → Proxy** : il doit être **démarré** (*Running*). Il sert l'app et n8n.

## 5. Déployer et vérifier
**Deploy**, puis :
- `https://app.lazzeko.com/api/health` → `{"ok":true}`
- `https://app.lazzeko.com` → page de connexion (certificat Let's Encrypt créé par le proxy de Coolify, compter une minute au premier accès).

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
2. Coolify → service `app` → **Domains** : les deux adresses doivent y être (voir l'étape 2). Faire **Redeploy**.
3. Vérifier `https://app.kiavikcopilot.ovh/api/espace` → `"slug":"kiavik"` (le certificat est créé au premier accès, compter une minute).
