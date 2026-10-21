# Revue technique du code écrit par l'IA

**Date** : 2026-10-21. **Constats corrigés le même jour**, voir "Suites données".

Le code de ce projet a été écrit par un copilote IA sous supervision humaine, selon la méthode décrite dans
[ai_usage.md](../ai_usage.md). Ce document est la revue technique de ce code : ce qui a été relu, ce qui a été
trouvé, et ce qui en a été fait.

## Périmètre et méthode

La revue porte sur les **parcours critiques**, ceux que l'énoncé désigne et où vivent les décisions de
sécurité : dépôt d'un fichier, téléchargement par lien, authentification et gestion des tags, côté serveur
comme côté interface.

| Couche | Fichiers relus |
|---|---|
| Logique métier | `src/State/` (upload, download, suppression, tags, mot de passe) |
| Entrées et validation | `src/ApiResource/FileUploadInput.php`, `src/Validator/`, `src/Serializer/MultipartDecoder.php` |
| Persistance | `src/Entity/File.php`, colonnes et contraintes |
| Interface | `src/api/`, `src/auth/`, `src/validation/uploadSchema.ts` |

Trois moyens, dans cet ordre : lecture du code, confrontation avec les décisions d'architecture qu'il est
censé appliquer, puis **vérification par l'exécution** contre l'API locale. Les trois premiers constats
ci-dessous ne sont pas des suppositions de lecture, ils ont été reproduits.

**Limite de méthode, à énoncer d'emblée.** Cette revue est conduite par le même outil que celui qui a écrit le
code. Une autorevue ne vaut pas une relecture indépendante : elle repère mal ce qui relève d'un angle mort
partagé, typiquement une hypothèse fausse tenue pour acquise des deux côtés. Elle vient donc en complément de
la relecture humaine faite avant chaque fusion, pas à sa place.

## Ce que la revue a trouvé

### 1. Un nom de fichier de plus de 255 caractères provoque une erreur 500

**Gravité** : élevée. **Reproduit.**

`File::$name` est une colonne `length: 255` alimentée par `getClientOriginalName()`, sans aucune contrainte
applicative. Aucune validation ne borne ce nom, ni dans `FileUploadInput`, ni dans `uploadSchema.ts`.

```
curl -X POST http://localhost:8080/api/files -F "file=@test.txt;filename=$(python3 -c "print('a'*300)").txt"
HTTP 500
SQLSTATE[22001]: String data, right truncated: value too long for type character varying(255)
```

Le client reçoit une erreur serveur là où toutes les autres limites de l'application répondent 422 avec le
champ fautif. Un utilisateur n'a aucun moyen de comprendre ce qu'il doit changer.

**Correctif proposé** : une contrainte de longueur sur le nom du fichier déposé, dans `FileUploadInput`, et sa
contrepartie dans `uploadSchema.ts` pour que l'erreur s'affiche avant l'envoi.

### 2. Le type MIME déclaré par le client provoque la même erreur

**Gravité** : élevée. **Reproduit.**

Même cause, autre champ. `File::$mimeType` est une colonne `length: 255` alimentée par `getClientMimeType()`,
c'est-à-dire par une valeur **entièrement sous contrôle du client**, qu'aucune validation ne borne.

```
curl -X POST http://localhost:8080/api/files -F "file=@test.txt;type=text/$(python3 -c "print('x'*300)")"
HTTP 500
```

Celui-ci est le plus gênant des deux : le nom de fichier est au moins visible par l'utilisateur, alors que le
type MIME est un en-tête que personne ne regarde. `SECURITY.md` note déjà que ce type n'est pas digne de
confiance et qu'il ne sert qu'à choisir une icône ; le raisonnement s'arrête à ce qu'il contient, pas à sa
longueur.

**Correctif proposé** : tronquer ou replier sur `application/octet-stream` au-delà de la longueur acceptée.
Refuser l'envoi entier pour un en-tête purement cosmétique serait disproportionné.

### 3. Un envoi qui échoue laisse un objet orphelin dans le stockage

**Gravité** : élevée. **Reproduit.** C'est le constat le plus intéressant de cette revue, parce qu'il
contredit une décision d'architecture écrite.

`FileUploadProcessor::process()` écrit l'objet dans le stockage (`writeStream`, ligne 81) **avant** de
confier l'entité au processeur de persistance (ligne 122). Tout échec postérieur à l'écriture, dont les deux
constats ci-dessus, laisse dans le stockage des octets qu'aucune ligne en base ne référence.

