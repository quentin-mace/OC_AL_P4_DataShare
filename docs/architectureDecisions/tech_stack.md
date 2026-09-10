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

## Fin de vie de MinIO Community Edition

**Statut** : accepté, 2026-09-10, ticket [#8](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/8)

Le choix du #1 porte sur l'API S3, MinIO n'en étant qu'une implémentation. La question restée ouverte était de savoir si cette lecture tenait. L'actualité de MinIO en fournit la démonstration, plus tôt que prévu.

L'édition communautaire a été progressivement abandonnée par son éditeur, qui recentre son activité sur son offre commerciale AIStor.

| Date | Événement |
|---|---|
| Juin 2025 | Retrait des fonctions d'administration de la console web communautaire. L'administration ne passe plus que par la ligne de commande `mc`. |
| Octobre 2025 | Arrêt de la publication des binaires et des images de conteneur de l'édition communautaire. |
| Février 2026 | Dépôt marqué comme non maintenu. |
| Avril 2026 | Dépôt archivé en lecture seule. Plus aucune évolution ni correctif de sécurité. |

**Décision** : conserver MinIO, en épinglant des versions explicites dans `compose.yaml`.

- `minio/minio:RELEASE.2025-09-07T16-13-09Z`, dernière image officielle publiée, celle sur laquelle `latest` pointe encore aujourd'hui.
- `minio/mc:RELEASE.2025-08-13T08-35-41Z`, pour la création du bucket.

Le tag `latest` est écarté pour deux raisons cumulées : il ne nomme aucune version, donc l'installation n'est pas reproductible, et il n'est plus republié, donc rien ne garantit qu'il reste disponible.

### Alternatives évaluées

| Option | Raison de l'écarter |
|---|---|
| Fork communautaire `pgsty/minio` | Versions 2026 disponibles et correctifs suivis, mais déplace la confiance vers un mainteneur unique sans apport fonctionnel pour le projet. |
| Image durcie `chainguard/minio` | Pertinente si la chaîne d'approvisionnement est une exigence contractuelle, ce qui n'est pas le cas ici. |
| Garage, SeaweedFS, RustFS | Remplacements crédibles, mais coût d'apprentissage pris sur les livrables, pour un bénéfice nul sur le code applicatif. |
| AWS S3 réel | Déjà écarté au #1, exige une carte bancaire et casse les scripts de déploiement. |

Le critère d'arbitrage du #1 s'applique inchangé : la maîtrise préalable du stack primant sur l'intérêt technique, changer de brique maintenant coûterait du temps de livrable sans rien apporter.

### Risque assumé et coût de sortie

Le risque réel de l'absence de correctifs de sécurité est faible sur le périmètre du projet : environnement de développement et de démonstration, données non sensibles, aucune exposition sur Internet. En exploitation réelle, la décision serait à réviser, et c'est précisément ce que le coût de sortie rend possible.

L'application n'appelle jamais MinIO. Elle s'adresse à Flysystem, qui s'adresse à l'API S3. Remplacer l'implémentation revient à renseigner d'autres valeurs de `STORAGE_S3_*`, sans qu'aucune ligne de code applicatif soit concernée. La disparition de la brique retenue laisse donc le projet intact, ce qui est exactement l'effet recherché par la décision de stockage du #1.

## Politique de mot de passe des comptes

**Statut** : accepté, 2026-09-10, ticket [#32](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/32)

Les spécifications demandent huit caractères minimum. Ce seuil borne la longueur, il ne dit rien de la prédictibilité. L'US03 étant la porte d'entrée de tout le reste, la règle retenue est plus stricte que la demande.

**Décision** : seize caractères minimum et une note de robustesse au moins moyenne, par les contraintes `Length` et `PasswordStrength` du composant Validator.

`PasswordStrength` estime l'entropie à partir du nombre de caractères **distincts** et des classes de caractères présentes. Un motif répété est donc sanctionné même s'il coche toutes les classes : `aB3$aB3$aB3$aB3` fait quinze caractères mais n'en compte que quatre distincts, et se voit refusé. C'est exactement le mot de passe qu'un utilisateur croit fort.

### Alternative évaluée

`NotCompromisedPassword` répond à une autre question, celle de savoir si le mot de passe figure dans une fuite de données connue. Un mot de passe peut satisfaire la règle ci-dessus et pourtant circuler dans des listes publiques. Sur la confidentialité, le protocole est correct, seuls les cinq premiers caractères de l'empreinte SHA-1 quittent le serveur, et la comparaison finale est locale.

La contrainte est écartée pour une raison d'architecture, pas de sécurité : elle ferait dépendre la création de compte d'un appel HTTP vers un service tiers, donc d'une latence et d'un point de panne externe, sur un parcours critique. `config/packages/validator.yaml` la désactive déjà en environnement de test, le coût de reprise de la décision reste donc faible.

### Conséquences

- La règle est appliquée côté serveur, seul endroit qui fasse foi. Le formulaire front la reproduit en zod pour afficher l'erreur avant l'envoi, sans jamais s'y substituer.
- L'écart avec les huit caractères des spécifications est assumé et documenté ici, il est à mentionner dans `SECURITY.md`.

## Autres décisions

- **Format de réponse de l'API** : JSON simple, et non le JSON-LD par défaut d'API Platform. Le front est écrit à la main et n'exploiterait pas les métadonnées de description. Conséquence connue, une collection est un simple tableau, sans enveloppe de pagination. Sans impact, le MVP n'impose ni tri ni pagination.
- **Outillage de tests** : PHPUnit + PCOV, Vitest + React Testing Library, Cypress, k6 (plutot gatling ou octoperf).
- **Isolation des tests back** : `dama/doctrine-test-bundle`, qui enveloppe chaque test dans une transaction annulée en fin de test. Écarté, le nettoyage manuel des tables, dont le coût se répète à chaque nouvelle classe de test au lieu d'être payé une fois. Les tests visent la base `app_test`, Doctrine suffixant déjà le nom de la base en environnement de test.

## Points de vigilance

- **Limites PHP.** L'upload transitant par l'API, `upload_max_filesize`, `post_max_size`, `max_execution_time` et les limites du reverse proxy doivent accepter 1 Go, et être documentés dans les scripts de déploiement. Limite à mesurer dans PERF.md, l'upload par URL présignée étant l'axe d'optimisation identifié.
- **Endpoint MinIO joignable depuis le navigateur.** Résolu au #8. La signature de l'URL présignée couvre son nom d'hôte, l'URL ne peut donc pas être réécrite après signature sans devenir invalide. Deux clients S3 coexistent : `aws.s3.client` sur l'adresse interne du conteneur, pour les lectures et écritures de l'application, et `aws.s3.public_client` sur l'adresse joignable par le navigateur, exposé comme storage Flysystem `public.storage` et réservé à l'émission des URLs présignées.
- **Surcharge de `STORAGE_S3_PUBLIC_ENDPOINT` en déploiement.** Sa valeur par défaut vise l'environnement local. Oubliée en production, elle n'empêche pas le démarrage et produit des URLs présignées injoignables, donc une panne visible seulement côté navigateur. À intégrer à la checklist du #23.
- **Opérations hors CRUD API Platform.** L'upload multipart et l'émission d'URL présignée demandent des opérations personnalisées et une documentation OpenAPI manuelle.
- **Deux rapports de couverture** à présenter, back et front, pour justifier le seuil de 70 %.
- **Accessibilité.** React ne fournit aucun garde-fou, les libellés, le focus et les rôles ARIA sont à la charge du développement.