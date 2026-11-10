# Architecture

Voir aussi : [BONNES-PRATIQUES.md](BONNES-PRATIQUES.md) (règles et recettes), [API.md](API.md), [DEPLOIEMENT.md](DEPLOIEMENT.md).

## But (espace Lazzeko)
Un client enregistre ses réglages machine depuis son téléphone : il choisit sa machine, ajoute des tags (surface, ce qu'il enlève, application), prend des photos avant / après / de l'écran machine, recopie les réglages dans un **miroir de l'interface machine** et donne une note.
Les fiches partagées alimentent une **section communautaire** : mêmes machines + mêmes tags = comparaison des réglages de chacun.

Le simulateur du site (bloc HTML Odoo) reste à part : il sert à expliquer la machine aux prospects. Il pourra plus tard lire la même config JSON.

## Deux espaces dans une seule app
- **Lazzeko** (`app.lazzeko.com`) : réglages décapage + communauté. **Kiavik** (`app.kiavikcopilot.ovh`) : guides et procédures, sans communauté.
- Une base, un admin, une gestion des comptes et des messages. L'adresse choisit la marque (couleur, nom, icône, manifeste PWA).
- `apps/api/src/espaces/espaces.ts` : espaces et **modules** (fonctions). `UserModule` = accès d'un compte à un module ; l'accès à un espace découle de ses modules.
- Garde : `@ModuleRequis('reglages-decapage')` sur les contrôleurs d'un module (403 `MODULE_NON_AUTORISE`), puis conditions de l'espace du module (403 `CONDITIONS_A_ACCEPTER`). Routes communes : espace de l'en-tête `X-Espace` (sinon l'adresse).
- Conditions par espace : `Parametre` `conditions:<espace>` = `{version, texte}`, acceptations dans `AcceptationConditions`.
- App : `src/lib/espace.tsx` (espace ouvert, thème), `src/espaces/<espace>/` (écrans et barre du bas propres), `src/App.tsx` (commun : compte, conditions, messages, admin).

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
apps/api                    NestJS + Prisma + PostgreSQL
  src/espaces/espaces.ts    espaces et modules
apps/api/src/guides         guides Kiavik (lecture de kit-guides/)
apps/app                    PWA React mobile (Vite) — servie par l'API en production
  src/espaces/<espace>/     écrans et barre du bas propres à un espace
packages/machine-kit        schéma des configs, validation, calculs (partagé api / app / site)
machines/                   configs JSON des machines
kit-guides/                 cahier des charges et données des guides Kiavik
docs/                       documentation
```

## Guides Kiavik
- **Un guide = un fichier JSON** dans `kit-guides/guides/` (format : `kit-guides/CAHIER_DES_CHARGES.md` §4), images dans `kit-guides/images/`. Pas de table : l'API lit les fichiers au démarrage (`apps/api/src/guides/`). Ajouter un guide = son JSON + le module `guide-<slug>` dans `espaces.ts`.
- `GET /api/guides/:slug` exige le module `guide-<slug>` (`@ModuleRequis` accepte une fonction de la requête). Les conseils `a_completer` ne partent qu'à l'admin.
- `modes-blanc.json` est rattaché à l'écran qu'il cite (`ecran: "t4"`) et renvoyé dans `modesBlanc`.
- App (`apps/app/src/espaces/kiavik/`) : `/guides` (liste, ouvre directement s'il n'y a qu'un guide), `/guides/<guide>/<écran>?p=<pastille>`. Capture + pastilles (en % de l'image), zones voilées, pastilles de navigation tirées de `navigation` (onglets T1–T11, boutons E / A, menus D1–D8 et sous-menus), fiche en bas d'écran, zoom 240 %, menu repliable par groupe, liste des repères, fenêtres Windows recréées (`Fenetres.tsx`). Admin : option « afficher les repères » (filigrane du code écran).
- **Recherche** (`/recherche`, `recherche.ts`) : sur le téléphone, dans les guides du compte (titre, `mots_cles`, texte et conseil des pastilles, titre de l'écran). Sans accents, début de mot, une faute de frappe tolérée. Un résultat ouvre l'écran sur le repère (`?p=`). Plus tard : procédures et animations dans les résultats.

## Données (apps/api/prisma/schema.prisma)
| Table | Rôle |
|---|---|
| `User` | identifiant + mot de passe (bcrypt), rôle `ADMIN`/`USER`, `organisationId` facultatif (entreprises : plus tard) |
| `UserModule`, `AcceptationConditions` | modules accessibles (→ espaces) ; conditions acceptées par espace |
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
- `@ModuleRequis('<module>')` : route réservée aux comptes qui ont ce module ; `@SansConditions()` : route du compte accessible avant d'accepter les conditions.
- L'admin a accès à tout, dans tous les espaces.

## App mobile (apps/app)
- PWA installable (manifeste + service worker : l'app démarre hors ligne, l'API reste en ligne).
- `components/Miroir.tsx` : rendu **uniquement à partir de la config** (zones, colonnes, `visibleSi`, icônes ; préréglages possibles mais non utilisés pour Lazzeko). Saisie par panneau : clavier numérique, −/+, curseur (log pour la fréquence), « Suivant » pour enchaîner les champs dans l'ordre de l'écran.
- La validation et les indicateurs utilisent le **même code** que l'API (`machine-kit`, importé en source).
- Photos compressées sur le téléphone (1600 px + miniature 400 px) avant envoi.
- Brouillon de la fiche en cours conservé localement (hors photos).

## Avis et modération
- Un avis = une note (1 à 5) + un texte facultatif, **un par personne et par réglage**, modifiable et supprimable. Pas de réponses (choix volontaire : pas de discussions).
- `Evaluation.statut` : `VISIBLE`, `EN_ATTENTE` (modération préalable), `MASQUE` ; `moderePar` = `admin` ou `auto` (service externe via clé API). Seuls les avis visibles comptent dans la moyenne.
- Fiches : `masquee` + `moderationRaison` + `moderePar`.

## Webhooks (préparation de la modération par IA)
- `Webhook` (url, secret, événements) et `WebhookLivraison` (file persistante : statut, tentatives, prochain essai, dernier code / erreur).
- Événements : `fiche.creee`, `fiche.modifiee`, `avis.publie`, `avis.modifie`. Envoi en arrière-plan, signé HMAC-SHA256, sans jamais bloquer l'utilisateur.
- Retour de la modération : `PATCH /api/admin/avis/:id` et `PATCH /api/admin/fiches/:id`, accessibles avec une clé API.

## Plan
1. ✅ Base : monorepo, machine-kit, config Lazzeko 300 W, utilisateurs, connexion, clés API, seed.
2. ✅ Catalogue + « mes machines » (ajout par l'utilisateur, attribution par l'admin ou clé API).
3. ✅ Fiches : miroir, tags (proposition par les utilisateurs), note — API + app mobile.
4. ✅ Photos : compression côté téléphone, stockage local derrière une interface.
5. ✅ Communauté : partage, notes des autres, duplication, tri par note (moyenne dénormalisée).
6. ✅ Espaces Lazzeko / Kiavik (modules, conditions, marque par adresse).
7. Kiavik : ✅ guides FlexiPRINT et DXonJet (`kit-guides/`) ; à venir : procédures, animations.
8. À venir : stockage S3 (implémenter `StockageService`), édition des configs dans l'admin, entreprises (`organisationId`), simulateur du site branché sur le JSON, lecture auto de la photo d'écran, mode hors ligne complet (file d'envoi).
