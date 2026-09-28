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

## Durée de vie de l'URL présignée de téléchargement

**Statut** : accepté, 2026-09-18, ticket [#38](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/38)

**Décision** : 60 secondes.

La validité d'une URL présignée S3 ne couvre que l'instant où le navigateur initie la requête GET, pas la durée du transfert qui suit : elle n'a donc aucun lien avec la taille du fichier, y compris à 1 Go. Soixante secondes laissent largement le temps au navigateur de démarrer le téléchargement dès la réponse de `POST /api/downloads/{downloadToken}`, tout en limitant la fenêtre pendant laquelle l'URL resterait exploitable si elle fuitait (log d'accès, historique du navigateur, proxy intermédiaire).

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

## Remplacement de MinIO par SeaweedFS

**Statut** : accepté, 2026-09-28, ticket [#65](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/65)

Le coût de sortie évalué au #8 est appelé cinq mois plus tard, et par une voie qui n'avait pas été anticipée. La décision de conserver MinIO reposait sur la disponibilité des images déjà publiées, l'arrêt de publication d'octobre 2025 ne portant que sur les nouvelles. Ces images ont maintenant disparu des registres.

La CI l'a signalé la première, sur un ticket qui ne touchait pas à l'infrastructure :

```
minio Error unauthorized: access to the requested resource is not authorized
```

| Registre | Réponse au manifest | Témoin de contrôle |
|---|---|---|
| `quay.io/minio/minio` | 401 | `quay.io/prometheus/prometheus` répond 200 |
| `docker.io/minio/minio` | 401 | `library/alpine` répond 200 |
| `ghcr.io/minio/minio` | 403 | |

Ni un quota d'appels, ni un tag erroné : les dépôts sont fermés. Le dernier build vert date du 23 septembre, le premier échec du 28. Les images ne survivent plus que dans les caches Docker des postes qui les avaient déjà tirées, ce qui ne se transmet ni à un nouvel arrivant, ni à un runner.

**Décision** : remplacer MinIO par SeaweedFS, `chrislusf/seaweedfs:4.47`, en développement comme en CI.

Le service `storage` démarre en `server -s3`, qui réunit master, volume, filer et passerelle S3 dans un seul processus. Le conteneur `storage-init` crée le bucket au premier démarrage, rôle que tenait `mc` : la structure du `compose.yaml` est celle d'avant, le nom des services près.

### Alternatives évaluées

Le critère a changé depuis le #8. Il ne s'agit plus de choisir la brique la plus confortable, mais celle qui ne disparaîtra pas une seconde fois : licence libre, éditeur qui ne dépend pas de la conversion des utilisateurs de l'édition gratuite, images publiques.

| Option | Raison de l'écarter |
|---|---|
| LocalStack | Premier choix, abandonné après essai. L'édition communautaire a été supprimée à la version 2026.03, en mars 2026, et l'image renvoie désormais un défaut d'activation de licence, y compris avec `ACTIVATE_PRO=0`. Le tag dédié à S3 affiche au démarrage une invitation à passer sur `localstack-pro`. Exactement le scénario dont on cherche à sortir. |
| Miroir des images MinIO sur GHCR | Repousse le problème sans le traiter : fige une brique archivée, sans correctif de sécurité, et transfère au projet la charge du miroir. |
| `adobe/s3mock` | Démarre, mais a refusé l'envoi d'objet dans la configuration essayée. Reste un simulateur destiné aux tests unitaires, là où le besoin couvre aussi l'usage manuel en développement. |
| Garage | Candidat crédible et libre, écarté sur la configuration : fichier de configuration dédié et initialisation d'un layout de cluster, pour un service qui doit rester un conteneur qu'on démarre et qu'on oublie. |

Le choix s'est fait sur essai, et non sur documentation : pour chaque candidat, création du bucket, envoi d'un objet, génération d'une URL présignée, puis appel HTTP de cette URL. SeaweedFS est le seul à avoir servi les quatre étapes, la dernière en 200 avec le contenu attendu. C'est la vérification qui compte ici, l'URL présignée étant le seul point où le stockage est exposé au navigateur.

### Ce qui change, et ce qui ne change pas

Aucune ligne de code applicatif, conformément à la promesse du #1. Les modifications tiennent dans `compose.yaml`, `compose.override.yaml` et deux variables de `.env` : le port passe de 9000 à 8333 et le nom d'hôte de `minio` à `storage`.

Le service est nommé `storage` et non `seaweedfs`. La leçon de ce ticket est que l'implémentation change plus souvent que le rôle ; le prochain remplacement ne devrait pas avoir à traverser le `compose.yaml`, le `Makefile` et les commentaires de test comme celui-ci l'a fait.

### Points de vigilance

- **La console web disparaît.** MinIO en offrait une sur le port 9001, SeaweedFS n'a pas d'équivalent pour inspecter un bucket. L'AWS CLI ou n'importe quel client S3 remplit ce rôle, avec une étape de plus qu'un navigateur.
- **La passerelle S3 ne vérifie pas les identifiants dans cette configuration.** N'importe quelle paire de clés est acceptée, `STORAGE_S3_KEY` et `STORAGE_S3_SECRET` ne servant plus qu'à ce que le client puisse signer ses requêtes. Le port n'est donc publié que sur la boucle locale, `127.0.0.1:8333`, là où MinIO écoutait sur toutes les interfaces du poste. Une configuration d'identités S3 est possible le jour où ce stockage servirait ailleurs qu'en développement.
- **Le test de bonne santé vise `127.0.0.1` et non `localhost`.** Le conteneur résout d'abord ce nom en IPv6, sur laquelle la passerelle n'écoute pas, et le service resterait éternellement marqué défaillant. Le piège a coûté un démarrage complet avant d'être compris.

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
- **Mot de passe sur un fichier** : documenté à part, dans `download_password.md`. Six caractères minimum, hachés par un service distinct de celui des comptes, et cinq tentatives par lien et par quinze minutes sur la route de téléchargement.
- **Expiration automatique des fichiers** : documentée à part, dans `auto_expiration.md`. Purge quotidienne par commande console et cron système, portant sur l'objet stocké seul, la ligne d'historique étant conservée.
- **Outillage de tests** : PHPUnit + PCOV, Vitest + React Testing Library, Cypress, k6 (plutot gatling ou octoperf).
- **Isolation des tests back** : `dama/doctrine-test-bundle`, qui enveloppe chaque test dans une transaction annulée en fin de test. Écarté, le nettoyage manuel des tables, dont le coût se répète à chaque nouvelle classe de test au lieu d'être payé une fois. Les tests visent la base `app_test`, Doctrine suffixant déjà le nom de la base en environnement de test.

## Points de vigilance

- **Limites PHP.** L'upload transitant par l'API, `upload_max_filesize`, `post_max_size`, `max_execution_time` et les limites du reverse proxy doivent accepter 1 Go, et être documentés dans les scripts de déploiement. Limite à mesurer dans PERF.md, l'upload par URL présignée étant l'axe d'optimisation identifié.
- **Endpoint MinIO joignable depuis le navigateur.** Résolu au #8. La signature de l'URL présignée couvre son nom d'hôte, l'URL ne peut donc pas être réécrite après signature sans devenir invalide. Deux clients S3 coexistent : `aws.s3.client` sur l'adresse interne du conteneur, pour les lectures et écritures de l'application, et `aws.s3.public_client` sur l'adresse joignable par le navigateur, exposé comme storage Flysystem `public.storage` et réservé à l'émission des URLs présignées.
- **Surcharge de `STORAGE_S3_PUBLIC_ENDPOINT` en déploiement.** Sa valeur par défaut vise l'environnement local. Oubliée en production, elle n'empêche pas le démarrage et produit des URLs présignées injoignables, donc une panne visible seulement côté navigateur. À intégrer à la checklist du #23.
- **Opérations hors CRUD API Platform.** L'upload multipart et l'émission d'URL présignée demandent des opérations personnalisées et une documentation OpenAPI manuelle.
- **Deux rapports de couverture** à présenter, back et front, pour justifier le seuil de 70 %.
- **Accessibilité.** React ne fournit aucun garde-fou, les libellés, le focus et les rôles ARIA sont à la charge du développement.