# Utilisation de l'IA

L'étape 4 demande de développer **une seule** user story avec un copilote IA, de superviser son travail et de tracer ses contributions dans Git (`docs/steps.md`). Les autres user stories sont écrites à la main.

## User story concernée

**US01, upload d'un fichier par un utilisateur connecté, côté front** (issue #37, rattachée à #11).

Le back de l'upload (`POST /api/files`) existait déjà et n'a pas été confié à l'IA.

## Copilote utilisé

Claude Code (modèle Claude Opus 5.5), dans le terminal, avec accès en lecture au dépôt et à l'issue GitHub, et en écriture sur une branche dédiée (`feat/upload-form`).

## Tâches confiées à l'IA

| Tâche | Fichiers |
|---|---|
| Lire l'issue, le contrat d'API, les ADR et les maquettes, puis proposer un plan | (plan validé avant tout code) |
| Schéma zod reprenant les règles de `FileUploadInput` (taille, extensions interdites, mot de passe, durée, tags) | `src/validation/uploadSchema.ts` |
| Service d'envoi multipart avec suivi de progression axios et annulation | `src/api/files.ts` |
| Composants génériques `Modal`, `FileField`, `ProgressBar` | `src/components/ui/` |
| Formulaire d'envoi, écran de succès avec lien à copier, modale ouverte depuis "Ajouter des fichiers" | `src/components/upload/`, `DashboardLayout.tsx` |
| Tests unitaires et d'intégration, mise à jour du guide de l'interface | `*.test.ts(x)`, `docs/ui_guide.md` |

## Décisions prises avant le code

Le plan de l'IA a relevé trois écarts entre l'issue, le contrat d'API et les maquettes. Ils ont été tranchés par le développeur avant toute implémentation :

- **Affichage.** Les maquettes ne dessinent l'envoi que pour un visiteur anonyme. Pour l'espace personnel, le formulaire s'ouvre dans une modale, depuis le bouton "Ajouter des fichiers" de la barre du haut.
- **Tags.** Prévus par le contrat d'API mais absents de la maquette, ils sont inclus dans cette user story.
- **Progression.** Demandée par l'issue mais absente de la maquette, elle s'affiche sous les champs pendant l'envoi.

## Supervision

- Plan relu et validé avant l'écriture du code, questions ouvertes tranchées par le développeur (voir ci-dessus).
- Format multipart vérifié contre l'API réelle : champ `tags[]` répété, chemins des violations (`tags[1]`, `password`, `file` avec un `code` nul pour une extension interdite).
- Contrôles automatiques : `make lint` (oxlint, Prettier), `make build` (types), `make coverage` (seuil 70 %).
- Relecture humaine du code : *à compléter après la revue de la branche* (sécurité, maintenabilité, conformité aux maquettes).

## Correctifs apportés

### Par l'IA, sur retour des outils

- `refine` de zod 4 n'accepte plus de message calculé par une fonction : la vérification d'extension passe par `superRefine`.
- oxlint (`jsx-a11y`, `react`) : barre de progression en `<progress>` natif plutôt qu'un `div` avec `role="progressbar"`, message de succès en `<output>`, et `handleSubmit` appelé à la soumission plutôt qu'au rendu.

### Après revue humaine

*À compléter : chaque correctif fait l'objet d'un commit `fix(front): ... (revue humaine) (#37)`.*

## Traçabilité dans Git

Les commits écrits par l'IA sont préfixés `feat(ai)` et portent la mention `Co-Authored-By: Claude`. Les correctifs issus de la relecture sont des commits séparés, suffixés `(revue humaine)`.
