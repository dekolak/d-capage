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
- **Lier un bouton** : sur une étape, choisir le logiciel, l'écran puis le bouton. Le client voit « 👆 Voir le bouton » dans l'étape, et « 📋 Voir la procédure » quand il touche ce bouton dans le guide.
- **Ordre** : flèches ↑ ↓. **Publier** : case en haut (brouillon = visible seulement par l'admin).
- Les clients doivent avoir le module **Procédures** (case à cocher sur leur compte).
- Au départ : 2 procédures FlexiPRINT publiées (reprises du prototype) et 4 brouillons DXonJet à compléter.

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

## Partager une page avec un client
Bouton rond **Partager** (en bas à droite, visible seulement par l'admin), et bouton **Partager** dans la fiche d'un bouton des guides.
- Sur téléphone : menu de partage habituel (SMS, WhatsApp, mail…). Sur ordinateur : WhatsApp, SMS ou **Copier le lien**.
- Le lien ouvre exactement la page affichée : écran du guide avec le bouton sélectionné, procédure, animation, recherche…
- Il utilise l'adresse de l'espace ouvert (ex. app.kiavikcopilot.ovh). Le client doit avoir un compte avec l'accès concerné ; s'il n'est pas connecté, il se connecte puis arrive sur la page.

## Clés API
Pour Odoo ou un service externe. Copier la clé à sa création (elle ne sera plus affichée). Révoquer une clé qui ne sert plus.