Les journaux le confirment : les deux requêtes terminées en 500 ont bien émis leur `file.stored` avant
d'échouer.

```json
{"message":"file.stored","context":{"size_bytes":16,"mime_type":"text/xxxxxx...","anonymous":true}}
```

Ces objets sont **irrécupérables** : sans ligne en base, ni la suppression manuelle ni la purge des fichiers
expirés décrite dans [MAINTENANCE.md](MAINTENANCE.md) ne peuvent les atteindre, puisque l'une et l'autre
partent de l'historique.

Or `tech_stack.md` justifie précisément le dépôt par l'API de cette façon :

> **Upload par l'API.** La transaction "objet écrit, métadonnées enregistrées" reste atomique. Une URL
> présignée en écriture aurait introduit le cas "upload réussi mais confirmation perdue", donc des objets
> orphelins à réconcilier.

Le code produit exactement le cas que l'architecture prétend éviter. L'écart est plus étroit que l'ADR ne le
laisse croire, et l'argument d'atomicité qui a écarté l'URL présignée en écriture s'en trouve affaibli.

**Correctif proposé** : envelopper la persistance et, en cas d'échec, supprimer l'objet qui vient d'être
écrit. Quelques lignes, et l'atomicité annoncée devient vraie. À défaut, corriger l'ADR pour qu'il décrive ce
que le code fait.

### 4. Le secret qui protège les clés de limitation est vide en production

**Gravité** : moyenne.

`DownloadPasswordThrottle::hash()` signe le jeton de téléchargement et l'adresse IP par un HMAC-SHA256 avant
de les confier au stockage du limiteur, avec `%kernel.secret%` pour clé. Le commentaire en explique
l'intention : le limiteur sérialise son identifiant en clair, et ni un jeton qui donne accès à un fichier ni
une adresse IP n'ont à y figurer.

Mais `APP_SECRET` est **vide** dans `DataShare_API/.env`. Il n'est renseigné que dans `.env.dev` et
`.env.test`, c'est-à-dire nulle part en production.

Un HMAC à clé vide reste un condensé déterministe : il fonctionne comme clé de cache, mais n'est plus un
secret. Quiconque lit le cache peut recalculer l'empreinte de jetons candidats et confirmer lesquels ont été
récemment essayés. La protection annoncée se réduit à une obfuscation.

`SECURITY.md` signale déjà que `APP_SECRET` est vide, dans la liste des reprises avant déploiement. Ce que
cette revue ajoute, c'est **ce qui en dépend** : la liste ne mentionne pas que la protection du limiteur en
découle.

**Correctif proposé** : rendre `APP_SECRET` obligatoire au démarrage, plutôt que silencieusement vide.

### 5. Le front ne reproduit pas toutes les limites du back

**Gravité** : faible.

`uploadSchema.ts` reprend fidèlement la taille maximale, les extensions interdites, la durée d'expiration et
les règles de tags, chacune avec le commentaire qui la rattache à sa contrainte serveur. La longueur du nom de
fichier, elle, n'y figure pas, puisqu'elle n'existe nulle part côté serveur non plus.

C'est la même famille de défaut que le bug du gigaoctet trouvé pendant la campagne de performance, où le
formulaire acceptait 73 Mo de plus que l'API : une règle que les deux côtés sont censés partager, et qu'un
seul connaît. Corriger le constat 1 des deux côtés referme celui-ci.

## Ce que la revue a trouvé solide

Une revue qui ne listerait que des défauts donnerait une image fausse du code relu.

- **Les commentaires expliquent le pourquoi, pas le quoi.** `DownloadPasswordThrottle` documente le piège de
  `consume(0)`, qui laisse passer une tentative de trop, et la raison pour laquelle le compteur par client
  n'est volontairement pas remis à zéro après un succès. Ce sont des décisions que personne ne retrouverait
  en lisant le code seul.
- **Les cas limites sont raisonnés plutôt que subis.** L'ordre objet-puis-ligne de la suppression est
  justifié par la conséquence du cas inverse, un mot de passe absent compte comme un échec, et le 410 ne
  distingue pas un lien expiré d'un lien inexistant.
