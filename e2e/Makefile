.PHONY: install run open typecheck format format-check audit

# Les tests visent la stack complete : la demarrer d'abord depuis la racine
# du depot (docker compose up -d --wait). Le service e2e est defini ici et
# inclus par le compose.yaml racine.
export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

DC = docker compose --profile e2e run --rm --entrypoint

install: ## Installe les dependances npm, telles que fixees par package-lock.json
	$(DC) npm e2e ci

run: ## Lance les tests en headless (Electron)
	$(DC) cypress e2e run

open: ## Ouvre l'interface de Cypress (sur le poste, Node 20+ requis)
	npm install
	npx cypress open

typecheck: ## Verifie les types des specs
	$(DC) npx e2e tsc --noEmit

format: ## Formate les fichiers (Prettier)
	$(DC) npx e2e prettier --write .

format-check: ## Verifie le formatage
	$(DC) npx e2e prettier --check .

audit: ## Cherche les vulnerabilites connues des dependances npm
	$(DC) npm e2e audit
