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
- App (`apps/app/src/espaces/kiavik/`) : `/guides` = accueil (`Guides.tsx`, `accueil.css`) : recherche, logiciels avec la **miniature de l'écran** (`miniature`, `nom_court`, `role` dans le JSON du guide ; ordre des modules de `espaces.ts`), **procédures guidées** (les animations, à faire défiler), astuces & solutions, procédures, `/guides/<guide>/<écran>?p=<pastille>`. Capture + pastilles (en % de l'image), zones voilées, pastilles de navigation tirées de `navigation` (onglets T1–T11, boutons E / A, menus D1–D8 et sous-menus), fiche en bas d'écran, zoom 240 %, menu repliable par groupe, liste des repères, fenêtres Windows recréées (`Fenetres.tsx`). Admin : option « afficher les repères » (filigrane du code écran).
- **Recherche** (`/recherche`, `recherche.ts`) : sur le téléphone, dans les guides du compte (titre, `mots_cles`, texte et conseil des pastilles, titre de l'écran). Sans accents, début de mot, une faute de frappe tolérée. Un résultat ouvre l'écran sur le repère (`?p=`). Plus tard : procédures et animations dans les résultats.

## Mot de passe oublié et notifications
- Table `DemandeMotDePasse` (`userId` vide et `email` rempli pour une demande faite avec un email, compte retrouvé ensuite par n8n ou l'admin ; statut `EN_ATTENTE` → `CODE_ENVOYE` → `UTILISEE` / `ANNULEE`, code **haché** bcrypt, expiration 1 h, essais ≤ 5) ; `mot-de-passe/` (API). Demande → notification aux admins + webhook `motdepasse.demande` (n8n) ; le client saisit le code et est connecté.
- Notifications : Web Push (`push/`, bibliothèque `web-push`), table `AbonnementPush` (téléphones des admins). Clés VAPID dans les variables `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, sinon générées une fois et gardées en base (`Parametre` « vapid »). Le service worker (`public/sw.js`) affiche la notification et ouvre la bonne page.
- App : `pages/MotDePasseOublie.tsx` (client), `pages/AdminMotsDePasse.tsx`, `lib/notifications.ts`.

## Journal d'activité
- Table `Activite` (`userId`, `espace`, `type` = `connexion` | `page` | `recherche`, `chemin`, `detail`, `resultats`) ; clients seulement (pas les admins), effacée après 12 mois (`activite.service.ts`, nettoyage quotidien).
- Connexion notée par l'API à l'identification ; pages (titre lu à l'écran) et recherches (Kiavik, mes réglages, communauté) envoyées par l'app (`lib/activite.ts`, `POST /api/activite`), en arrière-plan, sans jamais bloquer.
- Admin : `pages/AdminActivite.tsx` (`/admin/comptes/:id/activite`). Base des futures statistiques (recherches sans résultat).

## Astuces & solutions (Kiavik)
- Table `Solution` (titre = symptôme, `cause`, `texte` = que faire, `avertissement`, `motsCles`, lien `guide`/`ecran`/`pastille`, `procedureId`, photo, `publiee`, `cle` pour celles du seed). Module `procedures-kiavik` (nom affiché « Procédures et astuces »).
- Fiches de départ : `kit-guides/solutions.json` (créées seulement si leur clé n'existe pas). API `apps/api/src/solutions/` ; app `Solutions.tsx` (liste, fiche), `AdminSolutions.tsx`.
- Affichées sur l'accueil, en tête de la recherche et dans la fiche du bouton lié ; base de connaissances du futur assistant IA.

## Corrections des guides depuis l'app
- Table `CorrectionGuide` (`guide`, `type` = `pastille` | `etape` | `photo`, `cle`, `valeur` JSON, `photoCle`) : corrections de l'admin **appliquées par-dessus** les fichiers `kit-guides/` à chaque `GET /api/guides/:slug` (`corrections.service.ts`). Supprimer une correction = revenir à l'original ; les fichiers d'origine ne sont jamais modifiés.
- Photos remplacées : dans le stockage (`guides/…`), servies par `GET /api/guides/corrections/:id/photo` ; affichées en `object-fit: cover` dans le cadre de la photo d'origine (les coordonnées du curseur ne changent pas).
- App : `espaces/kiavik/Corrections.tsx` (formulaire de la fiche d'un bouton, sous-titres et photos d'une scène) ; `mettreAJourGuide()` met à jour les écrans ouverts.

## Écrans interactifs (T5, T9)
- Champ `interactif` d'un écran dans le JSON du guide (zones en pixels de l'image) : `echantillon` (T5 : poignées d'angle, taille réelle en cm, `remise` = pastille qui annule) et `canaux` (T9 : case, lignes des canaux, zone d'aperçu, images `ch_*` ; le blanc suit le mode choisi en T4, gardé sur le téléphone).
- App : `Interactifs.tsx`. Sur T9, gros boutons sous la capture (les cases de la capture sont trop petites au doigt).

## Animations Kiavik
- `kit-guides/animations.json` : les 3 animations du prototype (couleur simple, couleur + blanc, réglages du blanc), extraites telles quelles (scènes, étapes, sous-titres, durées) + `liens` vers les boutons concernés. Servies avec leur guide (`GET /guides/:slug` → `animations`), donc même droit d'accès.
- App : `Animation.tsx` (`/guides/<guide>/animation/<id>`) rejoue les scènes sur les vraies captures (curseur, cercle, clic, menus, fenêtre « Quel blanc choisir ? », aperçu T9) ; `voix.ts` : voix off `speechSynthesis` fr selon les règles du cahier §6 (choix de voix, débit selon la vitesse, la voix pilote le temps avec reprise de sécurité, Pause coupe, Lecture relit la phrase).
- Une scène peut se passer sur une **photo** (`photos` de l'animation, `ecran: "photo:<clé>"`) et afficher une **valeur tapée** (effet `texte` avec `zone` et `val`). Exemple : « Régler l'Offre » (DXonJet D4 · a.6) : photos de Teddy (impression test, mire sur le mur) et **mire simulée** en SVG (`offre_mire_*.svg`, plus lisible qu'une photo pour montrer la ligne alignée).
- Accès : cartes sur l'accueil, « 🎬 Voir l'animation » dans la fiche des boutons liés, recherche.

## Procédures Kiavik (module `procedures-kiavik`)
- Tables `Procedure` (titre, catégorie, résumé, publiée, ordre, `cle` pour celles du seed) et `EtapeProcedure` (texte, avertissement, photo, lien `guide` / `ecran` / `pastille`, tous facultatifs sauf le texte). Les liens d'une procédure vers les guides = ceux de ses étapes.
- Procédures de départ dans `kit-guides/procedures.json` (reprises des animations du prototype + 4 brouillons DXonJet) : le seed les crée **seulement si leur clé n'existe pas**, puis elles se modifient dans l'app (jamais écrasées).
- API `apps/api/src/procedures/` : lecture (`/procedures`, publiées seulement pour les clients), admin (`/admin/procedures`, étapes, ordre, photo). Un lien vers un bouton inexistant est refusé.
- App : accueil (procédures sous les logiciels), onglet Procédures (par catégorie), détail (étapes à cocher gardées sur le téléphone, photos agrandissables, « Voir le bouton »), « 📋 Voir la procédure » dans la fiche d'une pastille, procédures dans la recherche, Administration → Procédures (`AdminProcedures.tsx`).

## Données (apps/api/prisma/schema.prisma)
| Table | Rôle |
|---|---|
| `User` | identifiant + mot de passe (bcrypt), rôle `ADMIN`/`USER`, `organisationId` facultatif (entreprises : plus tard) |
| `User.langue` | langue de l'app pour le compte (`null` = langue du téléphone) |
| `UserModule`, `AcceptationConditions` | modules accessibles (→ espaces) ; conditions acceptées par espace |
| `ApiKey` | création de comptes depuis un autre système ; seul le hash est stocké |
| `Technologie`, `Fabricant`, `Modele`, `Variante`, `VersionInterface` | catalogue ; la version contient le JSON |
| `UserMachine` | machines d'un utilisateur (variante + surnom facultatif, pas de n° de série) |
| `GroupeTag`, `Tag` | tags par groupe (Matériau, À enlever, Application), administrables ; `valide=false` = proposé par un utilisateur |
| `Fiche` | réglage : version d'interface, `valeurs` (JSON), titre, commentaire, `PRIVEE`/`PARTAGEE`, `parentId` (duplication) |
| `Procedure`, `EtapeProcedure` | procédures Kiavik (voir plus haut) |
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
- **Partage (admin)** : `components/Partager.tsx`, lien de la page affichée sur l'adresse de l'espace (`navigator.share`, sinon WhatsApp / SMS / copier).
- **Traduction** : textes dans `src/textes/<langue>.ts` (`fr.ts` = référence), `src/lib/i18n.tsx` ; langue du compte (`User.langue`), sinon celle du téléphone, sinon français ; texte manquant → français. Voir [TRADUCTION.md](TRADUCTION.md).

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
7. Kiavik : ✅ guides FlexiPRINT et DXonJet (`kit-guides/`), recherche, procédures, animations, écrans interactifs T5 / T9.
8. Traduction : ✅ app prête (textes dans `src/textes/`, langue par compte) ; à venir : anglais, puis les contenus (voir [TRADUCTION.md](TRADUCTION.md)).
9. À venir : stockage S3 (implémenter `StockageService`), édition des configs dans l'admin, entreprises (`organisationId`), simulateur du site branché sur le JSON, lecture auto de la photo d'écran, mode hors ligne complet (file d'envoi).
