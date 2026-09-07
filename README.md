# OC_AL_P4_DataShare
Meta projet pour piloter le développement du projet "Data Share" pour le cours "Pilotez le développement d'une application full-stack complète" de la formation Architecte Logiciel d'OpenClassrooms

## Backend (DataShare_API)

Stack : Symfony 8 + API Platform, PostgreSQL, MinIO (S3). Tout tourne via Docker, seul Docker Compose est necessaire en local.

### Demarrer

```bash
cd DataShare_API
make init   # premiere installation (dependances + cles JWT)
make up     # demarre l'application
```

- API : http://localhost:8080 (doc interactive sur `/api`)
- Console MinIO : http://localhost:9001 (`minioadmin` / voir `.env`)

### Tests et lint

```bash
make test
make lint
```

Toutes les commandes disponibles sont dans `DataShare_API/Makefile`. Les variables d'environnement sont dans `DataShare_API/.env` ; les secrets locaux (comme `JWT_PASSPHRASE`) vont dans `DataShare_API/.env.local`, non commite.
