# Traduction de l'app

L'app est **prête à être traduite** : tous les textes des écrans clients sont dans un fichier par langue.
Aujourd'hui seule la langue de référence, le **français**, existe. Première langue prévue : **anglais**.

## Comment ça marche
| Élément | Où | Rôle |
|---|---|---|
| `apps/app/src/textes/fr.ts` | app | **tous** les textes de l'interface, en français (la référence) |
| `apps/app/src/textes/<code>.ts` | app | une autre langue : mêmes clés, traduites (peut être incomplète) |
| `apps/app/src/lib/i18n.tsx` | app | `t()`, `tn()`, `tr()`, langue courante, liste des langues (`DICTIONNAIRES`) |
| `User.langue` | base | langue choisie pour le compte (`null` = langue du téléphone) |
| `apps/api/src/langues.ts` | API | langues acceptées sur un compte (`fr`, `en`) |

**Langue affichée** : celle du compte, sinon la première langue du téléphone disponible dans l'app, sinon le français.
**Texte pas encore traduit** : il s'affiche en français. On peut donc publier une langue incomplète sans rien casser.

### Dans le code
```tsx
import { t, tn, tr } from '../lib/i18n';

t('compte.titre')                                   // « Compte »
t('lazzeko.machines.retirerConfirm', { nom })       // « Retirer « Atelier » ? … » ({nom} remplacé)
tn('kiavik.procedures.etapes', 3)                    // « 3 étapes » (clés .one / .other, règles de pluriel de la langue)
tr('lazzeko.fiche.dupliqueeDe', { lien: <Link …/> }) // texte avec un élément React (gras, lien…)
```
- Les clés sont **vérifiées à la compilation** : une clé inexistante est une erreur TypeScript.
- Dates : `dateCourte()`, `dateHeure()` (format de la langue). Libellés des configs machine : `libelle()` (`{fr, en, …}`).
- L'app envoie `Accept-Language` à l'API. Les messages d'erreur de l'API restent en français : dans une autre langue,
  l'app affiche le texte traduit du code (`erreur.MODULE_NON_AUTORISE`…) ou du statut HTTP (`erreur.404`…).

### Règle pour les nouveaux écrans
Aucun texte en dur dans un écran client : ajouter la clé dans `textes/fr.ts` (groupée par écran) et utiliser `t()`.
L'**administration** reste en français (utilisée par l'équipe), comme les écrans d'administration des procédures.

## Ajouter l'anglais (ou une autre langue)
1. Créer `apps/app/src/textes/en.ts` :
   ```ts
   import type { Cle } from './fr';
   const en: Partial<Record<Cle, string>> = {
     'onglets.accueil': 'Home',
     // … mêmes clés que fr.ts
   };
   export default en;
   ```
2. L'ajouter dans `DICTIONNAIRES` (`apps/app/src/lib/i18n.tsx`). La langue apparaît alors dans **Compte → Langue**
   et dans **Administration → Comptes** (le choix n'est affiché que s'il y a au moins deux langues).
3. Si ce n'est ni `fr` ni `en` : l'ajouter dans `apps/api/src/langues.ts` (langues acceptées sur un compte).
4. Traduire : copier `fr.ts`, faire traduire (IA), puis **faire relire** par quelqu'un du pays, avec le lexique ci-dessous.
5. Vérifier sur téléphone (390 × 844) avec un compte réglé sur la langue.

La langue d'un compte se règle aussi depuis Odoo : champ `langue` (`"en"`, `null` = téléphone) sur `POST /api/users`
et `PATCH /api/users/:id`.

### Lexique (à garder tel quel ou à valider)
Noms des logiciels et des menus tels qu'affichés dans les logiciels (FlexiPRINT, DXonJet, Spot_1, T1–T11, D1–D8),
RIP / fichier RIPé, modes de blanc (Support, Sous-uni… : garder le nom affiché par le logiciel de la machine).

## Contenus à traduire (pas encore prévus dans le code)
Ces textes ne sont pas dans `textes/` : ce sont des **contenus**. À faire quand la langue sera lancée.

| Contenu | Où | Piste |
|---|---|---|
| Guides (pastilles, conseils, intros) | `kit-guides/guides/*.json` | `<guide>.en.json` avec les mêmes `id`, servi selon `Accept-Language` |
| Animations (sous-titres = voix off) | `kit-guides/animations.json` | champ `cap_en` ou fichier par langue ; la voix off suit déjà la langue de l'app |
| Procédures | base (`Procedure`, `EtapeProcedure`) | champs par langue + bouton « Traduire » dans l'admin |
| Conditions d'utilisation, messages | base (`Parametre`, `Annonce`) | un texte par langue |
| Configs machine (libellés, aide) | `machines/**/v*.json` | déjà prévu : `label: {fr, en}`, affiché par `libelle()` |
| Tags (matériau, à enlever…) | base (`Tag`) | nom par langue |
| Indicateurs, contrôles des réglages | `packages/machine-kit` (calculs) | libellés `{fr, en}` comme les configs |
| Messages d'erreur de l'API | `apps/api` | lire `Accept-Language` (en attendant : textes de l'app par code / statut) |
| Captures des logiciels | `kit-guides/images` | refaire si le logiciel existe dans la langue (sinon garder les captures françaises) |
