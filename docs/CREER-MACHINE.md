# Créer une machine (fiches de réglage Lazzeko)

Une conversation par machine (session Claude Code sur ce dépôt : ce guide est la référence).
Chaque machine est **isolée dans un fichier** : facile à retrouver et à modifier plus tard.

## 0. Où se trouve quoi
| Quoi | Où |
|---|---|
| Écran de réglage d'une machine (réglages, unités, min / max, ce qui est enregistré) | `machines/<fabricant>/<modèle-variante>/v1.json` (exemples : `machines/lazzeko/laser-pulse-300w/v1.json`, `machines/lazzeko/zeko-mini-300/v1.json` : 2 pages, 8 trajectoires, plafond 15 mJ) |
| Calculs d'une technologie (énergie, recouvrement…) | `packages/machine-kit/src/calculs/` (une par technologie : `laser-pulse` ; demain la soudure) |
| Gamme, image, variantes, plans d'entretien, guides, Académie | dans l'admin (rien à coder) |

## 1. Ce que l'utilisateur rassemble (à donner à Claude)
- **Identité** : fabricant, modèle, variante (ex. puissance), **gamme** (Lazzeko · Décapeuse / Soudeuse / Accessoire), notice (nom, version), version du logiciel machine si connue.
- **Photos de chaque écran** de réglage de la machine (de face, lisibles), ou le simulateur HTML de l'écran.
- **Pour chaque réglage** : nom affiché, **unité**, **minimum**, **maximum**, **pas**, **valeur par défaut**, s'il dépend d'un autre (ex. « visible seulement en mode anneau »), et s'il doit être **enregistré dans la fiche** (ceux qu'on veut comparer entre clients).
- **Constantes** utiles aux calculs (ex. puissance maximale) et ce qui est une **hypothèse** à confirmer.
- **Préréglages** du fabricant s'il y en a (valeurs d'usine).
- **Indicateurs** souhaités (ex. énergie par impulsion, recouvrement) : seulement si la technologie sait les calculer.

## 2. Ce que Claude prépare
1. Le fichier `machines/<fabricant>/<modèle-variante>/v1.json` en copiant l'exemple 300 W :
   - `technologie` (ex. `laser-pulse`), `fabricant`, `modele`, `variante` (slugs en minuscules et tirets), `versionInterface: 1` ;
   - **modèle déjà créé dans l'admin** : mettre son identifiant complet dans `modele.id` (clic sur sa référence `M-…` pour le copier) et `variante.slug: "standard"`. Le fichier se rattache à ce modèle (nom, gamme, image, clients gardés) au lieu d'en créer un autre ;
   - constantes du calcul `laser-pulse` : `pmax` (W), `emax` (mJ, plafond par impulsion, facultatif), `spot_mm` (spot fixe) ou `spot_f254_mm` (spot proportionnel à la lentille) ; le champ `speed` peut être en `m/s` ou en `mm/s` (d'après son `unite`) ;
   - `pages → sections → champs` (types `nombre`, `interrupteur`, `choix`, `texte` ; voir [ARCHITECTURE.md](ARCHITECTURE.md)) avec `enregistre: true` pour les réglages de la fiche ;
   - `constantes`, `hypotheses`, `presets`, `guide` (aide de l'app) ;
   - la **fiche d'identité** `source` : `{ "date": "2026-11-20", "auteur": "…", "notice": "Notice X v2.1", "firmware": "…", "notes": ["vitesse max lue sur l'écran", "…"] }`.
2. Une **liste de contrôle** des valeurs incertaines (à vérifier sur la machine).
3. Les vérifications : `npm run test:kit` (le fichier est contrôlé), puis l'écran de saisie dans l'app (« Nouvelle fiche » avec cette machine).
4. Branche, pull request, fusion ; en production : redéployer (le seed charge le fichier).

## 3. Dans l'admin, après le déploiement
1. **Machines** : le modèle apparaît → choisir sa **gamme**, ajouter l'**image**.
2. **Utilisateurs** : ajouter la machine aux clients (n° de série, mise en service).
3. **Entretien** : plan d'entretien (par gamme / catégorie ou par modèle).
4. **Académie** : simulateur HTML de l'écran (bibliothèque), cours de prise en main.
5. **Pas-à-pas / Bon à savoir** : « Pour qui ? » sur ce modèle si besoin.

## 4. Modifier une machine plus tard
- Correction (texte, limite, défaut) : modifier le fichier, `npm run test:kit`, redéployer.
- **Le fabricant change son menu** : nouveau fichier `v2.json` à côté (`versionInterface: 2`). Les anciennes fiches restent sur la v1 (affichées comme elles ont été faites), les nouvelles utilisent la v2.

## 5. Projet claude.ai (facultatif, pour préparer sur le terrain)
Instructions à coller dans le projet : « Tu aides à préparer la fiche machine d'une nouvelle machine Lazzeko pour l'app, en suivant le guide CREER-MACHINE.md (en connaissance, avec l'exemple v1.json 300 W). À partir de mes photos et notes, prépare le fichier v1.json complet (avec le bloc `source`) et la liste des valeurs incertaines. Réponds en français, simplement. » Le fichier obtenu est ensuite donné à une session Claude Code pour l'ajouter et le tester.
