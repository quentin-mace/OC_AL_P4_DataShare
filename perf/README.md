# Mesures de performance

Outillage et résultats bruts des mesures de l'étape 5, ticket
[#79](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/79). L'analyse rédigée, elle,
vit dans PERF.md, au ticket [#21](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/21) :
ce dossier produit les chiffres, il ne les commente pas.

Trois mesures indépendantes :

| Quoi                                    | Avec quoi                   | Commande       |
| --------------------------------------- | --------------------------- | -------------- |
| Montée en charge de `POST /api/files`   | k6                          | `make load`    |
| Budget de bundle et scores navigateur   | Lighthouse, servi par nginx | `make front`   |
| Temps de réponse et taille des fichiers | logs JSON du back           | `make metrics` |

## Prérequis

La stack complète démarrée depuis la racine du dépôt (`make up`), et `jq` sur le poste pour
les deux synthèses. Tout le reste tourne en conteneur.

```bash
make install   # dependances npm de Lighthouse, une fois
```

## Montée en charge

Le fichier de 1 Go transite par l'API, l'upload ne passant pas par une URL présignée (voir
[tech_stack.md](../docs/architectureDecisions/tech_stack.md), "Transit des fichiers").
`POST /api/files` est donc le point où la limite se trouve, et le script `k6/upload.js` la
cherche par paliers.

```bash
make fixtures                                  # genere ~1,6 Go de fichiers de test
make load                                      # les quatre paliers a la suite
make load-step PAYLOAD=1G VUS=1 ITERATIONS=1   # un seul palier
```

| Palier | Envois simultanés | Envois par VU |
| ------ | ----------------- | ------------- |
| 10 Mo  | 5                 | 4             |
| 100 Mo | 3                 | 2             |
| 500 Mo | 2                 | 1             |
| 1 Go   | 1                 | 1             |

La concurrence baisse quand la taille monte, et ce n'est pas une précaution de confort : k6
construit le corps multipart en mémoire, donc un envoi de 1 Go coûte environ autant de RAM au
poste de mesure qu'au serveur. Pousser la concurrence sur les gros paliers mesurerait la
machine qui lance le test, pas celle qui le subit.

Chaque palier écrit `results/load-<palier>.json` (résumé k6) et `.txt` (sortie lisible). Un
palier qui dépasse ses seuils fait échouer sa commande sans interrompre les suivants : c'est
la limite recherchée, pas un incident.

Le script crée un compte jetable, l'utilise pour tous les envois, puis supprime ses fichiers.
Le compte lui-même reste en base, l'API n'ayant pas de route de suppression de compte ;
`make clean` s'en charge.

## Budget front et Lighthouse

```bash
make front           # build de production, puis trois passages par page
make front-summary   # rejoue la synthese sur les rapports deja produits
```

Le build est servi par un `nginx:alpine` sur `127.0.0.1:5174`, et non par le serveur de
développement Vite : celui-ci livre chaque module séparément et sans minification, ce qui
mesurerait autre chose que ce que l'utilisateur télécharge. La compression gzip est active,
comme elle le sera en déploiement, donc **les chiffres sont des tailles transférées** et non
les tailles sur disque qu'affiche `npm run build`.

Trois passages par page, dont la médiane est retenue : un passage isolé varie de plus de
trente points sur la page d'accueil, le premier mesurant un cache froid.

Les pages mesurées sont celles qu'on atteint sans session : `/`, `/login`, `/register`.
`/files` est derrière `RequireAuth` et `/download/:token` demande un lien vivant, aucune des
deux ne se mesure sans jeu de données.

`budget.json` fixe les seuils par type de ressource. Un dépassement fait échouer la commande
et nomme la ressource fautive.

## Logs et métriques du back

Le back écrit une ligne JSON par requête et une par objet stocké, sur le canal `metrics` de
Monolog, vers la sortie d'erreur du conteneur (voir
`DataShare_API/config/packages/monolog.yaml`).

```bash
make metrics             # agrege les 24 dernieres heures
SINCE=1h make metrics    # fenetre plus courte
```

Deux tableaux en sortie : temps de réponse médian et maximal par route, puis durée d'écriture
dans le stockage objet et débit effectif par taille de fichier.

Les logs vivent dans le conteneur `php`, le temps de la session Docker. Une campagne se
termine donc par `make metrics` **avant** tout `docker compose down`, qui les effacerait.

## Nettoyage

```bash
make clean   # supprime les fixtures et les comptes jetables laisses en base
```

Les rapports de `results/` sont volontairement versionnés : ils sont la matière première de
PERF.md.
