# API

Base : `https://app.lazzeko.com/api` (ou `https://app.kiavikcopilot.ovh/api`, c'est la même API).
JSON en entrée et en sortie. Les erreurs ont la forme `{ statusCode, message, code? }`.

## Authentification
| Mode | En-tête | Usage |
|---|---|---|
| Jeton utilisateur | `Authorization: Bearer <jeton>` | l'app ; jeton obtenu par `POST /api/auth/connexion` |
| Clé API | `X-Api-Key: dk_…` | automatisations (Odoo, service de modération) ; **seulement** sur les routes marquées « clé API » |

- Créer une clé : Administration → Clés API. Elle n'est affichée qu'une fois (seul son hash est stocké). Révocable.
- Une clé API ne peut ni créer d'admin ni créer d'autre clé.
- L'app envoie aussi `X-Espace: lazzeko|kiavik` (espace ouvert). Sans cet en-tête, l'API prend l'espace de l'adresse.
- Et `Accept-Language` (langue de l'app). Les messages d'erreur de l'API sont pour l'instant en français ; l'app les traduit par `code` / statut (voir [TRADUCTION.md](TRADUCTION.md)).

### Codes d'erreur utiles
| Statut | `code` | Signification |
|---|---|---|
| 401 | — | non connecté, jeton expiré ou compte désactivé |
| 403 | `CONDITIONS_A_ACCEPTER` | conditions de l'espace (champ `espace`) à accepter |
| 403 | `MODULE_NON_AUTORISE` | le compte n'a pas le module de cette route |
| 409 | — | conflit (identifiant déjà pris, conditions changées entre-temps…) |

## Routes
### Comptes et espaces
| Méthode | Route | Accès |
|---|---|---|
| POST | `/auth/connexion` `{identifiant, motDePasse}` → `{jeton}` | public |
| GET | `/espaces`, `/espace`, `/manifest.webmanifest` (selon l'adresse) | public |
| GET | `/moi` (modules, espaces, `conditionsAJour`) | connecté |
| POST | `/moi/mot-de-passe` `{ancien, nouveau}` | connecté |
| PATCH | `/moi/preferences` `{accordPhotosMarketing?, langue?}` (`langue` : `fr`, `en` ou `null` = langue du téléphone) | connecté |
| GET · POST | `/conditions?espace=` · `/moi/conditions` `{espace?, version, accordPhotosMarketing?}` | connecté |
| POST | `/users` `{identifiant, motDePasse, nom?, role?, clientLazzeko?, numeroOdoo?, modules?, langue?}` | admin **ou clé API** |
| GET | `/users[?numeroOdoo=&q=&espace=&module=]` | admin **ou clé API** |
| GET · PATCH | `/users/:id` (`modules` remplace la liste, `numeroOdoo: null` l'efface, `langue: null` = langue du téléphone) | admin |
| GET · POST | `/users/:id/machines` `{varianteId, surnom?}` | admin **ou clé API** |
| POST · GET · DELETE | `/admin/cles-api` | admin |

Modules : `reglages-decapage` (Lazzeko), `guide-flexiprint`, `guide-dxonjet`, `procedures-kiavik` (Kiavik).
Sans `modules` à la création, le compte reçoit `["reglages-decapage"]`.

### Réglages (module `reglages-decapage`)
| Méthode | Route | Accès |
|---|---|---|
| GET | `/catalogue`, `/catalogue/versions/:id` | connecté |
| GET | `/catalogue/modeles/:id/image`, `/catalogue/variantes/:id/image` | public |
| POST · DELETE | idem, champ multipart `image` (PNG conseillé, 5 Mo max) | admin |
| GET · POST · PATCH · DELETE | `/moi/machines` | connecté |
| GET · POST | `/tags` (proposer un tag) · PATCH `/tags/:id` (admin) | connecté |
| GET · POST | `/fiches` · GET/PATCH/DELETE `/fiches/:id` | connecté (auteur pour modifier) |
| POST · DELETE | `/fiches/:id/evaluation` `{note 1–5, avis?}` | connecté |
| GET | `/communaute?varianteId=&modeleId=&tags=id1,id2&noteMin=&tri=note\|recent` | connecté |
| GET | `/top?varianteId=` (3 meilleurs réglages par tag) | connecté |
| POST | `/fiches/:id/photos` (multipart `fichier`, `miniature`, `type`) | auteur |
| GET · PATCH · DELETE | `/photos/:id[?taille=min]` | selon visibilité de la fiche |
| POST | `/fiches/:id/aide` `{message}` (si `aideSupport` activé) | connecté |

### Guides Kiavik (modules `guide-<slug>`)
| Méthode | Route | Accès |
|---|---|---|
| GET | `/guides` → `[{slug, nom, description, module, ecrans}]` (guides des modules du compte) | connecté |
| GET | `/guides/:slug` → guide complet (écrans, pastilles, navigation, `modesBlanc`) | module `guide-<slug>` |
| GET | `/guides/images/<fichier>` (captures du kit) | public |

Les conseils `niveau: "a_completer"` (notes internes) ne sont envoyés qu'à l'admin.

### Procédures Kiavik (module `procedures-kiavik`)
| Méthode | Route | Accès |
|---|---|---|
| GET | `/procedures` (publiées ; admin : toutes) → titre, catégorie, `nbEtapes`, `liens` vers les guides | module |
| GET | `/procedures/:id` (étapes), `/procedures/etapes/:id/photo` | module |
| POST · PATCH · DELETE | `/admin/procedures[/:id]` `{titre, categorie?, resume?, publiee?, ordre?}` | admin |
| POST | `/admin/procedures/:id/etapes` `{texte, avertissement?, guide?, ecran?, pastille?}` | admin |
| PATCH · DELETE | `/admin/procedures/etapes/:id` ; POST `…/deplacer {sens: -1\|1}` ; POST · DELETE `…/photo` (multipart `photo`) | admin |

### Administration
| Méthode | Route | Accès |
|---|---|---|
| GET · PATCH | `/parametres` · `/admin/parametres` `{aideSupport}` | connecté · admin |
| POST | `/admin/conditions` `{espace, texte}` (nouvelle version) | admin |
| GET · PATCH | `/admin/aide`, `/admin/aide/:id` `{traitee}` | admin **ou clé API** |
| GET | `/admin/fiches` | admin |
| PATCH | `/admin/fiches/:id` `{masquee, raison?}` | admin **ou clé API** |
| GET | `/admin/avis?statut=VISIBLE\|EN_ATTENTE\|MASQUE&q=` | admin **ou clé API** |
| PATCH | `/admin/avis/:id` `{statut, raison?}` | admin **ou clé API** |
| GET · POST · PATCH · DELETE | `/admin/webhooks` (+ `/:id/test`, `/:id/livraisons`) | admin |

### Messages
| Méthode | Route | Accès |
|---|---|---|
| GET | `/annonces` (messages à afficher dans l'espace ouvert) | connecté |
| POST | `/annonces/:id/compris`, `/annonces/:id/reponse` `{valeur, autre?}` | connecté |
| GET · POST · PATCH · DELETE | `/admin/annonces` | admin **ou clé API** |
| POST | `/admin/annonces/cible` (nombre d'utilisateurs visés) | admin **ou clé API** |
| GET | `/admin/annonces/:id/reponses[?occurrence=]`, `/admin/annonces/:id/reponses.csv` | admin **ou clé API** |

Champs d'un message : `titre`, `texte`, `niveau` (`CONSEIL`/`INFO`/`IMPORTANT`), `lienUrl` (`https://…` ou page de l'app `/…`), `debut`, `fin`,
`recurrence` (`AUCUNE`/`JOURS`/`SEMAINES`/`MOIS`) + `intervalle`, ciblage `espaces[]`, `cibleClient` (`TOUS`/`LAZZEKO`/`AUTRES`),
`fabricantIds[]`, `modeleIds[]`, `varianteIds[]`, `numerosOdoo[]`, question `questionType` (`OUI_NON`/`CHOIX`/`NOTE`/`TEXTE`), `question`, `options[]`, `autreOption`, `reponseObligatoire`.

## Exemples (Odoo)
Créer un compte Lazzeko et lui attribuer une machine :
```bash
curl -X POST https://app.lazzeko.com/api/users -H "X-Api-Key: dk_…" -H "Content-Type: application/json" \
  -d '{"identifiant":"client1","motDePasse":"motdepasse1","nom":"Client 1","numeroOdoo":"C00123"}'
curl -X POST https://app.lazzeko.com/api/users/<id>/machines -H "X-Api-Key: dk_…" -H "Content-Type: application/json" \
  -d '{"varianteId":"<id du catalogue>"}'
```
Créer un compte Kiavik (guide DXonJet seulement) :
```bash
curl -X POST https://app.lazzeko.com/api/users -H "X-Api-Key: dk_…" -H "Content-Type: application/json" \
  -d '{"identifiant":"client2","motDePasse":"motdepasse1","modules":["guide-dxonjet"]}'
```
Retrouver un compte par n° client : `GET /api/users?numeroOdoo=C00123`.

## Webhooks (envoi vers un service externe, ex. modération IA)
- Configurés dans Administration → *Envoi vers une API* : une ou plusieurs adresses, événements choisis.
- Événements : `fiche.creee`, `fiche.modifiee`, `avis.publie`, `avis.modifie`, `aide.demandee`.
- `POST` JSON signé : `X-Decapage-Signature: sha256=<HMAC-SHA256(secret, corps)>`, plus `X-Decapage-Evenement` et `X-Decapage-Livraison`.
- File d'envoi en base : rien n'est perdu au redémarrage, 6 tentatives espacées (jusqu'à 2 h), journal dans l'admin.
- Le corps contient le texte à modérer et l'adresse pour agir (`moderation.url`). Le service répond avec une clé API :
```bash
curl -X PATCH https://app.lazzeko.com/api/admin/avis/<id> -H "X-Api-Key: dk_…" \
  -H "Content-Type: application/json" -d '{"statut":"MASQUE","raison":"hors sujet"}'
```
- `MODERATION_PREALABLE_AVIS=true` : les avis avec texte restent *en attente* jusqu'à validation (`statut: VISIBLE`).
