.PHONY: install fixtures load load-step front front-summary metrics clean audit format format-check

# Les mesures visent la stack complete : la demarrer d'abord depuis la racine
# du depot (docker compose up -d). Les services k6 et lighthouse sont definis
# ici et inclus par le compose.yaml racine, sous le profil perf.
export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

DC = docker compose --profile perf run --rm
# Le compose de la racine porte le nom de projet "datashare_api" : c'est par
# lui qu'on joint la base de l'application, que ce Makefile ne declare pas.
APP = docker compose -f ../compose.yaml

# Paliers du test de charge : taille du fichier, nombre d'envois simultanes
# (VUS) et nombre d'envois par VU. La concurrence descend quand la taille
# monte, k6 gardant le corps de la requete en memoire.
#
# Suffixes decimaux (MB, GB) et non binaires (M, G) : Assert\File(maxSize:
# '1G') de Symfony compte en puissances de 1000, le dernier palier vise donc
# exactement la limite du contrat, 1 000 000 000 octets.
STEPS = 10MB:5:4 100MB:3:2 500MB:2:1 1GB:1:1

install: ## Installe les dependances npm (Lighthouse)
	$(DC) --entrypoint npm lighthouse ci

fixtures: ## Genere les fichiers de test (environ 1,6 Go, une seule fois)
	@mkdir -p fixtures
	@for step in $(STEPS); do \
		size=$${step%%:*}; \
		target="fixtures/payload-$$size.bin"; \
		if [ -f "$$target" ]; then \
			echo "==> $$target deja present"; \
		else \
			echo "==> $$target"; \
			head -c "$$size" /dev/urandom > "$$target"; \
		fi; \
	done

load: fixtures ## Lance les quatre paliers de charge sur POST /api/files
	@mkdir -p results
	@for step in $(STEPS); do \
		size=$${step%%:*}; rest=$${step#*:}; vus=$${rest%%:*}; iterations=$${rest##*:}; \
		echo "==> palier $$size, $$vus envois simultanes"; \
		$(MAKE) load-step PAYLOAD=$$size VUS=$$vus ITERATIONS=$$iterations || true; \
	done
	@echo "Resultats dans results/, metriques du back par 'make metrics'."

# Un palier isole, pour rejouer celui qui a atteint la limite sans refaire les
# autres. Le seuil k6 fait echouer la cible, d'ou le "|| true" de la boucle
# ci-dessus : on veut les quatre paliers meme quand l'un d'eux casse.
load-step: ## Lance un seul palier (make load-step PAYLOAD=1GB VUS=1 ITERATIONS=1)
	@mkdir -p results
	$(DC) k6 run \
		--env PAYLOAD=$(PAYLOAD) --env VUS=$(VUS) --env ITERATIONS=$(ITERATIONS) \
		--summary-export results/load-$(PAYLOAD).json \
		k6/upload.js 2>&1 | tee results/load-$(PAYLOAD).txt

front: ## Build de production du front, puis mesures Lighthouse
	$(MAKE) -C ../DataShare_Front build
	./bin/lighthouse.sh

front-summary: ## Rejoue la synthese sur les rapports Lighthouse deja produits
	./bin/lighthouse-summary.sh

metrics: ## Agrege les logs structures du back produits pendant les mesures
	@mkdir -p results
	./bin/metrics.sh | tee results/metrics.txt

clean: ## Supprime les fixtures et les comptes jetables laisses en base
	rm -rf fixtures
	$(APP) exec -T database psql -U app -d app \
		-c "DELETE FROM \"user\" WHERE email LIKE 'perf-%@datashare.test'"

audit: ## Cherche les vulnerabilites connues des dependances npm
	$(DC) --entrypoint npm lighthouse audit

format: ## Formate les fichiers (Prettier)
	$(DC) --entrypoint npx lighthouse prettier --write .

format-check: ## Verifie le formatage
	$(DC) --entrypoint npx lighthouse prettier --check .
