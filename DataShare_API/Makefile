.PHONY: init env install keys up down test lint lint-fix

init: env install keys ## Premiere installation

env: ## Cree .env.local s'il n'existe pas
	test -f .env.local || echo "JWT_PASSPHRASE=change-me" > .env.local

install: ## Installe les dependances PHP
	docker compose run --rm php composer install

keys: ## Genere les cles JWT
	docker compose run --rm php bin/console lexik:jwt:generate-keypair --no-interaction

up: ## Demarre l'application (API sur :8080, MinIO sur :9001)
	docker compose up -d

down: ## Arrete l'application
	docker compose down

test: ## Lance les tests (PHPUnit + couverture PCOV)
	docker compose run --rm -e APP_ENV=test php vendor/bin/phpunit

lint: ## Verifie le style (CS-Fixer) et l'analyse statique (PHPStan)
	docker compose run --rm php composer lint:cs
	docker compose run --rm php composer lint:phpstan

lint-fix: ## Corrige automatiquement le style de code
	docker compose run --rm php composer lint:cs:fix
