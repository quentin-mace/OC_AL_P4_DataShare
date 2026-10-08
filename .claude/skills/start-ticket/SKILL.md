---
name: start-ticket
description: Démarre le travail sur un ticket GitHub du projet DataShare. À utiliser quand l'utilisateur dit "on attaque le ticket #N", "on commence l'issue N", "va sur le projet datashare, ticket #N", ou invoque /start-ticket N.
argument-hint: <numéro du ticket>
---

# Démarrer un ticket DataShare

Ticket demandé : `$ARGUMENTS` (dépôt `quentin-mace/OC_AL_P4_DataShare`).

## 1. Lire le ticket
- `gh issue view <N> --json number,title,body,labels,milestone,comments,state`
  (ne pas utiliser la sortie texte de `gh issue view`, elle échoue sur l'erreur "Projects (classic)").
- Si le corps cite une issue parente ("Fait partie de #X"), la lire de la même façon.
- Repérer les labels (`front`, `back`, `infra`, `étape-N`, `us-mvp`) et le milestone.

## 2. Lire le contexte dans docs/
- `docs/steps.md` : l'étape correspondant au milestone (attendus, points de vigilance).
- `docs/specs/API/contrat-api.md` : routes, champs, réponses et codes d'erreur concernés.
- `docs/architectureDecisions/*.md` : les ADR liés au sujet (tags, mot de passe, expiration, upload anonyme, stack).
- Si label `front` : `docs/ui_guide.md` (tokens, composants, formulaires) et les maquettes utiles dans `docs/mockUp/desktop` et `docs/mockUp/mobile` (les ouvrir avec Read).
- `docs/specs/context.md` si le besoin fonctionnel est flou.

## 3. Explorer le code
- `DataShare_Front` (React, Vite, Tailwind, react-hook-form, zod, axios, Vitest) et/ou `DataShare_API` (Symfony, API Platform).
- Identifier les patterns existants et les composants, services ou utilitaires à réutiliser plutôt que d'en créer de nouveaux.
- Vérifier ce qui est déjà implémenté côté back ou front pour le sujet.

## 4. Lever les ambiguïtés
- Lister les écarts entre ticket, contrat API, ADR et maquettes.
- Poser les questions bloquantes (AskUserQuestion) avant de planifier, avec une option recommandée.
- Pour l'étape 4 : demander si le ticket est l'US développée avec l'IA (commits `feat(ai): ...`, correctifs `(revue humaine)`, doc "Utilisation de l'IA").

## 5. Préparer la branche
- `git switch main && git pull`, puis `git switch -c feat/<slug>` (ou `fix/<slug>`), slug court en anglais.

## 6. Proposer un plan
Présenter un plan avant de coder : fichiers à créer ou modifier, réutilisations, tests, vérification.
Rappeler les conventions du dépôt :
- Conventional Commits en anglais, sujet impératif en minuscules, scope `front`, `back` ou `infra`, suffixe `(#N)`.
  Exemple : `feat(front): add the login form (#35)`.
- Front : `make lint`, `make test`, `make coverage` (seuil 70 %) ; nouveau composant UI = test à côté + entrée dans `docs/ui_guide.md`.
- Une PR vers `main` qui référence le ticket.
