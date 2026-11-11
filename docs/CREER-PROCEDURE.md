# Créer une procédure ou un diagnostic à deux

**Le principe** : vous résumez les étapes (même en vrac), Claude prépare la procédure complète en **brouillon**, vous la **finissez dans l'app** (photos, vérification, publication).

```
Vous : résumé  ──►  Claude : brouillon prêt  ──►  déploiement  ──►  Vous : finitions dans l'app, publier
```

---

## 1. Ce que vous envoyez à Claude

Copiez ce modèle dans la conversation et remplissez ce que vous savez. **Tout est facultatif sauf le titre et les étapes** ; des phrases courtes ou des notes en vrac suffisent, Claude reformule.

```
NOUVELLE PROCÉDURE (ou NOUVEAU DIAGNOSTIC)
Titre :
Logiciel / machine : FlexiPRINT / DXonJet / machine
Catégorie : Mise en route / Diagnostic / Impression / Réglages / Entretien / autre
Pour qui / quand l'utiliser : (symptômes, situation)

Étapes (dans l'ordre, une par ligne) :
- Partie 1 : …
  - …
- Partie 2 : …
  - …

Questions (diagnostic) :
- Question : « … ? »
  - Si oui : … puis (on continue / c'est réglé / contacter Kiavik)
  - Si non : … puis (on continue / c'est réglé / contacter Kiavik)

Boutons du logiciel à montrer : (nom du bouton tel qu'on le voit, ex. « Pompe à encre », « Test des buses »)
Attention / sécurité : (ce qu'il ne faut pas faire, machine éteinte…)
Ensuite : (procédure à proposer à la fin, ex. « réglage DXonJet » puis « impression »)
Pour l'IA (facultatif) : ce qu'elle doit savoir ou ne jamais conseiller
```

**Exemple (diagnostic de la pompe, déjà dans l'app)**
```
NOUVEAU DIAGNOSTIC
Titre : la pompe à encre
Logiciel : DXonJet — Catégorie : Diagnostic
Quand : l'encre n'arrive pas aux têtes, impression vide ou pâle
Étapes : allumer la machine, ouvrir DXonJet ; appuyer sur Pompe à encre
Question : tu entends la pompe ?
  - oui : vérifier que l'encre coule dans la bouteille ; si elle ne coule pas → contacter Kiavik (tuyau pincé, filtre, bouteille vide)
  - non : vérifier que le bouton Pompe est activé ; si toujours rien → contacter Kiavik (alimentation ou pompe)
Ensuite : laisser l'encre arriver, arrêter la pompe, test des buses
Pour l'IA : ne jamais conseiller de démonter la pompe
```

**Astuces pour le résumé**
- Un **geste par étape** (« Appuyer sur Pompe », pas « Appuyer sur Pompe puis vérifier… »).
- Pour un diagnostic : des **questions fermées** (oui / non, ou 3–4 choix clairs) et, pour chaque réponse, **ce qu'on fait** puis **la suite** (on continue, c'est réglé, ou on contacte Kiavik avec la cause probable).
- Citez les boutons par leur **nom à l'écran** : Claude retrouve l'écran et le repère dans le guide.
- Si vous avez des photos, gardez-les pour l'étape 3 (on les ajoute dans l'app).

---

## 2. Ce que Claude prépare

