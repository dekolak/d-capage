# Importer des clients (CSV, ex. extrait d'Odoo)

Import ponctuel : le script crée les comptes et leurs machines par l'API, avec un **code provisoire unique par client**.
À sa première connexion, le client **doit choisir son mot de passe** (écran « Choisissez votre mot de passe ») ; le code ne peut pas être réutilisé.

## 1. Le CSV
Une ligne par machine (un client avec 2 machines = 2 lignes avec le même email). Séparateur `;` ou `,`, export Excel accepté.

| Colonne | Obligatoire | Exemple |
|---|---|---|
| `Nom` | non | Atelier Dupont |
| `Email` | oui (sert d'identifiant) | dupont@exemple.fr |
| `Identifiant` | non (sinon = l'email) | dupont |
| `Numéro Odoo` | non | C00123 |
| `Modèle` | non (sans = compte sans machine) | DXonJet F1080 |
| `Numéro série` | non | SN-1 |
| `Mise en service` | non | 15/03/2024 |

Le **modèle** doit correspondre à un modèle de l'espace (Administration → Machines) : nom exact (« F1080 ») ou nom complet (« DXonJet F1080 »). Un nom ambigu ou inconnu est signalé et **rien n'est créé**.

## 2. Lancer le script
1. Administration → 🔑 Clés API → créer une clé (ex. « import clients »).
2. Sur un ordinateur avec Node 18+, dans le dossier du projet :

```bash
# essai : vérifie tout, ne crée rien
CLE_API=dk_xxx node scripts/importer-clients.mjs clients.csv --api https://app.kiavikcopilot.ovh --essai
# import
CLE_API=dk_xxx node scripts/importer-clients.mjs clients.csv --api https://app.kiavikcopilot.ovh
```

Options : `--espace kiavik` (défaut), `--modules guide-dxonjet,procedures-kiavik` (défaut : tous les modules de l'espace), `--sortie codes.csv`.
Relancer le script ne crée pas de doublon : un compte qui existe déjà est sauté (« existe_deja »).

## 3. Le CSV pour n8n
`clients-codes-AAAA-MM-JJ.csv` : `identifiant ; nom ; email ; numero_client ; code_provisoire ; lien ; resultat`.
Le `lien` ouvre l'app avec l'identifiant déjà rempli. Dans n8n : lire le CSV, garder `resultat = cree`, envoyer un email par ligne
(identifiant, code provisoire, lien). **Supprimez le fichier une fois les emails envoyés** (il contient les codes).

## 4. Suivi
Administration → Utilisateurs : badge **⏳ code provisoire** tant que le client n'a pas choisi son mot de passe.
## 5. Client qui a perdu son mot de passe (au téléphone)
Administration → Utilisateurs → toucher le client → **🔑 Mot de passe perdu → Créer un code provisoire** : l'app génère un code (ex. `K7PM-42QX`)
à dicter, ou à envoyer en un clic (**📋 Copier le message**, **💬 SMS**, **WhatsApp** : code, identifiant et lien de l'app).
À sa connexion, le client choisit son mot de passe ; ses autres téléphones sont déconnectés. Le client peut aussi utiliser « mot de passe oublié » dans l'app.
À la création d'un compte, **🎲 Générer** propose un code du même format.

À savoir : un mot de passe donné par l'admin ou par l'API (Odoo, n8n) est **provisoire par défaut** (`motDePasseProvisoire: false` pour l'éviter).
