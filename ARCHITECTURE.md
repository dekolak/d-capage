# Architecture — App réglages décapage

## But
Un client enregistre ses réglages machine depuis son téléphone : il choisit sa machine, ajoute des tags (surface, ce qu'il enlève, application), prend des photos avant / après / de l'écran machine, recopie les réglages dans un **miroir de l'interface machine** et donne une note.
Les fiches partagées alimentent une **section communautaire** : mêmes machines + mêmes tags = comparaison des réglages de chacun.

Le simulateur du site (bloc HTML Odoo) reste à part : il sert à expliquer la machine aux prospects. Il pourra plus tard lire la même config JSON.

## Principe clé : une machine = un fichier JSON
```
machines/<fabricant>/<variante>/v<N>.json
```
Ce fichier décrit l'écran de la machine (pages → sections → champs) et sert à :
- afficher le miroir dans l'app ;
- valider les valeurs saisies ;
- choisir les champs enregistrés dans une fiche (`enregistre: true`) ;
- calculer des indicateurs (via le module de la technologie).

**Ajouter une machine = ajouter un JSON + `npm run seed`.** Aucune modification de la base ni de l'API.

### Champs
| type | propriétés |
|---|---|
| `nombre` | `min`, `max`, `step`, `unite`, `echelle` (`lineaire`/`log`), `defaut` |
| `interrupteur` | `defaut` (vrai/faux) |
| `choix` | `options[]` (`valeur`, `label`, `icone` SVG, `donnees` techniques), `affichage` (`liste`/`icones`) |
| `texte` | `maxLength`, `defaut` |

Communs : `key`, `label {fr, en}`, `aide`, `enregistre`, `visibleSi` (ex. `{"scan": [2]}` = visible seulement pour l'anneau).

Seuls les champs `enregistre` **et visibles** sont stockés dans une fiche.

### Versions
Hiérarchie : **Technologie → Fabricant → Modèle → Variante → Version d'interface**.
- Variante = ex. 300 W (ne change que des constantes comme `pmax`).
- Version d'interface = l'écran. Si le fabricant change son menu : nouveau fichier `v2.json`. Les fiches existantes restent liées à `v1` et restent lisibles.
- Corriger un libellé ou une aide dans `v1.json` puis relancer le seed met à jour la version existante.

### Technologies et calculs
`packages/machine-kit/src/calculs/` : un module par technologie (`laser-pulse` pour l'instant).
Il fournit :
- `indicateurs()` : énergie par impulsion, crête, écart, recouvrement… **recalculés à l'affichage, jamais stockés** (corriger une constante hypothétique met à jour toutes les fiches) ;
- `valider()` : contrôles croisés (ex. longueur max selon la lentille).

Nouvelle technologie (sablage, aérogommage…) = un fichier + une ligne dans `calculs/index.ts`.

## Structure du repo
```
apps/api               NestJS + Prisma + PostgreSQL
apps/app               PWA React mobile (Vite) — servie par l'API en production
packages/machine-kit   schéma des configs, validation, calculs (partagé api / app / site)
machines/              configs JSON des machines
```

## Données (apps/api/prisma/schema.prisma)
| Table | Rôle |
|---|---|
| `User` | identifiant + mot de passe (bcrypt), rôle `ADMIN`/`USER`, `organisationId` facultatif (entreprises : plus tard) |
| `ApiKey` | création de comptes depuis un autre système ; seul le hash est stocké |
| `Technologie`, `Fabricant`, `Modele`, `Variante`, `VersionInterface` | catalogue ; la version contient le JSON |
| `UserMachine` | machines d'un utilisateur (variante + surnom facultatif, pas de n° de série) |
| `GroupeTag`, `Tag` | tags par groupe (Matériau, À enlever, Application), administrables ; `valide=false` = proposé par un utilisateur |
| `Fiche` | réglage : version d'interface, `valeurs` (JSON), titre, commentaire, `PRIVEE`/`PARTAGEE`, `parentId` (duplication) |
| `FicheTag`, `Photo` (`AVANT`/`APRES`/`INTERFACE`/`AUTRE`), `Evaluation` (note 1–5, une par utilisateur et par fiche) |

## Machines des clients
- L'**admin** gère le catalogue (configs).
- L'**utilisateur** ajoute lui-même ses machines depuis le catalogue.
- L'admin (ou une clé API) peut aussi attribuer des machines à un client.

## Authentification
- `POST /api/auth/connexion` → jeton JWT.
- Toutes les routes sont protégées par défaut (`@Public()` pour ouvrir, `@Roles()` pour restreindre).
- Clé API (`X-Api-Key: dk_…`) acceptée uniquement sur les routes marquées `@AutoriseCleApi()` (création de comptes). Une clé ne peut pas créer d'admin ni d'autre clé.

## App mobile (apps/app)
- PWA installable (manifeste + service worker : l'app démarre hors ligne, l'API reste en ligne).
- `components/Miroir.tsx` : rendu **uniquement à partir de la config** (zones, colonnes, `visibleSi`, icônes ; préréglages possibles mais non utilisés pour Lazzeko). Saisie par panneau : clavier numérique, −/+, curseur (log pour la fréquence), « Suivant » pour enchaîner les champs dans l'ordre de l'écran.
- La validation et les indicateurs utilisent le **même code** que l'API (`machine-kit`, importé en source).
- Photos compressées sur le téléphone (1600 px + miniature 400 px) avant envoi.
- Brouillon de la fiche en cours conservé localement (hors photos).

## Plan
1. ✅ Base : monorepo, machine-kit, config Lazzeko 300 W, utilisateurs, connexion, clés API, seed.
2. ✅ Catalogue + « mes machines » (ajout par l'utilisateur, attribution par l'admin ou clé API).
3. ✅ Fiches : miroir, tags (proposition par les utilisateurs), note — API + app mobile.
4. ✅ Photos : compression côté téléphone, stockage local derrière une interface.
5. ✅ Communauté : partage, notes des autres, duplication, tri par note (moyenne dénormalisée).
6. À venir : stockage S3 (implémenter `StockageService`), édition des configs dans l'admin, entreprises (`organisationId`), simulateur du site branché sur le JSON, lecture auto de la photo d'écran, mode hors ligne complet (file d'envoi).