Claude ajoute la procédure à `kit-guides/procedures.json` **en brouillon** (`"publiee": false`), avec :
- le **titre**, la **catégorie**, le **résumé** (court, vu par le client) et la **description** (pour vous et l'IA) ;
- les **étapes** reformulées (phrases courtes, à l'impératif), rangées en **parties** (« Partie — étape ») ;
- les **avertissements** ⚠️ ;
- les **boutons liés** (`lien` : guide, écran, repère) retrouvés dans les guides ;
- les **contrôles Oui / Non** simples (`controle`) ;
- pour un diagnostic : les **questions**, leurs **réponses** avec la **signification**, les **détours**, la **suite** (`retour`, `resolu`, `contact`) et la **conclusion** des fins ;
- la **procédure suivante** (`suivante` : clé d'une autre procédure), proposée à la fin par « Continuer avec … ? » ;
- les **notes** pour l'IA et un **prompt** de procédure si vous en avez donné les consignes.

Puis : pull request, tests, fusion. **Au prochain déploiement**, la procédure apparaît dans Administration → Procédures (badge « brouillon »), invisible pour les clients.

> Le seed ne crée une procédure que si sa clé n'existe pas encore : il **n'écrase jamais** vos modifications dans l'app. Pour refaire une procédure déjà créée, Claude en prépare une nouvelle version (nouvelle clé) et vous supprimez l'ancienne, ou vous corrigez directement dans l'app.

**Format (pour Claude)** — une entrée de `procedures` :
```json
{
  "cle": "dx-diag-pompe",
  "titre": "Diagnostic : la pompe à encre",
  "categorie": "Diagnostic",
  "resume": "Court, vu par le client dans la liste.",
  "description": "À quoi elle sert, quand l'utiliser, symptômes (pour l'admin et l'IA).",
  "prompt": "Consignes pour l'IA (facultatif).",
  "publiee": false,
  "suivante": "dx-autre-procedure",
  "etapes": [
    { "texte": "Préparation — Allumer la machine." },
    { "texte": "Préparation — Appuyer sur Pompe à encre.", "lien": ["dxonjet", "dc", "P.9"], "avertissement": "…" },
    { "texte": "Contrôle — Les buses sont propres ?", "controle": true },
    {
      "texte": "Pompe — Tu entends la pompe fonctionner ?",
      "note": "Pourquoi cette question (pour l'IA).",
      "choix": [
        { "libelle": "Oui", "signification": "…", "etapes": [{ "texte": "Vérifie que l'encre coule." }] },
        { "libelle": "Non", "signification": "…", "suite": "contact", "conclusion": "Cause probable, que faire.",
          "etapes": [{ "texte": "Vérifie le bouton Pompe.", "lien": ["dxonjet", "dc", "P.9"] }] }
      ]
    }
  ]
}
```
- `cle` : unique, courte (`dx-…` DXonJet, `fp-…` FlexiPRINT, `ma-…` machine).
- `suivante` (facultatif) : clé de la procédure proposée à la fin ; réglée par le seed seulement à la création, ensuite dans l'app (« ➡ Procédure suivante »).
- `suite` : `retour` (par défaut : on reprend après la question), `resolu`, `contact`. Les sauts vers une étape, les astuces et procédures proposées se règlent ensuite dans l'app.
- Repères des boutons : `kit-guides/guides/*.json` (écrans `id`, `pastilles[].id`) ; dans l'app, l'admin peut afficher les codes (option « afficher les repères »).

---

## 3. Ce que vous finissez dans l'app (sur PC de préférence)

Administration → 📋 Procédures → la procédure (brouillon) :
1. **Lire le schéma** : ordre, parties, textes. Corriger directement (cliquer sur une étape).
2. **Photos** : 📷 sur les étapes qui en ont besoin (jusqu'à 8, la première est la principale).
3. **Boutons liés** : vérifier avec « Voir comme un client › » → « 👆 Voir le bouton ».
4. **Diagnostic** : vérifier les **alertes** en haut du schéma, régler si besoin un **saut** (« Aller à l'étape… »), une **astuce** ou une **procédure** proposée sur une réponse.
5. **IA** (facultatif) : relire la description et le prompt ; le **résumé automatique** se met à jour tout seul.
6. **Tester** : « Voir comme un client › » → **▶ Démarrer le parcours guidé**, en répondant à chaque branche.
7. **Publier** : case « Publiée » en haut.

Ensuite, suivez les retours : **❓ Pas clair ?** (étapes à améliorer), **📊 statistiques** (où l'on s'arrête, réponses les plus fréquentes), **🩺 Diagnostics reçus**.

---

## 4. Sans Claude

Tout se fait aussi dans l'app : « Créer » une procédure, puis le schéma (« + » pour insérer une étape, « ❓ Transformer en question », « + réponse »…). Pour une procédure proche d'une autre : **⧉ Dupliquer**.
