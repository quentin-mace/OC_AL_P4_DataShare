# Plan de tests

**Dernière exécution** : 2026-10-21, après les correctifs de
[AI_CODE_REVIEW.md](AI_CODE_REVIEW.md). Campagne précédente le 2026-10-19, ticket
[#19](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/19).

| Chaîne | Outils | Tests | Couverture des lignes |
|---|---|---|---|
| Back | PHPUnit 13, PCOV | 197 | 90,56 % |
| Front | Vitest 5, Testing Library | 294 | 99,27 % |
| Bout en bout | Cypress 16 | 7 | sans objet |

L'objectif de 70 % est tenu des deux côtés. Il n'est bloquant que côté front, voir "Couverture".

## Trois niveaux, trois questions

**Unitaire.** Une classe, ses dépendances simulées. Côté back, cela vise les `State` d'API Platform, là où
vit la logique métier : qui a le droit, quoi hacher, quoi refuser. Côté front, les schémas de validation, les
utilitaires de format et les composants pris un par un.

**Fonctionnel.** Une vraie requête HTTP sur le noyau Symfony, via `WebTestCase`. Ces tests passent par le
routeur, le pare-feu, le sérialiseur et le validateur, donc ils attrapent ce que les tests unitaires ne voient
pas : un groupe de sérialisation oublié, une règle de sécurité mal posée, un code de statut qui change.

**Bout en bout.** Un navigateur sur la stack complète, front, API et stockage S3 compris. Ces tests ne
connaissent que les URLs publiques. Ils répondent à la seule question que les deux autres niveaux ne posent
jamais : est-ce que ça marche vraiment ?

## Plan de tests

Une ligne par fonctionnalité critique, avec le critère qui fait foi.

| Fonctionnalité | Critère d'acceptation | Où c'est vérifié |
|---|---|---|
| US01 Upload authentifié | Le fichier arrive dans le stockage, la ligne est créée, un lien est rendu | `FileUploadTest`, `FileUploadProcessorTest`, `UploadDialog.test.tsx`, `upload.cy.ts` |
| US01 Limites d'upload | Au-delà de 1 Go, nom de plus de 255 caractères, extension interdite ou durée hors de 1 à 7 jours, l'envoi est refusé en 422 | `FileUploadTest`, `uploadSchema.test.ts` |
| US01 Échec d'envoi | Un échec après l'écriture supprime l'objet stocké, sans masquer l'erreur d'origine | `FileUploadProcessorTest` |
| US02 Téléchargement par lien | Un lien valide rend une URL présignée, le fichier reçu est identique à l'original | `DownloadTest`, `DownloadProcessorTest`, `download.cy.ts` |
| US02 Lien fermé | Un lien expiré ou inconnu répond 410, sans distinguer les deux cas | `DownloadTest`, `DownloadFileResolverTest` |
| US03 Création de compte | Un mot de passe trop court ou trop faible est refusé, le mot de passe est haché, jamais rendu | `UserRegistrationTest`, `UserPasswordHasherProcessorTest`, `registerSchema.test.ts`, `auth.cy.ts` |
| US04 Connexion | Les bons identifiants rendent un JWT, les mauvais un 401 indifférencié, 5 échecs valent un 429 | `UserLoginTest`, `LoginPage.test.tsx`, `auth.cy.ts` |
| US05 Historique | Chaque compte ne voit que ses fichiers, un envoi anonyme n'apparaît nulle part | `FileListTest`, `UserFilesProviderTest`, `FilesPage.test.tsx` |
| US06 Suppression | Seul le propriétaire supprime, l'objet part avant la ligne, un objet déjà absent n'est pas une erreur | `FileDeleteTest`, `FileDeleteProcessorTest` |
| US07 Upload anonyme | L'envoi sans compte réussit, mais les tags sont refusés en 422 | `FileUploadTest`, `upload.cy.ts` |
| US08 Tags | Ajout, renommage et retrait, tags réservés aux comptes, tag orphelin supprimé | `FileTagTest`, `FileTag*ProcessorTest`, `TagResolverTest`, `EditTagsDialog.test.tsx` |
| US09 Mot de passe de partage | Mauvais mot de passe en 401, bon en 200, 5 essais par lien puis 429 avec `Retry-After` | `DownloadTest`, `DownloadPasswordThrottleTest`, `download.cy.ts` |
| US10 Expiration | Le statut se déduit de la date, un fichier expiré reste listé mais n'est plus téléchargeable | `FileTest`, `DownloadTest`, `expiration.test.ts` |
| Contrat d'API | Le document OpenAPI généré décrit bien chaque route et chaque schéma | `OpenApiTest` |

Les fichiers back sont sous `DataShare_API/tests/{Unit,Functional}/`, les fichiers front à côté du code
qu'ils couvrent, les specs sous `e2e/cypress/e2e/`.

## Lancer les tests

### Back

```bash
cd DataShare_API
make test       # cree la base app_test, genere les cles de test, puis PHPUnit
make coverage   # idem, avec le resume texte et le rapport HTML dans var/coverage/
```

### Front

```bash
cd DataShare_Front
make test       # Vitest
make coverage   # Vitest avec couverture, rapport HTML dans coverage/
make test-watch # en continu pendant le developpement
```

### Bout en bout

La stack complète doit tourner, les tests passent par les URLs publiques.

```bash
docker compose up -d   # depuis la racine
cd e2e
make install           # premiere fois seulement
make run               # les 7 scenarios, en headless
make open              # interface de Cypress, sur le poste (Node 20+)
make typecheck         # types des specs
make format-check      # formatage
```

| Spec | Scénarios |
|---|---|
| `auth.cy.ts` | création de compte puis connexion par les formulaires ; mot de passe refusé ; espace personnel inaccessible sans session |
| `upload.cy.ts` | envoi anonyme depuis l'accueil, champ Tags absent, résultat recoupé par `GET /api/downloads/{token}` ; envoi avec tag depuis l'espace personnel, recoupé par `GET /api/files` |
| `download.cy.ts` | lien protégé, mauvais puis bon mot de passe, fichier reçu comparé à la fixture ; lien inconnu annoncé comme indisponible |

## Couverture

### Back, PHPUnit et PCOV, 2026-10-21

```
OK (197 tests, 559 assertions)

Summary:
  Classes: 63.33% (19/30)
  Methods: 84.42% (103/122)
  Lines:   90.56% (355/392)
```

Le taux par classe est plus bas que le taux par ligne, et c'est normal : il ne compte qu'une classe
entièrement couverte. `App\Entity\User` tire la moyenne vers le bas avec ses accesseurs générés jamais
appelés, pas la logique métier. Les `State`, qui portent les décisions, sont à 100 % de lignes à deux
exceptions près.

### Front, Vitest et v8, 2026-10-21

```
 Test Files  37 passed (37)
      Tests  294 passed (294)

File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   98.89 |    97.69 |   98.19 |   99.27 |
```

Le seuil de 70 % est configuré sur les quatre métriques dans `DataShare_Front/vite.config.ts`. Il fait
échouer `make coverage` et la CI s'il n'est pas tenu. Le rapport HTML détaillé est dans
`DataShare_Front/coverage/index.html`.

Les seuls fichiers non couverts sont des points d'entrée sans logique : `App.tsx`, `router.tsx`,
`startDownload.ts`.

## Ce que la CI rejoue

Trois workflows, filtrés par chemin, sur `main` et sur chaque pull request.

| Workflow | Ce qu'il fait |
|---|---|
| `backend-ci.yml` | PHP-CS-Fixer, PHPStan niveau max, base de test, migrations, clés JWT, PHPUnit avec `--coverage-text` |
| `frontend-ci.yml` | oxlint, Prettier, `tsc -b` via le build, Vitest avec couverture, rapport publié en artefact |
| `e2e.yml` | monte la stack complète, attend qu'elle réponde, joue les specs Cypress, publie les captures en cas d'échec |

## Pourquoi les tests sont indépendants

**La base de test est une autre base.** `make test` crée et migre `app_test`, distincte de la base de
développement, qui n'est donc jamais touchée.

**Chaque test vit dans une transaction annulée.** `dama/doctrine-test-bundle` l'ouvre avant le test et la
défait après. Aucun test n'a de nettoyage à faire, et l'ordre d'exécution n'a pas d'importance.

**Les compteurs de limitation survivent à la transaction**, puisqu'ils vivent dans le cache et non en base.
Les tests concernés les remettent à zéro eux-mêmes, via `ResetsRateLimitersTrait`.

**Les tests de bout en bout créent leur propre compte** à chaque exécution, du type
`e2e-<horodatage>-<aleatoire>@example.test`. Ils tournent sur la base de développement, qui n'est jamais
remise à zéro : sans comptes neufs, la limite de 5 tentatives de connexion déborderait d'une exécution à la
suivante.

## Limites connues

- **Aucun seuil de couverture n'est appliqué côté back.** Ni `phpunit.dist.xml` ni `backend-ci.yml` n'en
  fixent : la couverture est mesurée et affichée, jamais vérifiée. Les 89 % actuels tiennent par discipline,
  pas par garde-fou. Côté front, le seuil est bloquant.
- **Les tests fonctionnels écrivent dans le vrai stockage S3.** La transaction Doctrine ne couvre pas les
  objets déposés dans le bucket ; les tests concernés les suppriment eux-mêmes en fin d'exécution. Un test
  interrompu laisse donc des objets derrière lui, qu'aucune purge ne réclamera.
- **Les tests de bout en bout tournent sur la base de développement**, pas sur `app_test`. Ils y laissent les
  comptes et les fichiers qu'ils ont créés.
- **`make run` ne fonctionne que sous Linux.** Le conteneur Cypress utilise le réseau de l'hôte pour joindre
  `localhost:5173`, `:8080` et `:8333` comme le ferait un navigateur. Ailleurs, `make open` reste possible.
- **Un cache Symfony obsolète fait échouer des tests sans que le code soit en cause**, typiquement après un
  changement de groupe de sérialisation. La CI part d'un cache vide, un poste non. En cas d'échec
  inexplicable en local alors que la CI est verte, vider le cache avant de chercher plus loin. Le cache de
  test et celui de développement sont séparés, et les tests de bout en bout dépendent du second :

  ```bash
  cd DataShare_API
  docker compose run --rm -e APP_ENV=test php bin/console cache:clear   # fait echouer PHPUnit
  docker compose exec php bin/console cache:clear                       # fait echouer Cypress
  ```

  Le symptôme côté bout en bout est trompeur : un champ manquant dans une réponse d'API fait échouer un
  rendu du front, et c'est le front qui semble en cause.

## Voir aussi

- [SECURITY.md](SECURITY.md), ce que les tests de sécurité couvrent et ce qu'ils ne couvrent pas
- [PERF.md](PERF.md), ce que la mesure de charge a trouvé que les tests ne voient pas
- [MAINTENANCE.md](MAINTENANCE.md), la place des tests dans une montée de version
- [Guide de l'interface](../ui_guide.md), les conventions de test des composants front
