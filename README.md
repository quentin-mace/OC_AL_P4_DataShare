# OC_AL_P4_DataShare
Meta projet pour piloter le développement du projet "Data Share" pour le cours "Pilotez le développement d'une application full-stack complète" de la formation Architecte Logiciel d'OpenClassrooms

## Backend (DataShare_API)

Stack : Symfony 8 + API Platform, PostgreSQL, SeaweedFS (S3). Tout tourne via Docker, seul Docker Compose est nécessaire en local.

### Démarrer

```bash
cd DataShare_API
make init   # dépendances, clés JWT, démarrage de la stack et migrations
```

- API : http://localhost:8080 (doc interactive sur `/api`)
- Stockage S3 : http://localhost:8333 (pas de console web, s'inspecte à l'AWS CLI ou depuis un client S3)
- Adminer (base de données) : http://localhost:8081 — système PostgreSQL, serveur `database` (pré-rempli), utilisateur/mot de passe/base dans `DataShare_API/.env` (`app` / `!ChangeMe!` / `app` par défaut)

Ensuite, `make up` et `make down` suffisent au quotidien.

### Base de données

Les migrations sont la source unique du schéma, `doctrine:schema:update` n'est pas utilisé pour faire évoluer la base.

```bash
make migrate     # joue les migrations en attente
make migration   # génère une migration depuis les entités
make schema      # vérifie que les entités et la base concordent
```

Après avoir modifié une entité, générer la migration, la relire, puis la jouer et tester le retour en arrière (`make migrate ARGS="first"`). Tant que la branche n'est pas fusionnée, régénérer la migration existante plutôt que d'en empiler une seconde.

### Tests et qualité

```bash
make test      # prépare la base de test, puis lance PHPUnit
make test-db   # crée la base de test et y joue les migrations
make lint      # CS-Fixer et PHPStan, sans rien modifier
make qa        # corrige le style puis lance PHPStan
```

Les tests tournent sur une base distincte, `app_test`, que `make test-db` crée et migre. La base de développement n'est donc jamais touchée. Chaque test s'exécute dans une transaction annulée à la fin, grâce à `dama/doctrine-test-bundle` : les tests sont indépendants les uns des autres et n'ont aucun nettoyage à faire.

Les commandes s'exécutent dans le conteneur `php` déjà démarré quand la stack tourne, et dans un conteneur jetable sinon. Toutes les cibles disponibles sont dans `DataShare_API/Makefile`.

Les variables d'environnement sont dans `DataShare_API/.env` ; les secrets locaux (comme `JWT_PASSPHRASE`) vont dans `DataShare_API/.env.local`, non commité.

## Frontend (DataShare_Front)

Stack : React 19 + Vite + TypeScript, react-router, axios, react-hook-form + zod, Tailwind CSS v4. Le serveur de dev tourne lui aussi dans Docker.

### Démarrer

```bash
cd DataShare_Front
make init   # dépendances npm puis serveur de dev
```

- Application : http://localhost:5173
- L'API est appelée par le navigateur à l'adresse de `VITE_API_URL` (`DataShare_Front/.env`, `http://localhost:8080/api` par défaut). Une surcharge locale va dans `DataShare_Front/.env.local`, non commité.

Ensuite, `make up` et `make down` suffisent au quotidien.

### Tout démarrer depuis la racine

```bash
docker compose up -d   # back et front ensemble
docker compose down
```

Le `compose.yaml` racine inclut ceux des deux projets. Il reprend le nom de projet du back, et donc ses volumes (base, stockage) : la stack complète démarre sur les mêmes données que le back lancé seul. Ne pas lancer le front seul et la stack racine en même temps, le port 5173 étant commun.

### Tests et qualité

```bash
make test       # Vitest
make coverage   # Vitest avec couverture (seuil 70 %), rapport HTML dans coverage/
make lint       # oxlint et vérification du formatage (Prettier)
make format     # corrige le formatage
make build      # vérifie les types (tsc) puis construit le bundle
```

`node_modules` vit dans un volume Docker, séparé de celui de l'hôte (binaires natifs différents) : un `npm install` sur l'hôte ne sert qu'à l'IDE. Toutes les cibles sont dans `DataShare_Front/Makefile`.

### Organisation du code

```
src/
├── api/                client axios (URL de base, injection du JWT)
├── components/
│   ├── ui/             composants génériques des maquettes (Button, Input, Select, Callout, Switch)
│   └── layout/         gabarits de page, Header, Copyright
├── pages/              une page par écran
├── routes/             routes et URLs de l'application (paths.ts)
└── test/               configuration de Vitest
```

Les tokens de design et les règles d'usage des composants sont décrits dans le [guide de l'interface](docs/ui_guide.md), les choix techniques dans [tech_stack.md](docs/architectureDecisions/tech_stack.md).
