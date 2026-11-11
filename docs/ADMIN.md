# Guide de l'administration

Compte → **Administration** (en français ; les écrans clients peuvent être traduits, voir [TRADUCTION.md](TRADUCTION.md)). L'admin a accès à tout, dans les deux espaces (Compte → **Mes espaces** pour passer de Lazzeko à Kiavik).

## Comptes clients
- **Créer** : identifiant, mot de passe (8 caractères min.), nom, n° client Odoo (facultatif).
- **Accès** : cases par espace.
  - Lazzeko : *Réglages décapage*.
  - Kiavik : *Guide Flexiprint*, *Guide DXonJet*, *Procédures*.
  - Un client peut avoir des accès dans les deux espaces.
- **Client Lazzeko** (si accès Lazzeko) : décocher pour un utilisateur d'une autre marque. Sert à cibler les messages.
- Dans la liste : recherche (identifiant, nom, n° Odoo), filtre par espace, badges d'espace, conditions acceptées, accord photos.
- **Langue** : par défaut celle du téléphone du client. Dès qu'une deuxième langue existe (anglais prévu), elle se choisit sur le compte (ou par le client dans Compte, ou depuis Odoo avec `langue`).
- Toucher un compte : modifier ses accès, son n° Odoo, voir ses fiches, lui attribuer une machine. **Désactiver** bloque la connexion sans rien supprimer.
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
- **Machines** : miniature PNG par modèle (machine entière, fond transparent ou clair, ~800 × 800 px). Une variante peut avoir la sienne.
- **Envoi vers une API** : webhooks pour une modération automatique (voir [API.md](API.md)).

## Kiavik : procédures
Dans l'espace Kiavik : Administration → **📋 Procédures** (ou onglet Procédures → « Gérer les procédures »).
- **Créer** : un titre, puis ajouter les étapes une par une (texte, avertissement facultatif, photo prise avec le téléphone).
- **Lier un bouton** : sur une étape, choisir le logiciel, l'écran puis le bouton. Le client voit « 👆 Voir le bouton » dans l'étape (la capture s'ouvre par-dessus la liste, bouton entouré), le bouton est aussi montré dans le **parcours guidé** (une étape à la fois, plein écran), et « 📋 Voir la procédure » quand il touche ce bouton dans le guide.
- **Ordre** : flèches ↑ ↓. **Publier** : case en haut (brouillon = visible seulement par l'admin).
- **Parties** : écrire une étape « **Montage — Vérifier la courroie** » la range sous le titre « Montage » (utile pour les longues check-lists).
- Les clients doivent avoir le module **Procédures** (case à cocher sur leur compte).
- Au départ : la check-list **Mise en route et nettoyage de la machine** (v1 de Teddy, 26 étapes en 8 parties), 2 procédures FlexiPRINT publiées (reprises du prototype) et 4 brouillons DXonJet à compléter.

## Kiavik : astuces & solutions
Administration → **💡 Astuces & solutions** (espace Kiavik), ou depuis la page Procédures.
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
