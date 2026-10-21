# DataShare

Partage de fichiers par lien, avec expiration, tags et mot de passe optionnel. Projet du cours "Pilotez le
développement d'une application full-stack complète" de la formation Architecte Logiciel d'OpenClassrooms.

API Symfony 8 et API Platform, front React 19 et Vite, PostgreSQL, stockage S3. Tout tourne dans Docker.

## Prérequis

Docker et Docker Compose. Rien d'autre à installer, ni PHP, ni Node, ni PostgreSQL.

## Démarrer

```bash
cd DataShare_API
make init              # dependances PHP, cles JWT, base de donnees migree
cd ..
docker compose up -d   # demarre l'API et le front ensemble
```

Le front installe ses dépendances npm à son premier démarrage, comptez une minute avant qu'il réponde.

| Quoi | Adresse |
|---|---|
| Application | http://localhost:5173 |
| API, documentation interactive comprise | http://localhost:8080/api |
| Base de données (Adminer) | http://localhost:8081 |
| Stockage S3 | http://localhost:8333 |

Pour Adminer : système PostgreSQL, serveur `database` (pré-rempli), puis utilisateur, mot de passe et base
depuis `DataShare_API/.env`, soit `app` / `!ChangeMe!` / `app` par défaut.

Ensuite, `docker compose up -d` et `docker compose down` depuis la racine suffisent au quotidien.

## Les commandes utiles

Chaque projet a son `Makefile`, où la liste complète des cibles est commentée.

| Où | Commande | Ce qu'elle fait |
|---|---|---|
| racine | `docker compose up -d` / `down` | démarre ou arrête toute la stack |
| racine | `make audit` | cherche les vulnérabilités des dépendances |
| `DataShare_API` | `make test` | lance les tests PHPUnit |
| `DataShare_API` | `make coverage` | les tests avec le rapport de couverture |
| `DataShare_API` | `make lint` | CS-Fixer et PHPStan, sans rien modifier |
| `DataShare_API` | `make qa` | corrige le style puis lance PHPStan |
| `DataShare_API` | `make migrate` | joue les migrations en attente |
| `DataShare_API` | `make migration` | génère une migration depuis les entités |
| `DataShare_Front` | `make test` | lance les tests Vitest |
| `DataShare_Front` | `make coverage` | les tests avec couverture, seuil 70 % |
| `DataShare_Front` | `make lint` | oxlint et vérification du formatage |
| `DataShare_Front` | `make format` | corrige le formatage |
| `DataShare_Front` | `make build` | vérifie les types puis construit le bundle |
| `e2e` | `make run` | les tests de bout en bout, stack démarrée |
| `perf` | `make load` | la montée en charge sur l'endpoint d'upload |
| `perf` | `make front` | le budget de bundle et les scores Lighthouse |
| `perf` | `make metrics` | les temps de réponse tirés des logs du back |

## Configuration

Les valeurs par défaut sont versionnées et suffisent à travailler en local. Elles sont dans
`DataShare_API/.env` et `DataShare_Front/.env`.

Ce qui vous est propre va dans un fichier `.env.local` à côté, jamais commité :

| Variable | Fichier | À quoi elle sert |
|---|---|---|
| `JWT_PASSPHRASE` | `DataShare_API/.env.local` | protège les clés JWT, créée par `make init` |
| `VITE_API_URL` | `DataShare_Front/.env.local` | adresse de l'API appelée par le navigateur |

## Bon à savoir

- **`node_modules` vit dans un volume Docker**, pas sur votre disque. Un `npm install` lancé sur le poste ne
  sert qu'à votre éditeur.
- **Ne lancez pas le front seul et la stack racine en même temps.** Les deux publient le port 5173. Soit
  `docker compose up -d` depuis la racine, soit `make up` dans chaque dossier, pas les deux.
- **Les migrations sont la source unique du schéma.** `doctrine:schema:update` n'est pas utilisé ici.
- **Les tests ne touchent pas votre base de développement**, ils ont la leur.
- **Les tests de bout en bout ne fonctionnent que sous Linux**, le conteneur Cypress utilisant le réseau de
  l'hôte.

## Pour aller plus loin

| Document | Pour |
|---|---|
| [TESTING.md](docs/quality/TESTING.md) | le plan de tests, les commandes et la couverture |
| [SECURITY.md](docs/quality/SECURITY.md) | les mesures de sécurité, les scans et leurs limites |
| [PERF.md](docs/quality/PERF.md) | le budget front, les temps de réponse et ce qui freine les gros envois |
| [MAINTENANCE.md](docs/quality/MAINTENANCE.md) | mettre à jour les dépendances sans rien casser |
| [Guide de l'interface](docs/ui_guide.md) | écrire un écran du front sans réinventer un composant |
| [Contrat d'API](docs/specs/API/contrat-api.md) | les routes, les champs et les codes d'erreur |
| [Décisions d'architecture](docs/architectureDecisions/) | pourquoi le projet est fait comme ça |
| [Support de soutenance](docs/presentation/index.html) | le projet en dix-sept slides, à ouvrir dans un navigateur |

Ce README existe aussi en [version HTML](docs/html/index.html), plus agréable à lire hors de GitHub.
