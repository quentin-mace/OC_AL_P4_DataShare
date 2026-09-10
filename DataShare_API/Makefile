.PHONY: init env install keys migrate migration schema up down test-db test lint lint-fix cs-fixer phpstan qa

# Prefixe pour executer une commande dans le conteneur php : reutilise le
# conteneur en cours si la stack est demarree, sinon en cree un jetable. Les
# cibles fonctionnent donc dans les deux cas, sans relancer minio-init a chaque
# fois quand l'application tourne deja. Variable a expansion tardive (=), donc
# reevaluee a chaque cible : dans "make init", "install" passe par run et
# "migrate", execute apres "up", passe par exec.
DC = $(shell docker compose ps --status running --services 2>/dev/null | grep -qx php && echo "docker compose exec" || echo "docker compose run --rm")

init: env install keys up migrate ## Premiere installation (application demarree, base a jour)

env: ## Cree .env.local s'il n'existe pas
	test -f .env.local || echo "JWT_PASSPHRASE=change-me" > .env.local

install: ## Installe les dependances PHP
	$(DC) php composer install

keys: ## Genere les cles JWT
	$(DC) php bin/console lexik:jwt:generate-keypair --no-interaction

migrate: ## Joue les migrations en attente (make migrate ARGS="first" pour tout annuler)
	$(DC) php bin/console doctrine:migrations:migrate $(ARGS) --no-interaction

migration: ## Genere une migration depuis les entites
	$(DC) php bin/console make:migration

schema: ## Verifie que les entites et le schema de la base concordent
	$(DC) php bin/console doctrine:schema:validate

up: ## Demarre l'application (API sur :8080, MinIO sur :9001)
	docker compose up -d

down: ## Arrete l'application
	docker compose down

test-db: ## Cree la base de test et y joue les migrations
	$(DC) -e APP_ENV=test php bin/console doctrine:database:create --if-not-exists --no-interaction
	$(DC) -e APP_ENV=test php bin/console doctrine:migrations:migrate --no-interaction

test: test-db ## Lance les tests (PHPUnit + couverture PCOV)
	$(DC) -e APP_ENV=test php vendor/bin/phpunit

lint: ## Verifie le style (CS-Fixer) et l'analyse statique (PHPStan)
	$(DC) php composer lint:cs
	$(DC) php composer lint:phpstan

lint-fix: ## Corrige automatiquement le style de code
	$(DC) php composer lint:cs:fix

cs-fixer: ## Lance CS-Fixer seul (make cs-fixer ARGS="--dry-run --diff")
	$(DC) php vendor/bin/php-cs-fixer fix $(ARGS)

phpstan: ## Lance PHPStan seul (make phpstan ARGS="--level=max")
	$(DC) php vendor/bin/phpstan analyse $(ARGS)

qa: ## Corrige le style puis lance PHPStan (CS_ARGS et PHPSTAN_ARGS separes)
	$(MAKE) cs-fixer ARGS="$(CS_ARGS)"
	$(MAKE) phpstan ARGS="$(PHPSTAN_ARGS)"