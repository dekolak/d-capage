# Cahier des charges — Guides Kiavik dans l'app d-capage

> À lire par Claude Code, avec `ARCHITECTURE.md` et `README.md` du dépôt `dekolak/d-capage`.
> Rédigé à partir du prototype validé par Teddy (dossier `prototype/`).
> Ne rien casser de l'existant (réglages décapage, messages, avis, webhooks, clés API).

## 1. Objectif
L'app d-capage (app.lazzeko.com) devient **l'app commune** des clients Lazzeko et Kiavik :
**une seule app, une seule base, une seule gestion des utilisateurs**, avec :
- les **réglages décapage** (existant) ;
- des **guides logiciels** : écrans annotés de FlexiPRINT et de DXonJet (nouveau) ;
- des **procédures** pas à pas, modifiables par Teddy depuis son téléphone (nouveau) ;
- plus tard, des **animations** explicatives.

Ce que chaque client voit dépend de ses **droits** (modules), gérés au même endroit que les comptes.
Les messages (bulles à l'ouverture), les demandes d'aide, les conditions d'utilisation et l'administration restent **communs**.

## 2. Droits de vue par utilisateur (priorité 1)
### Modules
| slug | Nom | Marque |
|---|---|---|
| `reglages-decapage` | Réglages décapage | lazzeko |
| `guide-flexiprint` | Guide FlexiPRINT | kiavik |
| `guide-dxonjet` | Guide DXonJet | kiavik |
| `procedures-kiavik` | Procédures Kiavik | kiavik |

Liste extensible (ajouter un module = une ligne en base ou dans le seed, pas de modification de code ailleurs).

### Règles
- Table `Module` (slug, nom, marque, ordre, actif) + liaison `UserModule` (utilisateur ↔ module).
- **Migration** : tous les comptes existants reçoivent `reglages-decapage` (comportement actuel inchangé).
- Admin : voit tout.
- `GET /api/moi` renvoie la liste des modules de l'utilisateur.
- Les routes d'un module sont refusées (`403`, `code: "MODULE_NON_AUTORISE"`) si l'utilisateur ne l'a pas.
- **Administration → Comptes** : cases à cocher des modules à la création et à la modification d'un compte.
- **Clé API** (création de compte depuis Odoo) : champ `modules: string[]` accepté sur `POST /api/users` et `PATCH /api/users/:id`.
- **Messages** : ajouter le ciblage par module (en plus de « tous », client Lazzeko, machine, n° Odoo). Le compteur « utilisateurs visés » en tient compte.
- **Demandes d'aide** : préciser le module d'origine.
- Navigation de l'app : n'afficher que les modules autorisés. Un seul module → l'app s'ouvre directement dessus.

## 3. Deux adresses, une seule app (priorité 2)
- `app.lazzeko.com` (existant) et `app.kiavikprint.com` (à confirmer par Teddy) pointent vers **le même conteneur**.
- La **marque est déduite du domaine** (`Host`) : nom, logo, couleurs, icônes, page d'accueil par défaut.
  Config des marques dans un fichier (ex. `marques.json`), domaine inconnu → lazzeko.
- **Manifeste PWA dynamique** par domaine (nom, icônes, `theme_color`), servi par l'API.
- Un utilisateur voit **tous ses modules** quelle que soit l'adresse ; l'adresse ne change que l'apparence et la page d'accueil.
- Déploiement : ajouter la règle `Host(app.kiavikprint.com)` dans les labels Traefik de `docker-compose.prod.yml` (même méthode que l'existant, Traefik de n8n, voir `DEPLOIEMENT.md`) + entrée DNS **A** `app` chez OVH pour kiavikprint.com.
- Remarque à afficher dans la doc : chaque adresse = une app installée séparément sur le téléphone, connexion séparée.

## 4. Module Guides (priorité 3)
### Données
- Fichiers fournis : `guides/flexiprint.json`, `guides/dxonjet.json`, `guides/modes-blanc.json`, images dans `images/`.
- Même principe que les machines : **un guide = un fichier JSON**, chargé par le seed (idempotent), sans toucher au schéma pour ajouter un guide.
  Proposition : `guides/<marque>/<slug>/v1.json` + table `Guide` (slug, nom, module, version, config JSON).
- Images : servies en statique (ex. `apps/app/public/guides/...`) ou via le stockage existant.

### Format (voir les JSON)
- `ecrans[]` : `id`, `code` (filigrane, ex. `T3`, `D3-a`), `titre`, `groupe` (menu repliable), `intro`, `type` (`capture` ou `fenetre_recreee`), `image`, `largeur`, `hauteur`, `pastilles[]`.
- `pastilles[]` : `id` (ex. `3.2`, `B.5`), `x`, `y` **en pixels de l'image** (afficher en % : x/largeur, y/hauteur), `titre`, `texte`, `conseil` (facultatif), `niveau`, `etat`, `zone` (facultatif), `special` (facultatif), `mots_cles` (facultatif, liste de mots pour la recherche).
  - `etat` : `actif` (pastille bleue), `non_utilise` (pastille grise), `preregle` (grise, réglage automatique).
  - `zone` : rectangle voilé sur la capture (gris pour non utilisé, orange léger pour préréglé) avec son `libelle`.
  - `niveau` du conseil : `avertissement` (encadré rouge ⚠️), `astuce` (💡), `a_completer` (bleu — **visible seulement par l'admin**).
  - `special: "menu_blanc"` : liste des 7 modes de blanc (voir `modes-blanc.json`), chacun avec son aperçu « noir = blanc » et son explication ; pour **Support** et **Sous-uni**, une fenêtre « Quel blanc choisir ? » à 2 onglets (aperçu logiciel + résultat sur mur foncé, images `pw_*` et `r_*`).
- `navigation` : pastilles grises cliquables pour changer d'écran (onglets T1–T11 de FlexiPRINT, menus D1–D8 et sous-menus de DXonJet) + boutons communs `E` (Envoyer) / `A` (Accepter) sur les onglets FlexiPRINT.
- Fenêtres recréées (`ajouter_travail`, `enregistrer_sous`) : fausses fenêtres Windows (dossiers neutres, fichier `smiley.jpg`). Voir le prototype (`dlgHTML`, `envHTML`).

### Affichage (repris du prototype, mobile d'abord)
- Capture + pastilles ; toucher une pastille → **fiche en bas d'écran** (titre, texte, conseil, bouton ✕).
- Bouton **🔍 zoom** : capture à 240 % avec défilement horizontal au doigt.
- **Menus repliables** par groupe ; le groupe de l'écran affiché est ouvert.
- Zone tactile des pastilles élargie (≈ 7 px autour).
- Sous la capture : liste des repères (cliquable).
- Filigrane du code écran : option admin « afficher les repères » (utile à Teddy pour ses corrections), masqué pour les clients.
- Plus tard (phase 5) : écrans interactifs du prototype — T5 poignées d'angle (échantillon à taille réelle, bouton Remise), T9 aperçu canal par canal, enchaînement Travail → fenêtre → travail dans la file → propriétés.

## 5. Module Procédures (priorité 4)
Teddy doit pouvoir **créer et modifier les procédures depuis son téléphone, sans déploiement**.
### Données
- `Procedure` : titre, catégorie (impression, entretien, réglages…), résumé, module, publiée oui/non, ordre, dates.
- `EtapeProcedure` : ordre, texte, avertissement facultatif, photo facultative (stockage existant, compression comme les fiches), lien facultatif vers une pastille (`guide`, `ecran`, `pastille`).
- `ProcedureLien` : liens procédure ↔ pastilles (plusieurs possibles).
### Écrans
- **Administration → Procédures** : liste, création, modification, ordre des étapes (monter/descendre), photos, publication. Même style que Administration → Messages.
- **Client** : onglet Procédures (par catégorie + recherche), détail avec étapes **cochables** (état local), photos agrandissables.
- Dans la fiche d'une pastille : bouton **« 📋 Voir la procédure »** si une procédure y est liée.
- Dans une étape : bouton **« Voir le bouton »** → ouvre l'écran du guide avec la pastille en surbrillance.
- Un message peut renvoyer vers une procédure (lien interne).
### Premières procédures (contenu fourni plus tard par Teddy)
1. Reprendre une impression stoppée (DXonJet `B.5`).
2. Modifier un réglage pendant l'impression : Pause → reculer la tête → modifier → tête en automatique → relancer (DXonJet `D3-a` `a.4`, `a.5`, `a.8`).
3. Mode voyage et nettoyage toutes les 72 h (DXonJet `P.6`).
4. Choisir entre WKCMY et KCMYW (DXonJet `B.6`).

## 6. Animations (priorité 5)
Reprendre les 3 animations du prototype (`prototype/index.html`) : « Impression couleur simple », « Impression couleur + blanc » (avec la fenêtre Support / Sous-uni), « Les réglages du blanc » (7 modes, résultat sur mur foncé).
Voix off selon les règles de Teddy : `speechSynthesis` fr-FR ; voix « Google français » en premier, puis Julie, puis Natural/Online/Neural (Denise, Henri), puis toute voix fr-FR, menu déroulant rechargé sur `voiceschanged` ; tableau NARR par scène [temps, phrase orale sans symboles] ; sous-titre synchronisé ; la voix pilote le temps (l'animation se fige avant le repère suivant, reprise de sécurité après durée estimée) ; case « Voix off » cochée par défaut ; vitesse ×0,25–×2 (débit voix 0,6–1,6) ; Pause coupe la voix, Lecture relit la phrase ; clic scène ou Recommencer repart au bon repère ; sans voix FR : « Aucune voix française trouvée. Essayez Edge ou Chrome. » ; démarrage seulement après clic Lecture.

## 7. Découpage conseillé
| Phase | Contenu | Livrable testable |
|---|---|---|
| 1 | Modules + droits + admin + clé API + ciblage messages | un compte ne voit que ses modules |
| 2 | Marque par domaine + manifeste + Traefik | app.kiavikprint.com affiche la marque Kiavik |
| 3 | Guides (import JSON, rendu, mobile) | FlexiPRINT et DXonJet consultables |
| 4 | Procédures (admin + client + liens pastilles) | Teddy crée une procédure sur son téléphone |
| 5 | Écrans interactifs + animations | parcours animés |

À chaque phase : migration Prisma, seed idempotent, tests (`test:kit`, `test:e2e`), README / ARCHITECTURE à jour, déploiement Coolify.

## 8. Points ouverts (à confirmer avec Teddy)
- Domaine exact Kiavik (app.kiavikprint.com ?), logo et couleurs Kiavik.
- DXonJet `D4-a` / `a.6` (Offre / Composition des encres) : rôle exact à compléter.
- DXonJet `D2` / `2.2` (onglets Activité / Histoire) : garder ou griser.
- Les pastilles `a_completer` restantes.

## 9. Décisions et état (novembre 2026)
- **Domaine Kiavik : `app.kiavikcopilot.ovh`** (nom affiché « Kiavik Copilot »). Lazzeko reste sur `app.lazzeko.com`.
- **Une seule app, deux espaces** (`lazzeko`, `kiavik`) : une base, un seul admin, comptes / messages / clés API gérés au même endroit. Kiavik n'utilise pas la communauté.
- Espaces et modules définis dans `apps/api/src/espaces/espaces.ts` (pas de table) ; accès par compte dans `UserModule`. Un compte peut être dans les deux espaces.
- Conditions d'utilisation **par espace** (`AcceptationConditions`), texte Kiavik sans partage communautaire.
- Messages : champ `espaces` (vide = tous) ; lien interne autorisé (`/procedures…`).
- Écrans propres à Kiavik : `apps/app/src/espaces/kiavik/` (Guides et Procédures provisoires).
- **Fait** : phases 1 et 2 (modules, droits, admin, clé API, ciblage messages, marque par domaine, manifeste, Traefik).
- **Fait** : phase 3 (guides FlexiPRINT et DXonJet : `apps/api/src/guides/`, `apps/app/src/espaces/kiavik/`). Les JSON restent dans `kit-guides/guides/` (pas de table `Guide`, lus au démarrage) ; les images sont servies par `/api/guides/images/`.
- **À faire** : phase 4 (procédures), 5 (écrans interactifs T5 / T9 et animations). Logo et couleurs Kiavik à fournir (couleur provisoire `#1d6fb8`).
