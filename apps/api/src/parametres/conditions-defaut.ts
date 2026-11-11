/**
 * Texte par défaut des conditions d'utilisation (modifiable dans Administration → Conditions).
 * PROJET : à faire relire par un juriste avant la mise en service.
 */
export const CONDITIONS_LAZZEKO = `Bienvenue dans l'application Réglages décapage de Lazzeko.

1. Le principe : l'échange
L'application fonctionne sur le partage. Les fiches que vous enregistrez (réglages, tags, photos, notes et commentaires) sont visibles par les autres utilisateurs de l'application. En contrepartie, vous accédez aux réglages et aux photos de toute la communauté. Ce partage est la condition d'utilisation de l'application.

2. Ce que vous publiez
Publiez uniquement des photos de pièces, de surfaces et d'écrans de machine. Ne publiez pas de photos de personnes, de plaques d'immatriculation, de documents ni d'informations confidentielles de vos clients. Restez courtois et factuel dans vos commentaires et avis.

3. Modération
Lazzeko peut masquer ou supprimer une fiche, une photo ou un avis qui ne respecte pas ces règles, y compris à l'aide d'outils automatiques.

4. Réutilisation de vos photos par Lazzeko (facultatif)
Lazzeko ne réutilise vos photos en dehors de l'application (site internet, réseaux sociaux, documentation) que si vous l'avez accepté. Cet accord est facultatif, ne conditionne pas l'accès à l'application et peut être retiré à tout moment depuis votre compte ; le retrait vaut pour les utilisations futures.

5. Vos données
L'application conserve votre identifiant, votre nom, vos machines et vos publications pour faire fonctionner le service. Pour vous aider au mieux, l'application enregistre aussi votre activité (connexions, pages consultées, recherches) ; ce journal n'est visible que par Lazzeko et il est effacé au bout de 12 mois. Vous pouvez supprimer vos fiches à tout moment et demander la suppression de votre compte en contactant Lazzeko.

6. Évolution des conditions
Si ces conditions changent, elles vous seront présentées à nouveau lors de votre prochaine connexion.`;

/** Espace Kiavik : guides et procédures, sans partage communautaire. */
export const CONDITIONS_KIAVIK = `Bienvenue dans Kiavik Copilot.

1. Le service
L'application donne accès aux guides des machines et aux procédures Kiavik associés à votre compte. Rien de ce que vous consultez n'est partagé avec d'autres utilisateurs.

2. Utilisation
Les guides et procédures sont réservés à votre usage et à celui de votre entreprise. Ils ne remplacent pas la documentation officielle du fabricant ni les consignes de sécurité de votre atelier.

3. Vos données
L'application conserve votre identifiant, votre nom et vos réponses aux messages éventuels pour faire fonctionner le service. Pour vous aider au mieux, elle enregistre aussi votre activité (connexions, pages consultées, recherches) ; ce journal n'est visible que par Kiavik et il est effacé au bout de 12 mois. Vous pouvez demander la suppression de votre compte en contactant Kiavik.`;

export const CONDITIONS_DEFAUT: Record<string, string> = { lazzeko: CONDITIONS_LAZZEKO, kiavik: CONDITIONS_KIAVIK };
