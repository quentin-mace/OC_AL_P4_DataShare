# Sécurité

**Dernier audit** : 2026-10-19, ticket [#20](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/20)

DataShare est un prototype de démonstration. Il protège l'accès aux fichiers et aux comptes, et borne ce qu'un
visiteur peut déposer. Il ne prétend pas résister à un attaquant déterminé : les limites sont listées en fin de
document, assumées et chiffrées plutôt que tues.

## Authentification et accès

L'authentification se fait par JWT signé RSA, sans session serveur. Le pare-feu `main` est `stateless`, le
jeton vaut une heure (`JWT_TTL`), et les clés sont générées par `make keys`, jamais versionnées.

`access_control` est volontairement vide. La sécurité est posée opération par opération dans
`src/Entity/File.php`, parce que certaines routes sont publiques par conception :

| Route | Qui y a droit |
|---|---|
| `POST /api/files` | tout le monde, avec ou sans compte (US07) |
| `GET /api/files` | un compte connecté, et seulement ses fichiers |
| `DELETE /api/files/{id}` | le propriétaire du fichier, et lui seul |
| `GET` et `POST /api/downloads/{token}` | quiconque détient le lien |

Trois mesures limitent ce qu'un attaquant apprend en tâtonnant :

- **Le 401 de connexion ne distingue pas** un compte inconnu d'un mot de passe faux. Énumérer les comptes par
  la page de connexion ne donne rien.
- **Le 410 d'un lien ne distingue pas** un jeton expiré d'un jeton qui n'a jamais existé.
- **La connexion est limitée à 5 tentatives par quart d'heure**, et le 401 de Lexik devient alors un 429.

## Mots de passe

Deux mots de passe sans rapport l'un avec l'autre, deux politiques et deux mécanismes de hachage distincts.

| | Compte | Partage d'un fichier |
|---|---|---|
| Longueur minimale | 16 caractères | 6 caractères |
| Robustesse | `PasswordStrength`, score moyen exigé | aucune contrainte |
| Hachage | hasher Symfony `auto` | `NativePasswordHasher` dédié |
| Où c'est défini | `src/Entity/User.php` | `src/ApiResource/FileUploadInput.php` |

**L'écart avec les spécifications est assumé.** Elles demandent 8 caractères pour un compte, la politique en
exige 16 avec une robustesse minimale. Un mot de passe comme `aB3$aB3$aB3$aB3` est refusé : 15 caractères,
mais 4 caractères distincts. La décision est tracée dans
[tech_stack.md](../architectureDecisions/tech_stack.md), au ticket
[#32](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/32).

**`NotCompromisedPassword` a été écartée, pour une raison d'architecture et non de sécurité.** La contrainte
interroge le service haveibeenpwned à chaque inscription. Elle placerait un appel HTTP vers un tiers sur un
parcours critique, avec sa latence et son point de panne. La décision est peu coûteuse à reprendre : une
annotation à ajouter, et `validator.yaml` désactive déjà la contrainte en environnement de test.

**Aucun hash ne sort de l'application.** Pour un compte, `plainPassword` est effacé dès qu'il est haché, et
`User::__serialize()` remplace le hash par une empreinte courte pour que la session ne le contienne jamais.
Pour un fichier, l'accesseur exposé s'appelle `isPasswordProtected()` et rend un booléen ; il ne peut pas
s'appeler `hasPassword()`, car le sérialiseur résoudrait alors `getPassword()` et publierait le hash.

## Fichiers déposés

**Douze extensions sont refusées** : `exe`, `bat`, `cmd`, `sh`, `ps1`, `msi`, `dll`, `scr`, `jar`, `php`,
`js`, `vbs`. La liste vit dans `FORBIDDEN_FILE_EXTENSIONS` et la comparaison est insensible à la casse.

C'est une liste noire, pas une liste blanche : une extension inconnue passe. Le choix est celui d'un service
de partage généraliste, où interdire par défaut rendrait l'outil inutilisable.

**Le type MIME est celui que le client déclare**, jamais celui que le serveur devine. Il ne sert qu'à choisir
une icône, donc un MIME menti n'ouvre aucune porte : il affiche la mauvaise image. Deviner le vrai type
demanderait `symfony/mime`, qui n'est pas une dépendance du projet.

**La taille est plafonnée à 1 Go**, et le plafond est aligné aux trois endroits qui peuvent le contredire :
la validation applicative, `upload_max_filesize` côté PHP et `client_max_body_size` côté nginx. Un fichier
trop gros est donc refusé proprement en 422, pas par une erreur de passerelle.

nginx refuse par ailleurs de servir le moindre `.php` autre que le point d'entrée de l'application.

## Liens de téléchargement

Un lien porte un jeton de 32 caractères hexadécimaux, imprévisible, et c'est lui seul qui donne accès au
fichier. L'URL de téléchargement n'est pas le lien : le serveur signe une URL présignée vers le stockage S3,
valable **60 secondes**.

Soixante secondes suffisent parce que la validité ne couvre que l'instant où le navigateur ouvre la connexion,
pas la durée du transfert. Un fichier d'un gigaoctet se télécharge donc sans difficulté avec une URL qui a
expiré entre-temps.

**Un mot de passe de partage est limité à 5 essais par quart d'heure et par lien**, plus 25 par client sur la
même fenêtre. Le compteur est vérifié avant la comparaison, et seuls les échecs le font avancer : un succès ne
remet à zéro que le compteur du lien. Les identifiants qui servent de clé, jeton et adresse IP, passent par un
HMAC-SHA256 tronqué avant d'atteindre le stockage, parce que le limiteur sérialise sa clé en clair.

Le détail de ce mécanisme, et le piège de `consume(0)` qu'il contourne, sont dans
[download_password.md](../architectureDecisions/download_password.md).

## Scan des dépendances

Trois commandes, rejouables :

```bash
make audit          # composer audit, puis npm audit sur le front et sur e2e
make audit-images   # Trivy sur les images Docker de la stack
```

### Dépendances applicatives, 2026-10-19

| Périmètre | Résultat |
|---|---|
| `composer audit` (back) | 2 avis, **corrigés dans cette revue** |
| `npm audit` (front) | 0 vulnérabilité |
| `npm audit` (e2e) | 0 vulnérabilité |

Les deux avis portaient sur Symfony 8.1.6 :

| CVE | Paquet | Nature | Atteignable ici ? | Décision |
|---|---|---|---|---|
| CVE-2026-108082 | `symfony/http-foundation` | ReDoS dans `HeaderUtils::split()`, par l'en-tête `Cache-Control` | **Oui, par n'importe quel client** | Corrigée, montée en 8.1.9 |
| CVE-2026-109449 | `symfony/expression-language` | Imbrication non bornée dans l'analyseur d'expressions | Non : les seules expressions évaluées sont les règles de sécurité écrites dans le code | Corrigée par la même montée |

La première comptait vraiment : un en-tête de requête forgé suffisait à faire tourner le processus PHP en rond.
La seconde ne valait que par la règle qui veut qu'on ne discute pas une correction disponible et gratuite.
Symfony passe en 8.1.9, `composer audit` est propre et les 188 tests du back passent toujours.

### Images Docker, 2026-10-19

Trivy, vulnérabilités de sévérité HIGH et CRITICAL uniquement.

| Image | HIGH | CRITICAL | Où |
|---|---|---|---|
| `postgres:16-alpine` | 24 | 1 | toutes dans le binaire `gosu`, aucune dans Alpine |
| `nginx:alpine` | 2 | 0 | Alpine 3.24.2 |
| `chrislusf/seaweedfs:4.47` | 5 | 0 | binaire `weed` |
| `amazon/aws-cli:2.37.4` | 37 | 0 | Amazon Linux 2023 |
| `adminer:4-standalone` | 21 | 0 | Alpine 3.24.1 |
| `node:22-slim` | 71 | 4 | Debian 12, plus 11 paquets npm embarqués |
| `php:8.4-fpm` | 130 | 3 | Debian 13 |
| `cypress/included:16.1.1` | 296 | 8 | Debian 13, plus 88 paquets npm embarqués |

**Analyse.** Aucune de ces vulnérabilités n'est dans le code du projet : toutes viennent des distributions de
base des images officielles, et la plupart concernent des bibliothèques que l'application n'appelle jamais
(`perl`, `linux-libc-dev`, outils de ligne de commande). Le volume élevé de `php:8.4-fpm` et de
`cypress/included` tient à leur taille, pas à leur négligence : ce sont des images Debian complètes.

**Décisions prises :**

- **Rien à corriger dans l'immédiat**, mais le chiffre devient une référence. Une montée brutale entre deux
  scans est le signal à surveiller, pas la valeur absolue.
- **`cypress/included` ne tourne jamais en production**, ni même en développement courant : c'est l'image des
  tests. Ses 304 avis ne pèsent pas sur la surface d'attaque du service.
- **`adminer` est un outil de confort**, et sa présence coûte 21 avis pour un service qui n'a rien à faire
  ailleurs qu'en développement. Il est à retirer de la stack de production.
- **`php:8.4-fpm` et `node:22-slim` se mettront à jour avec leur image amont.** La procédure est dans
  [MAINTENANCE.md](MAINTENANCE.md).

## Limites connues et risques acceptés

- **L'upload anonyme n'est limité par rien.** N'importe qui peut remplir le stockage, un gigaoctet à la fois,
  sans compte. C'est le premier correctif de sécurité à apporter : une limite par adresse IP sur
  `POST /api/files`, avec le limiteur de débit déjà en place pour le téléchargement.
- **Les compteurs de limitation sont locaux à l'instance PHP.** Ils vivent dans un cache filesystem.
  Répliquer l'application diviserait silencieusement toutes les limites par le nombre d'instances, sans
  qu'aucune erreur ne le signale. Redis est la reprise évidente, et le changement tient dans la
  configuration.
- **Le JWT est stocké dans le `localStorage` du navigateur.** Une faille XSS donnerait le jeton. La parade
  retenue est de ne pas avoir de XSS : React échappe le contenu par défaut, et le code n'emploie aucun
  `dangerouslySetInnerHTML`. C'est une parade par discipline, à revérifier à chaque composant ajouté.
- **La déconnexion est locale.** Le jeton effacé du navigateur reste valable côté serveur jusqu'à son
  expiration, au plus une heure. Il n'existe pas de liste de révocation.
- **Un fichier déposé sans compte n'est effaçable par personne** avant son expiration, puisque aucun compte ne
  le possède.
- **Rien ne plafonne le nombre de tags par fichier**, ni le nombre de fichiers par compte.
- **La liste des extensions interdites est écrite deux fois**, dans `DataShare_API/.env` et dans
  `DataShare_Front/src/validation/uploadSchema.ts`. Rien ne garantit qu'elles restent identiques. Le back
  reste l'autorité : une divergence ne crée pas de faille, elle crée une incohérence d'affichage.
- **Les identifiants du fichier `.env` sont des valeurs de développement**, volontairement versionnées pour
  qu'un poste neuf démarre sans configuration. Le fichier le dit lui-même. Un déploiement réel doit les
  remplacer par des secrets injectés par l'environnement, et renseigner `APP_SECRET`, vide aujourd'hui.
- **La passerelle S3 ne vérifie aucun identifiant** dans cette configuration : n'importe quelle paire de clés
  est acceptée. C'est pour cette raison que le port 8333 n'est publié que sur `127.0.0.1`, et non sur toutes
  les interfaces. Même raisonnement pour le port 5173 du serveur de développement.
- **Adminer est exposé sur le port 8081** sans autre protection que les identifiants PostgreSQL.
- **Tout circule en clair en local.** HTTPS, les en-têtes de sécurité et la configuration CORS de production
  relèvent du déploiement, qui n'est pas traité ici.

## Voir aussi

- [TESTING.md](TESTING.md), ce que les tests vérifient des règles décrites ici
- [PERF.md](PERF.md), ce que coûte un gros envoi, et donc ce qu'un upload anonyme non plafonné permet
- [MAINTENANCE.md](MAINTENANCE.md), la fréquence des audits et la procédure de correction
- [tech_stack.md](../architectureDecisions/tech_stack.md), les décisions de mot de passe et de stockage du JWT
- [download_password.md](../architectureDecisions/download_password.md), le mécanisme de limitation
- [anonymous_upload.md](../architectureDecisions/anonymous_upload.md), ce que l'upload sans compte ouvre
