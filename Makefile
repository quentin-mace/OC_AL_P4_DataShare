.PHONY: up down audit audit-images html slides

# Point d'entree de la stack complete. Les cibles de developpement vivent dans
# les Makefile de chaque projet (DataShare_API, DataShare_Front, e2e, perf) ;
# on ne trouve ici que ce qui porte sur le depot entier.

# Images a scanner : celles que la stack tire telles quelles. L'image php est
# construite a partir de php:8.4-fpm, c'est donc sa base que l'on scanne.
IMAGES = postgres:16-alpine \
         nginx:alpine \
         chrislusf/seaweedfs:4.47 \
         amazon/aws-cli:2.37.4 \
         adminer:4-standalone \
         node:22-slim \
         php:8.4-fpm \
         cypress/included:16.1.1

up: ## Demarre back et front ensemble
	docker compose up -d

down: ## Arrete la stack complete
	docker compose down

audit: ## Cherche les vulnerabilites des dependances des quatre projets
	$(MAKE) -C DataShare_API audit
	$(MAKE) -C DataShare_Front audit
	$(MAKE) -C e2e audit
	$(MAKE) -C perf audit

audit-images: ## Scanne les images Docker avec Trivy (conteneurise, rien a installer)
	@for image in $(IMAGES); do \
		echo "==> $$image"; \
		docker run --rm \
			-v /var/run/docker.sock:/var/run/docker.sock \
			-v trivy_cache:/root/.cache/trivy \
			aquasec/trivy:latest image --scanners vuln --severity HIGH,CRITICAL \
			--timeout 20m "$$image" || exit 1; \
	done

html: ## Regenere docs/html/index.html depuis README.md (sur le poste, Node 20+)
	node docs/html/build.mjs

# L'image de Cypress est reutilisee pour son Chrome, comme le fait deja
# Lighthouse dans perf/ : elle est epinglee et scannee par audit-images, une
# image dediee ajouterait une brique a surveiller pour le meme resultat.
# L'utilisateur du poste plutot que root, sinon le PDF sort en lecture seule.
slides: ## Regenere le PDF du support de soutenance depuis docs/presentation/index.html
	docker run --rm \
		-u "$$(id -u):$$(id -g)" -e HOME=/tmp \
		-v "$$(pwd)/docs/presentation":/deck \
		--entrypoint google-chrome cypress/included:16.1.1 \
		--headless --no-sandbox --disable-gpu --hide-scrollbars \
		--window-size=1280,720 --no-pdf-header-footer --virtual-time-budget=8000 \
		--print-to-pdf=/deck/DataShare-soutenance.pdf file:///deck/index.html
