# Guide de l'administration

Compte → **Administration** (en français ; les écrans clients peuvent être traduits, voir [TRADUCTION.md](TRADUCTION.md)). L'admin a accès à tout, dans les deux espaces (Compte → **Mes espaces** pour passer de Lazzeko à Kiavik).

## Organisation de l'administration
Un menu court, en **sections** avec un badge de couleur : **Commun** (gris), **Lazzeko** (orange), **Kiavik** (bleu). Le même badge est sur le titre de chaque page.
- Toujours dans le même ordre : **Commun**, puis **Lazzeko**, puis **Kiavik**. Chaque section se replie (▸ / ▾) ; le téléphone s'en souvient. Au départ, seule la section de l'espace ouvert est dépliée ; un compteur rouge sur le titre signale ce qui attend (tags, demandes d'aide). Ouvrir une entrée d'un autre espace **bascule dans cet espace**.
- **Commun** : 👥 Utilisateurs, 💬 Messages, 📜 Conditions d'utilisation, 🔑 Clés API, 📤 Envoi vers une API. En haut, toujours : 🔐 Mots de passe oubliés et 🔔 Notifications.
- **Lazzeko** : 📝 Fiches de réglage, 🔧 Machines, ⭐ Avis, 🏷️ Tags proposés, 🆘 Demandes d'aide (avec le nombre en attente).
- **Kiavik** : 🏠 Accueil et catégories, 📋 Pas-à-pas, 🩺 Dépannages reçus, 💡 Bon à savoir.

**Noms des contenus Kiavik** : **Pas-à-pas** (anciennement procédures), **Dépannage guidé** (procédure avec des questions, anciennement diagnostic), **Bon à savoir** (anciennement astuces & solutions), **Démos animées** (animations). Côté clients, ces noms sont dans `apps/app/src/textes/fr.ts` (une ligne à changer pour renommer).

**Publiée / Non publiée** (anciennement « brouillon ») : 🔒 *non publiée* = visible seulement par l'admin, pour préparer et tester ; ✅ *publiée* = visible par les clients qui ont l'accès « Pas-à-pas et Bon à savoir ». Case « Publiée » en haut de l'écran de modification.

## Machines (Lazzeko et Kiavik)
Administration → **🔧 Machines** (section Commun).
- **+ Nouveau modèle** : fabricant (existant ou nouveau, ex. DXonJet), modèle (ex. i3200), **visible dans** Lazzeko et/ou Kiavik. Une variante « Standard » est créée avec ; ajoutez-en d'autres (largeur, nombre de têtes…).
- Par modèle : cases « Visible dans… », ✏️ renommer, 🗑 (seulement si aucune machine de client ni fiche de réglage ne l'utilise ; sinon **Désactiver** la variante).
- **Image** : PNG par modèle (machine entière, fond transparent ou clair, ~800 × 800 px) ; une variante peut avoir la sienne.
- Les modèles Lazzeko avec écran de réglage viennent des fichiers `machines/` (fiches de réglage) ; ceux créés ici n'ont pas de fiches de réglage (carnet d'entretien à venir).

## Carnet d'entretien (Lazzeko et Kiavik)
Administration → **📒 Entretien** (section Commun).
- **Plans d'entretien** : « + Créer » un plan (ex. *Entretien DXonJet*), cocher les **modèles concernés** (un plan sert à plusieurs modèles, ex. i3200 et F1080), puis ajouter les **tâches** :
  - **fréquence** : tous les N jours / semaines / mois ; « **bientôt** » N jours avant (au plus un quart de la période) ;
  - **pas-à-pas à suivre** (facultatif) : le client l'ouvre depuis son carnet ; quand il le termine, la tâche est notée toute seule ;
  - **photo** quand c'est fait : non, facultative ou **obligatoire** (+ quoi photographier) ; compressée sur le téléphone avant l'envoi ;
  - **réservée à un technicien** : le client la voit mais ne peut pas la valider (vous la notez).
- **Suivi des machines** : toutes les machines qui ont un plan, filtres **à faire / en retard / bientôt / toutes**, **modèle**, recherche client / n° Odoo / n° de série ; compteur rouge dans le menu. Toucher une machine ouvre son **carnet** (aussi depuis Utilisateurs → 🔧 Machines → 📒) : « 🧑‍🔧 Noter une intervention » sur n'importe quelle tâche, notes, historique.
- **Les échéances glissent** : prochaine = date où c'est vraiment fait + fréquence (fait au bout de 2 mois au lieu de 3 → le suivant 3 mois plus tard). Au départ : date de mise en service de la machine.
- **Côté client** : « 📒 Carnet d'entretien » (accueil Kiavik, Compte, Mes machines) : ✅ à jour, 🟠 bientôt, 🔴 en retard ; **✓ C'est fait** (date, note, photo), **▶ Voir le pas-à-pas**, **+ Ajouter une note** (ses propres notes, avec photo, même hors du plan), historique.
- **Rappels par email, SMS ou WhatsApp avec n8n** : `GET /api/admin/entretien/echeances` (clé API) donne une ligne par tâche en retard ou bientôt due (client avec n° Odoo, machine, tâche, liens vers le carnet et le pas-à-pas) ; webhook **`entretien.fait`** quand une tâche est notée. Voir [API.md](API.md).
- ⚠️ Données nominatives : à mentionner dans les conditions d'utilisation.

## Comptes clients
Administration → **👥 Utilisateurs** (« + Créer un utilisateur » en haut, puis la liste).
- **Créer** : identifiant, mot de passe (8 caractères min.), nom, n° client Odoo (facultatif).
- **Accès** : cases par espace.
  - Lazzeko : *Réglages décapage*.
  - Kiavik : *Guide Flexiprint*, *Guide DXonJet*, *Pas-à-pas et Bon à savoir*.
  - Un client peut avoir des accès dans les deux espaces.
- **Client Lazzeko** (si accès Lazzeko) : décocher pour un utilisateur d'une autre marque. Sert à cibler les messages.
- Dans la liste : recherche (identifiant, nom, n° Odoo), filtre par espace, badges d'espace, conditions acceptées, accord photos.
- **Langue** : par défaut celle du téléphone du client. Dès qu'une deuxième langue existe (anglais prévu), elle se choisit sur le compte (ou par le client dans Compte, ou depuis Odoo avec `langue`).
- **Machines du client** : c'est **vous** qui les ajoutez, dès la création (bloc « Machines du client ») ou ensuite en touchant le compte (🔧 Machines) : modèle, **n° de série**, **date de mise en service** (aujourd'hui par défaut), surnom. ✏️ pour corriger, 🗑 pour retirer (ses fiches de réglage restent). Le client voit ses machines (dans l'espace où le modèle est visible) et peut seulement changer le surnom.
- Toucher un compte : modifier ses accès, son n° Odoo, voir ses fiches, ses machines. **Désactiver** bloque la connexion sans rien supprimer.
- Comptes créés par Odoo : voir [API.md](API.md).

Astuce captures d'écran : un compte « démo » avec tous les accès, ouvert en navigation privée, montre exactement ce que voit un client.

## Messages (bulles à l'ouverture de l'app)
Administration → **💬 Messages**.
- **Espace** : tous, Lazzeko ou Kiavik. **Niveau** : 💡 Conseil, ℹ️ Info, ⚠️ Important (affiché en grand).
- **Lien** facultatif : adresse web (`https://…`) ou page de l'app (`/procedures`).
- **Une fois** ou **périodique** : revient tous les N jours / semaines / mois après « J'ai compris » (ex. « Pensez à nettoyer la lentille » chaque mois).
- **Ciblage** : clients Lazzeko ou autres marques, machines, n° clients Odoo. Le nombre de personnes touchées s'affiche avant publication.
- **Question** facultative (une par message) : Oui / Non, choix (2 à 5 + « Autre… »), note 1 à 5 ★, texte court. Obligatoire ou non.
- **Résultats** : vus, « compris », réponses en %, détail par personne et par période, export CSV.
- **Date après Oui / Non** (« Demander ensuite une date ») : après « Non », « Oui » ou les deux, le client indique une date (« À quelle date l'avez-vous fait la dernière fois ? ») ou « Je ne sais plus ». Visible dans les résultats (📅) et l'export CSV.
- **🔧 Pas-à-pas à faire (rappel d'entretien)** : avec une question Oui / Non, le client qui répond « Non » voit « ▶ Faire le pas-à-pas maintenant » ; sans question, le bouton est dans la bulle. Quand il le **termine**, c'est noté (✅ dans les résultats et dans son historique). Le pas-à-pas doit être publié.
- **Le plus simple** : dans l'écran d'un pas-à-pas, **🔁 Rappel d'entretien** ouvre un message déjà rempli (question Oui / Non, date après « Non », tous les 6 mois, espace Kiavik) ; il reste à choisir à qui (n° Odoo) et publier.
- **Historique d'entretien** d'un client : Utilisateurs → toucher le compte → **🔧 Entretien** (réponses aux rappels avec la date, pas-à-pas terminés).
- ⚠️ Ces réponses et pas-à-pas terminés sont **nominatifs** : à mentionner dans les conditions d'utilisation Kiavik (partie « Vos données »).
- Ce n'est pas une messagerie : les clients ne peuvent pas écrire librement.

## Conditions d'utilisation
- Une version **par espace** (onglets Lazzeko / Kiavik). Lazzeko : partage communautaire obligatoire. Kiavik : pas de communauté.
- **Publier une nouvelle version** oblige les clients de cet espace à accepter de nouveau.
- Accord photos (Lazzeko) : facultatif, réglé par le client dans Compte → Mes photos. Filtre : Toutes les fiches → **📷 Photos utilisables**.
- Les textes de départ sont des projets : à faire relire par un juriste.

## Lazzeko : modération et réglages
- **Toutes les fiches** : auteur, masquer / réafficher avec une raison.
- **Avis** : masquer ceux qui ne conviennent pas (l'auteur voit la raison ; un avis masqué ne compte plus dans la moyenne).
- **Tags proposés** par les clients : à valider.
- **Demandes d'aide** : bouton masqué par défaut, activable ; liste des demandes reçues.
- **Envoi vers une API** : webhooks pour une modération automatique (voir [API.md](API.md)).

## Kiavik : accueil
- En haut : la recherche et **les deux logiciels** (toujours visibles).
- Dessous : une **section repliable par catégorie** (🚀 Mise en route, 🩺 Diagnostic, 🖨️ Impression, 🎛️ Réglages, 🧽 Entretien, puis les autres) avec ses procédures guidées (animations), procédures, diagnostics et astuces. Le client ouvre ce qui l'intéresse (une seule section ouverte à la fois : en ouvrir une ferme les autres) ; le téléphone se souvient de la section ouverte.
- **Administration → 🏠 Accueil et catégories** : tout le classement au même endroit.
  - **Catégories** (à gauche, dans l'ordre de l'accueil) : ↑ ↓ pour l'ordre, ✏️ pour **renommer** et changer l'**icône** (tout son contenu suit, animations comprises), 👁 / 🙈 pour **masquer** la section de l'accueil (le contenu reste dans les listes et la recherche), 🗑 pour **supprimer** (si elle n'est pas vide : choisir la catégorie qui reçoit son contenu), **+ Ajouter** une catégorie (même vide). Cliquer sur une catégorie filtre la liste.
  - **Liste** (à droite) : toutes les procédures, diagnostics, astuces et animations, avec **filtres** (catégorie, type, logiciel, publié / brouillon) et recherche par titre. Le menu de chaque ligne la **range** dans une autre catégorie ; cocher plusieurs lignes pour les ranger d'un coup. « ⚠️ catégorie inconnue » signale un élément rangé dans une catégorie qui n'existe plus.
  - **Ordre dans une catégorie** : cliquer sur une catégorie (sans autre filtre) affiche son contenu par groupe, comme sur l'accueil (▶ démos animées, 📋 pas-à-pas et dépannages guidés, 💡 Bon à savoir), avec ↑ ↓ pour changer l'ordre d'affichage dans chaque groupe.
- La catégorie se choisit aussi dans le menu **Catégorie** d'une procédure, d'une astuce, ou d'une animation (ouvrir l'animation → « ✏️ Modifier cette scène » → **Catégorie sur l'accueil**, « Revenir à l'original » pour reprendre celle du fichier).

## Kiavik : pas-à-pas (procédures)
Dans l'espace Kiavik : Administration → **📋 Pas-à-pas** (ou onglet Pas-à-pas → « Gérer les pas-à-pas »).
- **Créer** : un titre, puis les étapes dans le schéma (texte, avertissement, photos, bouton lié). Pour gagner du temps : résumez les étapes à Claude, il prépare le brouillon, vous le finissez — voir **[CREER-PROCEDURE.md](CREER-PROCEDURE.md)**.
- **Lier un bouton** : sur une étape, choisir le logiciel, l'écran puis le bouton. Le client voit « 👆 Voir le bouton » dans l'étape (la capture s'ouvre par-dessus la liste, bouton entouré), le bouton est aussi montré dans le **parcours guidé** (une étape à la fois, plein écran), et « 📋 Voir la procédure » quand il touche ce bouton dans le guide.
- **L'écran de modification** (pensé pour le PC, utilisable sur téléphone) : à gauche le **schéma**, à droite l'élément choisi. Cliquez sur une étape, une question ou une réponse pour la modifier. « **+** » (au survol, entre deux étapes) insère une étape à cet endroit.
- **Contrôle Oui / Non simple** : cocher « Contrôle Oui / Non simple » sur une étape. Le client répond **Oui** (l'étape est cochée) ou **Non** : on lui affiche alors l'astuce choisie (ou « Corrigez le problème avant de continuer »).
- Dans le **parcours guidé**, le client peut faire lire les étapes à voix haute (🔊) ; l'écran reste allumé pendant le parcours.
- **Photos** : jusqu'à **8 par étape** (« 📷 Ajouter des photos », plusieurs à la fois). Flèches ← → pour l'ordre (la première est la principale), ✕ pour en retirer une. Le client les fait défiler au doigt, et les ouvre en plein écran.
- **❓ Pas clair ?** : sous chaque étape (liste et parcours guidé), le client peut signaler une étape difficile, avec un message facultatif. Vous recevez une **notification** ; la liste des procédures montre « ❓ n », le schéma signale l'étape en haut, et le panneau de l'étape liste les messages (« ✓ Traité » quand c'est corrigé). Webhook `etape.signalee`.
- **📊 Statistiques** (au-dessus du schéma) : tentatives, terminées (résolues, à contacter, jusqu'au bout), résultats envoyés ; sur chaque réponse, le nombre et la part des choix ; « ⏸ n » sur une étape = tentatives arrêtées là. Anonymes (sans lien avec le compte du client) et sans les admins.
- **➡ Procédure suivante** (en haut de l'écran de modification) : à la fin, le client voit la question **« Continuer avec … ? »** (Oui / Non) ; Oui ouvre la suivante (en parcours guidé s'il y était). Pour **enchaîner** des procédures, ex. réglage FlexiPRINT → réglage DXonJet → impression : chaque procédure propose la suivante. Pas proposée sur une fin « 📞 contacter Kiavik », ni aux clients tant que la suivante est en brouillon. Elle est copiée par ⧉ Dupliquer et retirée si la suivante est supprimée.
- **⧉ Dupliquer** (en bas de l'écran de modification) : copie complète en brouillon (étapes, questions, détours, photos), pour partir d'une procédure proche.
- **Ordre** : flèches ↑ ↓. **Publier** : case en haut (brouillon = visible seulement par l'admin).
- **Parties** : écrire une étape « **Montage — Vérifier la courroie** » la range sous le titre « Montage » (utile pour les longues check-lists).
- Les clients doivent avoir le module **Procédures** (case à cocher sur leur compte).
- Au départ : le brouillon **Changer les filtres à encre** (entretien, 18 étapes en 7 parties), le brouillon **Diagnostic : la pompe à encre** (exemple de diagnostic, voir ci-dessous), la check-list **Mise en route et nettoyage de la machine** (v1 de Teddy, 26 étapes en 8 parties), 2 procédures FlexiPRINT publiées (reprises du prototype) et 4 brouillons DXonJet à compléter.

## Kiavik : dépannages guidés (questions et détours)
Un diagnostic est une procédure avec des **questions** : la suite dépend de la réponse du client.
- **Route principale** : les étapes numérotées. Une **question** (étape → « ❓ Transformer en question ») a 2 à 4 **réponses** (Oui / Non par défaut, à renommer ; « + réponse » pour en ajouter).
- Chaque réponse ouvre un **détour** : ses propres étapes (« + étape dans ce détour » dans le schéma), qui peuvent contenir une autre question.
- **Ensuite** (sur la réponse) : **↩ revenir sur la route** après la question (par défaut), **↪ aller à une étape** de la route principale, **✅ fin : problème résolu** ou **📞 fin : contacter Kiavik**, avec une **conclusion** montrée au client (cause probable, que faire). Une réponse peut aussi proposer une astuce ou une autre procédure.
- Le schéma signale les oublis (réponse unique, saut sans étape, fin sans conclusion, retour en arrière qui peut faire une boucle).
- Le client suit le bon chemin dans la liste et dans le parcours guidé ; « Vérification » indique qu'il est dans un détour. À la fin, il voit ses réponses et peut **📤 envoyer le résultat à Kiavik** (avec un message) : vous recevez une **notification**, le résultat est dans Administration → Procédures → **🩺 Diagnostics reçus**, et il part vers n8n (webhook **`diagnostic.envoye`**). Le même résultat ne peut pas être envoyé deux fois ; le client retrouve ses envois dans **🩺 Mes diagnostics** (onglet Procédures).

### Préparer l'IA
Rien n'est envoyé à une IA par l'app : tout passe par n8n, où vous choisissez l'IA.
- **Description** de chaque procédure : à quoi elle sert, quand l'utiliser, symptômes. Le **catalogue** des descriptions (`GET /api/ia/catalogue`, clé API) permet à une IA de proposer la bonne procédure.
- **Notes** (sur les étapes et questions), **significations** (sur les réponses), **conclusions** (sur les fins) : jamais montrées au client, elles expliquent l'arbre à l'IA.
- **Prompt général** (Administration → Procédures, en bas) et **prompt de la procédure** (bloc 🤖 IA) : les consignes données à l'IA ; celui de la procédure complète le général.
- **Résumé automatique** (bloc 🤖 IA) : texte fabriqué par l'app à partir du schéma, **sans IA**, toujours à jour : étapes numérotées, parties, questions, réponses et leur signification, détours, suites, conclusions, notes, boutons liés.
- **📋 Copier le résumé** ou **📋 Copier avec les prompts** (consignes générales + prompt de la procédure + résumé) : à coller dans l'IA de votre choix. **⬇ JSON** : la même chose pour une machine (`GET /api/ia/procedures/:id`, champs `resumeTexte` et `paquet`).
- Dans **Diagnostics reçus**, **📋 Copier pour l'IA** sur chaque résultat : prompts + résumé de la procédure + réponses et message du client.
- Le webhook `diagnostic.envoye` contient le résultat (`question : réponse`) et le même **paquet** tout prêt pour l'IA (prompts + résumé de la procédure + résultat + message). À mentionner dans les conditions d'utilisation avant d'envoyer des réponses de clients à une IA.

## Sans réseau (atelier)
- Les pages déjà ouvertes restent lisibles sans connexion (procédures, photos, astuces, guides, captures) ; un bandeau « 📴 Hors ligne » le signale.
- Onglet Procédures, en bas : **📥 Atelier sans réseau → Préparer ce téléphone** charge tout à l'avance (procédures et photos, astuces, guides et leurs captures). À refaire de temps en temps (« Mettre à jour »).
- Sans réseau, le résultat d'un diagnostic, un « pas clair ? » et le suivi des statistiques sont **mis de côté** et partent tout seuls au retour de la connexion (le bandeau indique combien sont en attente).
- L'administration n'est pas gardée hors ligne. Les pages gardées sont effacées à la déconnexion.

## Kiavik : Bon à savoir (astuces & solutions)
Administration → **💡 Bon à savoir** (espace Kiavik), ou depuis la page Pas-à-pas.
- Une fiche = **le problème ou l'astuce** (titre), **pourquoi** (facultatif), **que faire**, une **précaution** facultative, une photo, des **mots-clés**, le **bouton du guide** et la **procédure** liés.
- Brouillon tant que « Publiée » n'est pas cochée. Les clients (module Procédures) les voient sur l'accueil, en tête de la recherche et dans la fiche du bouton lié (« 💡 … »).
- 4 fiches de départ reprises des précautions des guides (Offre, fichier RIPé introuvable, pompe à encre, impression trop longue).
- Ces fiches serviront aussi de base au futur assistant IA : plus elles sont nombreuses et précises, meilleures seront ses réponses.

## Kiavik : corriger les guides depuis le téléphone
En étant connecté en admin :
- **Fiche d'un bouton** : toucher le bouton dans le guide → **✏️ Modifier** → titre, texte, conseil (💡 astuce, ⚠️ avertissement ou « à compléter » visible seulement par l'admin), mots-clés pour la recherche → **Enregistrer**. Le badge « modifié dans l'app » le signale.
- **Animation** : sous le lecteur, **✏️ Modifier cette scène** → corriger les sous-titres (ce sont aussi les phrases de la voix off) et **📷 Remplacer la photo** de la scène (prise avec le téléphone, compressée automatiquement ; garder à peu près le même cadrage, le curseur ne bouge pas).
- Visible tout de suite par tous les clients, sans redéploiement. **↺ Revenir à l'original** annule la correction.
- Les corrections sont gardées à part : une mise à jour de l'app ne les efface pas. Déplacer une pastille ou créer une animation reste à faire dans les fichiers du projet.

## Mot de passe oublié (sans email)
1. Le client touche **« Mot de passe oublié ? »** sur l'écran de connexion, tape son identifiant — **ou son email** s'il l'a oublié aussi — et un message facultatif.
2. Vous êtes prévenu : **notification sur votre téléphone** et compteur rouge sur Administration → **🔐 Mots de passe oubliés**.
3. Vérifiez que c'est bien votre client (appel, numéro connu), touchez **🔑 Générer le code** : un code à 6 chiffres, **valable 1 heure**, une seule fois, 5 essais au plus. **Envoyer (SMS, WhatsApp…)** prépare le message avec le code.
4. Le client choisit « J'ai reçu mon code », saisit le code et son nouveau mot de passe : il est connecté directement. Vous ne connaissez jamais son mot de passe.
- Un nouveau code remplace l'ancien ; « Annuler » ferme la demande. 3 demandes par heure et par compte au plus ; la réponse affichée est la même si l'identifiant n'existe pas. Tout est noté dans l'activité du client (🔐).

### Notifications sur votre téléphone
Administration → **🔔 Notifications sur ce téléphone → Activer** (une fois par téléphone ; une notification d'essai confirme). Sur **iPhone**, ajoutez d'abord l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil, iOS 16.4 ou plus) et ouvrez-la depuis l'icône. Les notifications vont à tous les téléphones des admins qui les ont activées.

- **Demande avec un email** : l'app ne connaît pas les emails (ils sont dans Odoo). La demande s'affiche « ✉️ email » : n8n s'en charge (ci-dessous), sinon retrouvez le compte et tapez son **identifiant** avant de générer le code ; le message à envoyer contient l'identifiant et le code.

### Automatiser l'email avec n8n
Chaque demande envoie le webhook **`motdepasse.demande`** (jamais le code). Dans n8n, avec une **clé API** de l'app (Administration → Clés API) et le serveur SMTP de n8n :
1. **Webhook** reçu (abonné dans Administration → Envoi vers une API, événement `motdepasse.demande`).
2. **Retrouver l'email du client dans Odoo** :
   - demande avec identifiant (`user` rempli) : chercher le contact par `user.numeroOdoo` ;
   - demande avec email (`user` vide, `demande.email`) : chercher le contact Odoo **par cet email** ; s'il n'existe pas, s'arrêter (la demande reste pour l'admin). Puis retrouver le compte de l'app : `GET /api/users?numeroOdoo=<n° du contact>` (clé API).
3. **Générer le code** : `POST /api/admin/mots-de-passe/<demande.id>/code` (en-tête `X-Api-Key`), corps `{}` ou `{"identifiant": "<identifiant trouvé>"}` pour une demande par email → `{code, expire, identifiant, nom}`.
4. **Envoyer l'email à l'adresse enregistrée dans Odoo** (jamais à une adresse tapée sans vérification) : identifiant, code, heure d'expiration, « Mot de passe oublié ? → J'ai déjà un code ».
La demande passe alors en « Code donné » dans votre liste.

## Activité d'un client
Administration → Comptes → toucher le client → **Voir son activité** (connexions, pages consultées, recherches).
- Période : 24 h, 7, 30 ou 90 jours ; classé par jour, du plus récent au plus ancien. Toucher une page l'ouvre.
- 🔑 connexion · 📄 page (écran du guide et bouton ouvert, procédure, animation, astuce…) · 🔍 recherche avec le nombre de résultats ; **« aucun résultat » en rouge** : mots-clés ou fiche à ajouter.
- Les admins ne sont pas enregistrés. Le journal est **effacé automatiquement après 12 mois**.
- **Conditions d'utilisation** : le journal y est mentionné, partie « Vos données » (Lazzeko et Kiavik). La phrase a été ajoutée automatiquement aux conditions en vigueur au déploiement (nouvelle version, acceptée par les clients à leur prochaine ouverture). À garder si on réécrit les conditions.

## Partager une page avec un client
Bouton rond **Partager** (en bas à droite, visible seulement par l'admin), et bouton **Partager** dans la fiche d'un bouton des guides.
- Sur téléphone : menu de partage habituel (SMS, WhatsApp, mail…). Sur ordinateur : WhatsApp, SMS ou **Copier le lien**.
- Le lien ouvre exactement la page affichée : écran du guide avec le bouton sélectionné, procédure, animation, recherche…
- Il utilise l'adresse de l'espace ouvert (ex. app.kiavikcopilot.ovh). Le client doit avoir un compte avec l'accès concerné ; s'il n'est pas connecté, il se connecte puis arrive sur la page.

## Clés API
Pour Odoo ou un service externe. Copier la clé à sa création (elle ne sera plus affichée). Révoquer une clé qui ne sert plus.
