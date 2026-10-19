# Résultats bruts

Sorties des mesures, telles que les outils les ont produites. Aucune analyse ici : elle
revient à PERF.md, ticket
[#21](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/21). Ce fichier dit seulement
ce qui a été mesuré, quand, et sur quoi.

**Campagne du 2026-10-19**, ticket
[#79](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/79).

## Conditions

Stack complète en conteneurs sur un seul poste de développement : le client k6, l'API, la base
et le stockage objet se partagent la même machine et la même boucle réseau. Les chiffres
mesurent donc un comportement relatif entre paliers, pas une capacité de production.

| Brique | Version |
|---|---|
| k6 | 2.3.0 |
| Lighthouse | 13.5.0, Chrome 154 |
| PHP | 8.4.26, FPM |
| nginx | alpine, `client_max_body_size 1024M` |
| Stockage | SeaweedFS 4.47, passerelle S3 |

## Montée en charge, `POST /api/files`

Fichiers de tailles décimales, le contrat comptant 1 Go pour 1 000 000 000 octets.
Quatre paliers, tous réussis, aucun seuil k6 franchi.

| Palier | Envois simultanés | Envois | Médiane | Max | Débit émis |
|---|---|---|---|---|---|
| 10 Mo | 5 | 20 | 239 ms | 589 ms | 50 Mo/s |
| 100 Mo | 3 | 6 | 1,76 s | 10,84 s | 22 Mo/s |
| 500 Mo | 2 | 2 | 733 ms | 1 min 13 s | 13 Mo/s |
| 1 Go | 1 | 1 | 525 ms | 1 min 3 s | 14 Mo/s |

Les médianes des deux derniers paliers portent sur l'ensemble des requêtes du scénario,
inscription et nettoyage compris, et non sur les seuls envois : à une et deux itérations, elles
ne veulent rien dire. C'est la colonne "Max" qui donne la durée de l'envoi lui-même.

Détail complet par palier dans `load-<palier>.json` (résumé k6) et `load-<palier>.txt`.

### Limite rencontrée

Aucune limite serveur n'a été atteinte à 1 Go : l'envoi aboutit en 63 secondes. La limite
rencontrée est côté client de mesure, k6 construisant le corps multipart en mémoire, ce qui
plafonne le nombre d'envois simultanés que le poste peut émettre sur les gros paliers.

Deux écarts ont été trouvés en cours de mesure, tous deux liés à l'unité du gigaoctet :

- `Assert\File(maxSize: '1G')` compte en puissances de 1000, les suffixes de Symfony n'étant
  binaires que doublés d'un `i`. Un fichier de 1024³ octets est donc refusé en 422, et la
  première série de mesures, dont les fichiers étaient générés en binaire, butait sur un 413
  de nginx avant même d'atteindre PHP.
- Le front comptait, lui, en 1024³ (`MAX_FILE_SIZE`). Il acceptait donc 73 Mo de plus que le
  back : le formulaire validait, l'envoi durait une minute, puis échouait en 422. Corrigé sur
  ce ticket.

## Front

Build de production servi par `nginx:alpine`, compression gzip active. Les tailles sont donc
des tailles transférées. Trois passages par page, médiane retenue.

| Page | Performance | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|---|
| `/` | 97 | 100 | 100 | 82 |
| `/login` | 97 | 92 | 100 | 82 |
| `/register` | 96 | 92 | 100 | 82 |

Poids transféré sur `/`, et budget de `budget.json` :

| Type | Mesuré | Budget |
|---|---|---|
| script | 192,4 Kio | 200 Kio |
| police | 36,3 Kio | 80 Kio |
| feuille de style | 6,5 Kio | 10 Kio |
| document | 0,7 Kio | 5 Kio |
| **total** | **237,7 Kio** | 300 Kio |

Budget respecté sur les trois pages. À noter pour l'analyse : `vite build` avertit que le
chunk JS dépasse 500 Kio sur disque (532 Kio), l'application n'étant pas découpée en
plusieurs chunks.

Rapports complets dans `lighthouse/`, un HTML lisible par page.

## Métriques du back

Tirées des logs JSON du canal `metrics`, sur la fenêtre de la campagne.

| Route | Appels | Médiane | Max |
|---|---|---|---|
| `POST /api/files` | 29 | 275 ms | 72,7 s |
| `DELETE /api/files/{id}` | 29 | 65 ms | 7,2 s |
| `POST /api/register` | 4 | 587 ms | 1,3 s |
| `POST /api/login` | 4 | 648 ms | 732 ms |
| `GET /api/files` | 4 | 58 ms | 108 ms |

Écriture dans le stockage objet, mesurée autour du `writeStream()` seul :

| Taille | Écritures | Médiane | Débit |
|---|---|---|---|
| ~10 Mo | 20 | 140 ms | 67,9 Mio/s |
| ~100 Mo | 6 | 1,43 s | 66,6 Mio/s |
| ~500 Mo | 2 | 44,9 s | 10,6 Mio/s |
| ~1 Go | 1 | 37,8 s | 25,2 Mio/s |

Le débit d'écriture s'effondre entre 100 Mo et 500 Mo, d'un facteur six. C'est le fait saillant
de cette campagne, et le premier point à instruire dans PERF.md.

Sortie brute dans `metrics.txt`.
