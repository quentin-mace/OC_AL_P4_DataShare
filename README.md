# OC_AL_P4_DataShare
Meta projet pour piloter le développement du projet "Data Share" pour le cours "Pilotez le développement d'une application full-stack complète" de la formation Architecte Logiciel d'OpenClassrooms

## Backend (DataShare_API)

Stack : Symfony 8 + API Platform, PostgreSQL, MinIO (S3). Tout tourne via Docker, seul Docker Compose est nécessaire en local.

### Démarrer

```bash
cd DataShare_API
make init   # dépendances, clés JWT, démarrage de la stack et migrations
```

- API : http://localhost:8080 (doc interactive sur `/api`)
- Console MinIO : http://localhost:9001 (`minioadmin` / voir `.env`)

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
make test
make lint   # CS-Fixer et PHPStan, sans rien modifier
make qa     # corrige le style puis lance PHPStan
```

Les commandes s'exécutent dans le conteneur `php` déjà démarré quand la stack tourne, et dans un conteneur jetable sinon. Toutes les cibles disponibles sont dans `DataShare_API/Makefile`.

Les variables d'environnement sont dans `DataShare_API/.env` ; les secrets locaux (comme `JWT_PASSPHRASE`) vont dans `DataShare_API/.env.local`, non commité.