# Image de developpement uniquement : le code est monte en volume pour le HMR,
# l'image ne contient que Node. L'image de production viendra avec le #23.
FROM node:22-slim

WORKDIR /srv/app

# node_modules vit dans un volume nomme, distinct de celui de l'hote : Vite,
# oxlint et Tailwind embarquent des binaires natifs propres a chaque systeme.
# Le dossier est cree ici pour que le volume herite du proprietaire "node" au
# lieu de root, sans quoi npm install echouerait.
RUN mkdir node_modules && chown node:node node_modules

# uid 1000, comme l'utilisateur habituel de l'hote : les fichiers ecrits dans
# le depot (package-lock.json) ne lui appartiennent pas en root.
USER node

EXPOSE 5173

CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0"]
