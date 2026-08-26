# Étapes de la mission

## Étape 1 : Concevoir l'architecture et le modèle de données
Définissez l'architecture de votre solution sous forme de schéma pour visualiser chaque brique technique. Modélisez la structure de la base de données selon les spécifications et maquettes (UML ou Merise). Construisez le contrat d'interface entre le front-end et le back-end (routes, structures de données, paramètres).

- **Prérequis** : avoir lu le brief projet ; avoir défini le stack technique
- **Résultat attendu** : un schéma d'architecture ; un MCD ; un contrat d'interface (Excel, Markdown, OpenAPI...)
- **Recommandations** : définir le stack (front, back, BDD, stockage) selon les contraintes techniques ; déduire le MCD et le contrat depuis les maquettes ; produire un diagramme simple dès le début
- **Points de vigilance** : se familiariser avec les outils du stack ; suivre les cours OpenClassrooms conseillés ; lire les docs officielles
- **Outils** : Lucidchart, draw.io, Whimsical, ArchiMate ; MSOffice, LibreOffice, Google Docs ou Markdown

## Étape 2 : Mettre en place le socle technique
Mettez en place le socle technique de l'application avec la documentation officielle de votre stack. Installez git et exposez le code sur GitLab ou GitHub. Langages et frameworks libres parmi la liste des spécifications.

- **Prérequis** : avoir lu le brief projet ; avoir défini le stack technique
- **Résultat attendu** : un dépôt hébergé (GitHub ou GitLab) avec l'initialisation des applications
- **Recommandations** : penser aux interactions front/back ; utiliser la doc officielle ("getting started")
- **Outils** : EDI (VS Code, IntelliJ, Eclipse...) ; DevTools navigateur ; Git + repo (GitHub/GitLab) ; outils du stack (Angular CLI, Spring, PostgreSQL...)

## Étape 3 : Mettre en place la gestion des utilisateurs
Implémentez les US03 et US04. La gestion utilisateur est un pilier central, à traiter en premier de manière indépendante.

- **Prérequis** : avoir initialisé l'environnement de développement
- **Résultat attendu** : un système d'authentification fonctionnel
- **Recommandations** : utiliser la doc du stack pour l'authentification ; identifier les fonctionnalités critiques et prévoir les premiers tests unitaires
- **Points de vigilance** : en cas de blocage sur US03/US04, s'appuyer sur StackOverflow ou l'IA pour débloquer rapidement
- **Outils** : outil d'authentification (tokens JWT) ; outils du stack

## Étape 4 : Développer les fonctionnalités principales
Concentrez-vous sur le téléversement, la gestion et le partage des fichiers, en vous inspirant des spécifications et maquettes. Utilisez l'IA générative pour développer une seule US ; le reste est codé par vous-même. Pour cette US, assignez des tâches à un copilote IA, puis relisez son code.

- **Prérequis** : avoir un système d'authentification fonctionnel ; avoir analysé les US restantes
- **Résultat attendu** : une application permettant de téléverser, consulter, supprimer des fichiers et partager un lien de téléchargement ; pour une seule US : des tâches assignées à l'IA et tracées dans Git ; une section de doc expliquant les tâches confiées à l'IA, le rôle de supervision, les correctifs apportés
- **Recommandations** : une fonctionnalité à la fois (par US) ; composants réutilisables et code structuré ; respecter les règles de sécurité (accès aux fichiers) ; versionner en conventional commit
- **Points de vigilance** : définir des tâches claires pour l'IA ; superviser activement (relecture, sécurité, maintenabilité) ; isoler les contributions IA dans des commits clairs (ex : `feat(ai): ...`, `fix: ... (revue humaine)`) ; consigner les décisions dans la doc "Utilisation de l'IA"
- **Outils** : copilote IA (Copilot...) ; outils du stack

## Étape 5 : Tester, corriger et optimiser
Testez l'ensemble de l'application, corrigez les bugs, optimisez les parties critiques et améliorez l'expérience utilisateur (ergonomie, messages d'erreur, feedback visuel).

- **Prérequis** : toutes les fonctionnalités principales implémentées
- **Résultat attendu** : une application robuste, sans bugs bloquants, avec une interface soignée ; un suivi de qualité et maintenance en 4 fichiers :
    - **TESTING.md** : plan de tests documenté et résultats ; tests exécutables (unitaires, intégration, end-to-end) sur les fonctionnalités critiques ; rapport de couverture >= 70 %
    - **SECURITY.md** : scan de sécurité (npm audit, trivy) et compte rendu documenté
    - **PERF.md** : test de performance sur au moins un endpoint critique (upload/download) avec analyse ; logs structurés et analyse des métriques clés
    - **MAINTENANCE.md** : procédures de maintenance et de correction
- **Recommandations** : plan de tests simple (1 page, tableau) ; tests de bout en bout ; tests unitaires sur les parties critiques ; rapport de couverture (seuil 70 %, capture d'écran) ; scan de sécurité documenté ; test de performance (ex : k6)
- **Points de vigilance** : faire tester par une personne extérieure si le temps le permet ; corriger les incohérences UI/UX et les messages d'erreur
- **Outils** : outils de tests (Cypress, JUnit, Jest...) ; outil de performance (k6)

## Étape 6 : Produire les livrables et finaliser
Produisez les livrables attendus : documentation technique, README d'installation et support de présentation synthétique pour la soutenance.

- **Prérequis** : application finalisée, testée et stable
- **Résultat attendu** :
    - Le repository (GitLab/GitHub), lien déposé dans un fichier TXT ou PDF, contenant : tout le code et l'historique de commits ; un README clair ; les scripts de déploiement (installation + configuration BDD) ; les documentations de suivi qualité et maintenance :
        - TESTING.md
        - SECURITY.md
        - PERF.md (budget de performance front (bundle, navigateur) ; suivi des métriques : temps de réponse, taille de fichiers)
        - MAINTENANCE.md (procédures de mise à jour des dépendances, fréquence, risques)
    - La documentation technique complète et claire
    - Un support de présentation synthétique pour la soutenance
- **Recommandations** : utiliser le modèle de documentation fourni ; justifier les choix techniques et la maintenabilité ; établir un budget de performance front (ex : Lighthouse) ; journaliser les métriques clés + analyse d'optimisation ; procédure de maintenance minimale ; finaliser la doc dans le repo ; structurer les slides (architecture, choix techniques, difficultés, solutions)
- **Points de vigilance** : harmoniser code/doc/présentation et assurer leur cohérence
- **Outils** : Suite Office / Google Docs / Markdown

## Étape finale : Autoévaluation
Téléchargez et complétez la fiche d'autoévaluation pour vérifier que rien n'a été oublié, et échangez-en avec votre mentor lors de la dernière session de mentorat.
