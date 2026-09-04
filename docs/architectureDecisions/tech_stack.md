# Choix du stack technique

**Statut** : accepté, 2026-09-02, ticket [#1](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/1)

## Critère d'arbitrage

Sur les 28 tickets du projet, 13 relèvent de la documentation, du suivi qualité et des tests. Le développement pur représente moins de la moitié de la charge, et c'est la qualité des livrables qui est évaluée.

Le critère retenu est donc **la maîtrise préalable du stack**, pas l'intérêt technique des options. Tout temps d'apprentissage est pris sur les livrables. Ce critère a été appliqué même quand il conduisait à écarter une option plus séduisante.

## Décisions

| Brique | Choix | Argument principal | Alternative écartée |
|---|---|---|---|
| Back-end | Symfony + API Platform | Compétence principale ; écosystème couvrant JWT, validation, migrations et tâches planifiées ; OpenAPI généré depuis le code | NestJS, meilleur sur le 1 Go et le langage unifié, mais coût d'apprentissage non finançable sur 4 semaines |
| Front-end | React + Vite + TypeScript | Prototype non repris, donc la souplesse coûte moins cher que sur une base durable ; écosystème dense ; code IA fiable | Angular, plus de garde-fous, écarté au profit de la vitesse de démarrage |
| Base de données | PostgreSQL | Modèle franchement relationnel (utilisateur 1-N fichiers, fichier N-N tags, unicité, purge par date) ; MCD attendu | MongoDB, défendable mais sans bénéfice fonctionnel ici |
| Stockage | MinIO compatible S3, via Flysystem | L'application dépend de l'API S3, pas d'AWS : passer en AWS S3 réel est un changement de variables d'environnement | AWS S3 réel, exige une carte bancaire et casse les scripts de déploiement ; RustFS, encore en alpha |

## Détail du front-end

React n'impose rien, donc le stack front est défini par ce qui l'entoure. Ces choix sont arrêtés ici pour ne pas se décider au fil du développement.

| Besoin | Choix                                                                                                            |
|---|------------------------------------------------------------------------------------------------------------------|
| Routage | react-router                                                                                                     |
| Appels HTTP | axios, pour les intercepteurs JWT et le suivi de progression d'upload                                            |
| Formulaires et validation client | react-hook-form + zod, les règles des specs deviennent déclaratives et testables |
| Styles | Tailwind CSS, les maquettes existent en desktop et mobile, le responsive tient dans un préfixe de classe         |
| État serveur | aucune bibliothèque, un seul écran concerné, TanStack Query serait surdimensionné                                |
| État global (client) | zustand, pour partager l'état d'authentification (utilisateur, token) entre les pages sans prop drilling ni Context API verbeux |

## Transit des fichiers

Deux décisions ont été séparées : où vivent les octets, et par où ils transitent. La configuration retenue est asymétrique.

- **Upload par l'API.** La transaction "objet écrit, métadonnées enregistrées" reste atomique. Une URL présignée en écriture aurait introduit le cas "upload réussi mais confirmation perdue", donc des objets orphelins à réconcilier.
- **Téléchargement par URL présignée** à durée de vie courte. La page de métadonnées vérifie l'expiration et le mot de passe, puis l'API émet l'URL. Le contrôle d'accès reste côté serveur et PHP ne streame jamais 1 Go en sortie.

Effet de bord utile : l'endpoint d'upload reste un sujet de mesure réel pour le test k6 de PERF.md.

## Autres décisions

- **Format de réponse de l'API** : JSON simple, et non le JSON-LD par défaut d'API Platform. Le front est écrit à la main et n'exploiterait pas les métadonnées de description. Conséquence connue, une collection est un simple tableau, sans enveloppe de pagination. Sans impact, le MVP n'impose ni tri ni pagination.
- **Outillage de tests** : PHPUnit + PCOV, Vitest + React Testing Library, Cypress, k6 (plutot gatling ou octoperf).

## Points de vigilance

- **Limites PHP.** L'upload transitant par l'API, `upload_max_filesize`, `post_max_size`, `max_execution_time` et les limites du reverse proxy doivent accepter 1 Go, et être documentés dans les scripts de déploiement. Limite à mesurer dans PERF.md, l'upload par URL présignée étant l'axe d'optimisation identifié.
- **Endpoint MinIO joignable depuis le navigateur.** L'URL présignée doit porter l'endpoint public, pas le nom de conteneur interne.
- **Opérations hors CRUD API Platform.** L'upload multipart et l'émission d'URL présignée demandent des opérations personnalisées et une documentation OpenAPI manuelle.
- **Deux rapports de couverture** à présenter, back et front, pour justifier le seuil de 70 %.
- **Accessibilité.** React ne fournit aucun garde-fou, les libellés, le focus et les rôles ARIA sont à la charge du développement.
La lecture retenue est que le choix porte sur l'API S3, MinIO n'en étant qu'une implémentation, ce qui satisfait la contrainte tout en restant gratuit et auto-hébergeable. À confirmer.