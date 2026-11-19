# 🎓 Académie

Des **parcours** (formations en plusieurs leçons) et des **pages** (un contenu seul : simulateur, fiche technique, vidéo), pour Lazzeko et Kiavik. Un **module isolé** :
ses tables, ses routes, son dossier d'app ; seuls le bouton « 🎓 Académie » de la barre du bas et une entrée d'administration le relient au reste.

## Pour l'admin (sur ordinateur, de préférence)
**Administration → 🎓 Académie** (section Commun) :
1. Choisir **📚 Parcours** ou **🧰 Page**, donner le titre, créer.
   - **Parcours** : formation en plusieurs leçons (progression du client) ; ou **🎬 Créer depuis Vimeo** : plusieurs liens (un par ligne), une leçon par vidéo.
   - **Page** : un contenu seul, rangé dans « 🧰 Mes outils » du client (ex. « Simulateur 300 W ») ; on arrive directement sur son contenu (blocs).
     Une page faite d'**un seul bloc Simulateur** (ou HTML) s'affiche **en plein écran** : le simulateur a toute la hauteur, ses panneaux s'ouvrent normalement.
2. **Régler** : type, description, image de couverture (sinon la vignette de la 1ʳᵉ vidéo), **Pour qui ?** (tout le monde, des **modèles** précis ou des **catégories** de machines), **Publié**.
   Un contenu ciblé n'est **visible que** par les clients qui ont ces machines (pas de cadenas pour les autres).
3. **Leçons** (parcours) : ＋ Leçon, ↑ ↓, 🗑. Chaque leçon (et chaque page) est faite de **blocs** : **＋ Bloc**, ↑ ↓, 🗑, **👁 Aperçu**, **Enregistrer**.

| Bloc | Usage |
|---|---|
| Titre | intertitre |
| Texte | ligne vide = paragraphe, « - » = liste, `**gras**`, `*italique*`, `[lien](https://…)` |
| 🎬 Vimeo | coller le lien (vidéo non répertoriée acceptée) : titre, vignette et durée remplis automatiquement ; le lecteur ne se charge qu'au toucher |
| 🖼 Image | photo compressée par l'app, légende |
| 💡 Encadré | astuce ou ⚠️ attention |
| 🖥 Simulateur | choisi dans la bibliothèque ; dans une leçon : boîte à hauteur d'écran (il défile dedans) + ⤢ plein écran ; seul dans une page : tout l'écran |
| 🧩 HTML libre | votre code, dans une boîte isolée (hauteur automatique jusqu'à 85 % de l'écran, ou fixe, ⤢ plein écran) |
| 📎 Fichier | PDF envoyé ou lien https |

**🖥 Bibliothèque de simulateurs** (lien en haut de la page Académie) : un fichier HTML par machine, envoyé une fois (nom, espace, machine) ;
**⟳ Remplacer** met à jour toutes les leçons qui l'utilisent ; 👁 pour l'essayer.

**Vimeo** : réglez vos vidéos en « non répertoriée » et, si votre offre le permet, « intégrable seulement sur » `app.lazzeko.com` et `app.kiavikcopilot.ovh`.

## Pour le client
Bouton **🎓 Académie** dans la barre du bas (Lazzeko et Kiavik) → **🧰 Mes outils** (les pages de ses machines), puis **📚 Parcours** (vignette, nombre de leçons, avancement).
**Ma machine** affiche aussi les pages faites pour cette machine (ou sa catégorie).
Un parcours : sommaire, **▶ Commencer / Reprendre** ; une leçon : ses blocs, **Marquer comme terminée**, **Leçon suivante →** (la marque terminée).
Accès : module « Académie » de l'espace (donné à tous les clients existants à la mise à jour ; à cocher pour les nouveaux, ou fourni par l'import).

## Sécurité
Le HTML libre et les simulateurs s'affichent dans une `iframe` **sandbox sans `allow-same-origin`** (origine opaque) : le code tourne
mais ne peut lire ni le compte du client ni l'app. Le HTML est renvoyé en JSON (jamais servi comme page de l'app).

## Technique
- API `apps/api/src/academie/` : `CoursAcademie`, `LeconAcademie` (`blocs` en JSON, vérifiés par `blocs.ts`), `SimulateurAcademie` (fichier HTML en stockage),
  `FichierAcademie` (images, PDF), `ProgressionAcademie`. Visibilité : `procedures/visibilite.ts` (même « Pour qui ? » que les pas-à-pas).
  Routes : `GET /academie`, `/academie/cours/:id`, `/academie/lecons/:id`, `POST /academie/lecons/:id/terminee`, `GET /academie/simulateurs/:id` (JSON), `/academie/fichiers/:id` ; admin : `/admin/academie/…`.
  Modules `academie-lazzeko`, `academie-kiavik` (`@ModuleRequis(moduleAcademie)`). Corps JSON jusqu'à 2 Mo (`main.ts`).
- App `apps/app/src/academie/` : `Pages.tsx` (liste, cours, leçon, `LienAcademie`), `Blocs.tsx` (rendu, `IframeIsolee`), `Admin.tsx`, `donnees.ts`, `academie.css`.