- **Les frontières de confiance sont explicites.** Le type MIME est documenté comme non fiable et cantonné au
  choix d'une icône, et l'interface rappelle à chaque règle que le serveur reste seul à faire foi.
- **Les erreurs attendues et les erreurs impossibles sont distinguées.** Une `LogicException` marque ce qui
  ne peut arriver que par mauvaise configuration, jamais par faute du client.

## Suites données

Les cinq constats ont été corrigés dans la foulée de la revue.

| Constat | Correctif | Où |
|---|---|---|
| 1 | Contrainte de longueur sur le nom déposé, réponse 422 portée par `file` | `FileUploadInput::validateFileName()` |
| 2 | Type MIME replié sur `application/octet-stream` au-delà de 255 caractères | `FileUploadProcessor::boundMimeType()` |
| 3 | L'objet écrit est supprimé si la suite échoue, l'erreur d'origine est relancée | `FileUploadProcessor::process()`, `discardStoredObject()` |
| 4 | Démarrage refusé si `APP_SECRET` est vide, plutôt qu'une protection silencieusement perdue | `DownloadPasswordThrottle::__construct()` |
| 5 | Même limite qu'au constat 1, côté interface | `uploadSchema.ts` |

**Les correctifs sont verrouillés par des tests**, sans quoi ils se déferaient sans bruit :

| Test | Ce qu'il tient |
|---|---|
| `FileUploadTest::testItRejectsAFileNameLongerThanTheColumn` | 422 et non 500 sur un nom de 256 caractères |
| `FileUploadTest::testItFallsBackOnAnOversizedMimeType` | 201 et type replié sur un en-tête de 305 caractères |
| `FileUploadProcessorTest::testItRemovesTheStoredObjectWhenPersistingFails` | l'objet supprimé est bien celui qui vient d'être écrit |
| `FileUploadProcessorTest::testItReportsTheOriginalFailureWhenTheCleanupAlsoFails` | un nettoyage en échec ne masque pas l'erreur d'origine |
| `uploadSchema.test.ts` | 255 accepté, 256 refusé, et la limite alignée sur la colonne |

Les deux cas qui répondaient 500 ont été rejoués contre l'API après correctif : le nom trop long répond
désormais 422 en nommant le champ `file`, et le type MIME démesuré passe en 201 avec
`application/octet-stream`. La suite complète est au vert, 197 tests côté serveur et 294 côté interface,
PHPStan au niveau maximum et le build front compris.

**Deux points n'ont volontairement pas été traités ici.**

Le correctif du constat 3 rend vraie l'atomicité que `tech_stack.md` annonçait, mais seulement pour les
échecs que l'application voit passer. Un processus tué entre l'écriture et la validation laisserait toujours
un orphelin, qu'aucune réconciliation ne réclame. L'écart avec le dépôt par URL présignée est donc réduit,
pas annulé, et l'ADR gagnerait à le dire.

Les deux objets orphelins créés par cette revue avant correctif sont toujours dans le stockage de
développement. Rien ne permet de les atteindre, c'est précisément ce que le constat 3 décrivait.

## Limites de cette revue

- **Le périmètre est volontairement restreint** aux parcours critiques. L'interface au-delà des formulaires
  d'envoi et de téléchargement, les composants d'affichage et la mise en page n'ont pas été relus ici.
- **Aucune analyse de concurrence.** Deux dépôts simultanés du même tag par le même compte, ou une
  suppression pendant un envoi, n'ont pas été éprouvés.
- **L'autorevue reste une autorevue**, pour la raison dite en tête de document.
- **Les tests reproduits ont laissé des traces** dans la base de développement : deux objets orphelins dans
  le stockage, par construction irrécupérables, et une ligne de fichier déposée sans compte, donc non
  supprimable. Sans conséquence sur un environnement de développement, et cohérent avec ce que
  `TESTING.md` dit déjà des tests de bout en bout.

## Voir aussi

- [ai_usage.md](../ai_usage.md), la méthode de travail avec l'IA et les garde-fous en place
- [SECURITY.md](SECURITY.md), les limites de sécurité déjà connues et assumées
- [TESTING.md](TESTING.md), ce que les tests automatisés vérifient par ailleurs
- [PERF.md](PERF.md), le bug du gigaoctet, de la même famille que le constat 5
- [tech_stack.md](../architectureDecisions/tech_stack.md), la décision d'architecture que le constat 3 met en
  défaut
