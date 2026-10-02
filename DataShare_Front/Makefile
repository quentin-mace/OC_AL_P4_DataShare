.PHONY: init install up down build lint format format-check test test-watch coverage

# Meme principe que le Makefile du back : reutilise le conteneur front s'il
# tourne, sinon en cree un jetable. Expansion tardive (=), reevaluee a chaque cible.
DC = $(shell docker compose ps --status running --services 2>/dev/null | grep -qx front && echo "docker compose exec" || echo "docker compose run --rm")

init: install up ## Premiere installation (dependances puis serveur de dev)

install: ## Installe les dependances npm
	$(DC) front npm install

up: ## Demarre le serveur de dev (http://localhost:5173)
	docker compose up -d

down: ## Arrete le serveur de dev
	docker compose down

build: ## Verifie les types puis construit le bundle de production
	$(DC) front npm run build

lint: ## Lint (oxlint) et verification du formatage (Prettier)
	$(DC) front npm run lint
	$(DC) front npm run format:check

format: ## Corrige le formatage
	$(DC) front npm run format

test: ## Lance les tests (Vitest)
	$(DC) front npm test

test-watch: ## Lance les tests en continu
	$(DC) front npm run test:watch

coverage: ## Lance les tests avec couverture (seuil 70 %)
	$(DC) front npm run test:coverage
