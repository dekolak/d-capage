# Guide de l'administration

Compte → **Administration**. L'admin a accès à tout, dans les deux espaces (Compte → **Mes espaces** pour passer de Lazzeko à Kiavik).

## Comptes clients
- **Créer** : identifiant, mot de passe (8 caractères min.), nom, n° client Odoo (facultatif).
- **Accès** : cases par espace.
  - Lazzeko : *Réglages décapage*.
  - Kiavik : *Guide Flexiprint*, *Guide DXonJet*, *Procédures*.
  - Un client peut avoir des accès dans les deux espaces.
- **Client Lazzeko** (si accès Lazzeko) : décocher pour un utilisateur d'une autre marque. Sert à cibler les messages.
- Dans la liste : recherche (identifiant, nom, n° Odoo), filtre par espace, badges d'espace, conditions acceptées, accord photos.
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

## Clés API
Pour Odoo ou un service externe. Copier la clé à sa création (elle ne sera plus affichée). Révoquer une clé qui ne sert plus.
