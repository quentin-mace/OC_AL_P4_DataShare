# Performance

**Dernière campagne** : 2026-10-19, ticket [#79](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/79)

**Analyse et mesure de contrôle** : 2026-10-20, ticket [#21](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/21)

| Mesure | Verdict |
|---|---|
| Montée en charge de `POST /api/files` | 1 Go accepté en 63 s, aucune limite serveur atteinte |
| Budget de performance front | tenu sur les trois pages, le poste JS à 96 % de son seuil |
| Temps de réponse et taille des fichiers | journalisés par le back, agrégés par `make metrics` |

Les chiffres bruts et les conditions dans lesquelles ils ont été pris vivent dans
[perf/results/](../../perf/results/README.md). Ce document ne les répète que pour les
commenter, et s'arrête sur le seul fait qui demandait une enquête : le débit d'écriture
vers le stockage objet.

## Ce qu'on mesure, et pourquoi là

Trois mesures indépendantes, décrites avec leurs commandes dans
[perf/README.md](../../perf/README.md) :

| Quoi | Avec quoi |
|---|---|
| Montée en charge de `POST /api/files` | k6 |
| Budget de bundle et scores navigateur | Lighthouse, sur le build servi par nginx |
| Temps de réponse et taille des fichiers | logs JSON du back |

**L'endpoint critique est l'upload, et le choix n'est pas arbitraire.** Les deux sens du
transfert sont asymétriques par décision d'architecture, tracée dans
[tech_stack.md](../architectureDecisions/tech_stack.md) : le téléchargement part en direct
du stockage objet par une URL présignée, l'API ne faisant que la signer, tandis que
l'upload traverse l'application. Un fichier d'un gigaoctet passe donc par nginx, par PHP
et par la couche de stockage avant d'exister. C'est le seul endroit du service où la
taille des fichiers pèse sur le code, donc le seul qui méritait un test de charge.

Conséquence à garder en tête en lisant ce document : **le téléchargement n'est pas
mesuré**, parce qu'il ne traverse rien qui nous appartienne.

## Budget de performance front

Les seuils sont dans [perf/budget.json](../../perf/budget.json), en **tailles transférées**
et non en tailles sur disque : c'est le poids que l'utilisateur paie qui fait foi. Ils
visaient environ 20 % au-dessus du poids de départ, de quoi ajouter un écran sans alerte,
pas de quoi laisser passer une dépendance de trop. La marge réelle du poste script est plus
étroite que cela, pour une raison expliquée plus bas.

| Type | Mesuré sur `/` | Budget | Marge |
|---|---|---|---|
| script | 192,4 Kio | 200 Kio | 4 % |
| police | 36,3 Kio | 80 Kio | 55 % |
| feuille de style | 6,5 Kio | 10 Kio | 35 % |
| document | 0,7 Kio | 5 Kio | 86 % |
| **total** | **237,7 Kio** | 300 Kio | 21 % |

Le budget est tenu sur les trois pages, mais **la ligne qui compte est celle du script, à
96 % de son seuil**. Les trois autres ont de la marge pour des raisons qui ne se
reproduiront pas : les polices sont déjà compressées et n'augmenteront plus, le CSS de
Tailwind ne croît qu'à la marge, le document est un `index.html` vide. Toute dépendance
ajoutée ira dans le poste déjà saturé.

### Scores Lighthouse

Médiane de trois passages par page, sur le build de production servi par `nginx:alpine`.
Trois passages parce qu'un passage isolé varie de plus de trente points sur l'accueil, le
premier mesurant un cache froid.

| Page | Performance | Accessibilité | Bonnes pratiques | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | 97 | 100 | 100 | 82 | 2,10 s | 2,25 s | 55 ms | 0,003 |
| `/login` | 97 | 92 | 100 | 82 | 2,10 s | 2,25 s | 18 ms | 0,000 |
| `/register` | 96 | 92 | 100 | 82 | 2,10 s | 2,25 s | 108 ms | 0,001 |

**Le SEO à 82 tient à deux audits, et un seul est un vrai manque** : il n'y a pas de
`<meta name="description">`. Le second reproche un `robots.txt` invalide, qui est en
réalité le `index.html` renvoyé par le repli de React Router, la page n'existant pas. Les
deux se corrigent en deux fichiers, et le référencement compte peu pour un service dont les
pages utiles sont derrière un lien privé ou une session. Mais ce sont 18 points pour
quelques minutes.

**L'accessibilité à 92 sur les deux formulaires est le vrai défaut de ce tableau**,
l'accueil étant à 100. Un seul audit échoue, le contraste, et il échoue sur deux éléments
orangés communs aux deux pages : le lien sous le formulaire, à 2,87 pour 1 en `#e27f29` sur
blanc, et le bouton secondaire, à 3,67 pour 1 en `#ba681f` sur `#ffefe4`. Le seuil WCAG AA
est de 4,5 pour 1 à cette taille de texte. C'est une correction de jetons de couleur, à
traiter avec le [guide de l'interface](../ui_guide.md), et non un sujet de performance :
il est noté ici parce que c'est la mesure qui l'a trouvé.

Les scores de performance ne disent pas grand-chose ici : ils sont mesurés en local, sans
latence réseau. Ce sont les tailles transférées qui portent l'information, et elles, elles
se transposent.

### La compression est à son niveau le plus bas

Détail trouvé en vérifiant les chiffres. `vite build` estime le script à 168,4 kB
compressé, soit 164,5 Kio, mais Lighthouse en mesure 192,4 Kio. L'écart de 17 % n'est pas
une erreur : `perf/docker/nginx/front.conf` active `gzip` sans fixer `gzip_comp_level`,
donc nginx comprime **au niveau 1**, là où Vite estime au niveau par défaut de zlib.

Le budget est donc tenu dans le cas le plus défavorable, ce qui est la bonne façon de le
tenir. Il reste qu'environ 28 Kio sur le poste le plus contraint s'obtiennent en une ligne
de configuration, pour un coût CPU négligeable sur des fichiers servis une fois et mis en
cache.

**Cet écart explique aussi pourquoi la marge du poste script est si faible.** Le seuil de
200 Kio a été posé à partir de l'estimation de Vite, 168, en visant 20 % de marge comme
pour les autres postes. Mesuré contre ce qui transite réellement, il n'en laisse que 4 %.
Le budget n'est pas faux, il est simplement plus serré qu'il n'en a l'air, et c'est une
raison de plus de ne pas attendre pour découper le bundle.

## Montée en charge de `POST /api/files`

Quatre paliers, tailles décimales, le contrat comptant 1 Go pour 1 000 000 000 octets.
Tous réussis, aucun seuil k6 franchi.

| Palier | Envois simultanés | Envois | Médiane | Max | Débit émis |
|---|---|---|---|---|---|
| 10 Mo | 5 | 20 | 239 ms | 589 ms | 50 Mo/s |
| 100 Mo | 3 | 6 | 1,76 s | 10,84 s | 22 Mo/s |
| 500 Mo | 2 | 2 | 733 ms | 1 min 13 s | 13 Mo/s |
| 1 Go | 1 | 1 | 525 ms | 1 min 3 s | 14 Mo/s |

**Les médianes des deux derniers paliers ne veulent rien dire** et c'est important de le
dire plutôt que de les présenter comme des résultats : à une et deux itérations, elles
portent sur toutes les requêtes du scénario, inscription et nettoyage compris, dont les
envois sont minoritaires. C'est la colonne Max qui donne la durée de l'envoi.

### La limite atteinte

**Aucune limite serveur n'a été rencontrée.** Le fichier d'un gigaoctet est accepté, écrit
et confirmé en 63 secondes. La limite qui s'est manifestée est celle du poste de mesure :
k6 construit le corps multipart en mémoire, donc un envoi de 1 Go coûte autant de RAM au
client qu'au serveur, et c'est ce qui plafonne la concurrence des gros paliers, pas le
service.

Deux écarts ont été trouvés en cours de mesure, tous deux sur l'unité du gigaoctet :

- `Assert\File(maxSize: '1G')` compte en puissances de 1000, les suffixes de Symfony
  n'étant binaires que doublés d'un `i`. Les fixtures générées en 1024³ octets étaient donc
  refusées, et butaient sur un 413 de nginx avant d'atteindre PHP.
- **Le front comptait en 1024³ et le back en 1000³.** Le formulaire acceptait donc 73 Mo
  de plus que l'API : l'utilisateur voyait sa sélection validée, attendait une minute, et
  récoltait un 422. C'est le seul vrai bug que cette campagne a trouvé, et il a été corrigé
  sur le #79.

## Temps de réponse et taille des fichiers

Le back écrit une ligne JSON par requête sur le canal `metrics`, depuis
`src/EventListener/RequestMetricsListener.php` : route, méthode, statut, `duration_ms` et
`request_bytes`. `FileUploadProcessor` en ajoute une par objet stocké, avec la taille et le
temps passé dans le seul `writeStream()`. `make metrics` les agrège.

**La durée d'une requête démarre à `REQUEST_TIME_FLOAT`**, que PHP-FPM pose une fois le
corps reçu. Les chiffres ci-dessous sont donc du traitement serveur pur, transfert exclu,
et c'est voulu : le temps de transfert reste visible dans les chiffres de k6, et les deux
se lisent ensemble. Prendre l'un pour l'autre ferait conclure que l'upload d'un gigaoctet
coûte 275 ms.

| Route | Appels | Médiane | Max |
|---|---|---|---|
| `POST /api/files` | 29 | 275 ms | 72,7 s |
| `DELETE /api/files/{id}` | 29 | 65 ms | 7,2 s |
| `POST /api/register` | 4 | 587 ms | 1,3 s |
| `POST /api/login` | 4 | 648 ms | 732 ms |
| `GET /api/files` | 4 | 58 ms | 108 ms |

Rien à signaler sur les routes de lecture et d'authentification : `GET /api/files` à 58 ms
et la connexion à 648 ms, dont l'essentiel est le hachage du mot de passe, qui est lent par
construction.

Deux lignes méritent un mot. **Le maximum de `POST /api/files` à 72,7 secondes est du temps
PHP**, pas du transfert, puisque nginx a déjà reçu le corps entier quand le compteur
démarre. Et **le `DELETE` à 7,2 secondes au maximum** pour une médiane de 65 ms : la
suppression de l'objet dans le stockage se fait dans le fil de la requête, elle subit donc
la contention des écritures qui tournent en même temps. La mesure de contrôle le confirme,
le même `DELETE` ne dépassant pas 86 ms sur un poste au repos.

## Le débit d'écriture, enquête

La campagne du 19 laissait un fait sans explication :

| Taille | Écritures | Médiane | Débit |
|---|---|---|---|
| ~10 Mo | 20 | 140 ms | 67,9 Mio/s |
| ~100 Mo | 6 | 1,43 s | 66,6 Mio/s |
| ~500 Mo | 2 | 44,9 s | **10,6 Mio/s** |
| ~1 Go | 1 | 37,8 s | 25,2 Mio/s |

Le débit chute d'un facteur six entre 100 Mo et 500 Mo, puis remonte à 1 Go. Lu comme un
effet de la taille, c'est incohérent. Mais la taille n'est pas la seule variable qui change
d'un palier à l'autre : **le palier 500 Mo tourne à deux envois simultanés, celui de 1 Go à
un seul.**

### Mesure de contrôle

Le palier 500 Mo rejoué seul, poste au repos, d'abord à un envoi puis à deux. Même fichier,
même commande, seule la concurrence change.

| Envois simultanés | Durée d'écriture | Débit par écriture | `POST` vu du serveur |
|---|---|---|---|
| 1 | 2,98 s | **159,9 Mio/s** | 4,1 s |
| 2 | 33,0 s et 52,9 s | 14,5 et 9,0 Mio/s | 64,3 s et 83,9 s |

Le second essai retrouve le palier de la campagne : 42,9 s d'écriture médiane contre 44,9 s
le 19, soit 4 % d'écart sur la grandeur analysée, pour 1 min 26 s de scénario contre
1 min 13 s. La méthode est donc reproductible. Et le premier essai règle la question : **à
taille égale, un envoi seul écrit onze fois plus vite que l'un des deux envois
concurrents.** La taille du fichier n'était pas en cause.

Mieux, ce n'est pas un partage de capacité. Les deux écritures du second essai démarrent à
la même seconde et se recouvrent entièrement : 953 Mio en 52,9 s, soit **18 Mio/s agrégés
contre 159,9 à un seul envoi**. Deux écrivains ne se partagent pas un plafond, ils
l'effondrent d'un facteur neuf.

### Pourquoi

L'explication tient au chemin qu'un octet parcourt avant d'exister dans le stockage.
**Il est écrit trois fois sur le même disque :**

1. nginx met le corps de la requête dans `client_body_temp`, `DataShare_API/docker/nginx/default.conf`
   ne désactivant pas ce tampon, et il attend de l'avoir reçu en entier avant d'appeler PHP ;
2. PHP reconstitue le fichier temporaire d'upload à partir du corps multipart ;
3. `writeStream()` le relit et le stockage objet écrit l'objet.

À deux envois de 500 Mo, cela fait environ 3 Go d'écritures concurrentes sur le même
volume, pendant que le client k6 garde 1 Go de corps multipart en mémoire, le tout sur un
poste unique de 8 cœurs et 32 Go. Les paliers de 10 et 100 Mo, eux, tiennent dans le cache
de pages du système, qui rend la main avant que le disque ait réellement écrit : leurs
67 Mio/s sont un débit apparent.

**Ce que la mesure dit donc vraiment, c'est que les gros uploads concurrents saturent les
entrées-sorties bien avant de saturer le processeur ou le réseau.** La conclusion ne
dépend pas du poste : un serveur réel aurait un plafond plus haut, pas un comportement
différent, puisque c'est le nombre de copies qui est en cause.

La confirmation définitive demanderait un relevé d'entrées-sorties par périphérique
pendant la mesure, qui n'a pas été fait.

## Axes d'optimisation identifiés

### Upload par URL présignée

**C'est l'axe principal, et il découle directement de l'enquête ci-dessus.** Faire déposer
le fichier par le navigateur en direct dans le stockage objet, l'API ne signant qu'une URL
d'écriture, supprime les deux premières des trois copies. L'octet n'est plus écrit qu'une
fois, et PHP ne voit plus passer le moindre gigaoctet. C'est déjà la façon dont le
téléchargement fonctionne.

Le prix est connu et a été payé en connaissance de cause, il est tracé dans
[tech_stack.md](../architectureDecisions/tech_stack.md) : la transaction "objet écrit,
métadonnées enregistrées" cesse d'être atomique. Le cas "dépôt réussi, confirmation perdue"
apparaît, donc des objets orphelins dans le stockage que plus aucune ligne en base ne
réclame. Le reprendre suppose une réconciliation, qui n'est pas gratuite : parcourir
périodiquement le stockage, confronter chaque clé à la base, supprimer ce qui n'a pas été
confirmé au bout d'un délai. La purge des fichiers expirés décrite dans
[MAINTENANCE.md](MAINTENANCE.md) est le point d'accroche naturel.

L'arbitrage initial reste défendable pour un prototype. Il devient discutable dès que le
service doit tenir plusieurs gros envois en même temps, ce que cette campagne chiffre.

### Découpage du bundle front

Le JS est servi en un seul chunk de 532 ko sur disque, et `vite build` le signale, son seuil
d'alerte étant à 500 ko. Le budget est tenu, mais le poste script est à 96 % du sien, donc
la marge est consommée.
`React.lazy` sur les routes de l'espace authentifié, ou un `manualChunks` isolant les
dépendances, rendrait de la place sans rien changer au rendu.

### Deux réglages à coût quasi nul

- **`gzip_comp_level` sur le serveur qui sert le front**, voir plus haut : environ 28 Kio
  sur le poste le plus contraint.
- **Une méta description et un `robots.txt`**, pour les 18 points de SEO.

### Sortir la suppression de l'objet du fil de la requête

Le `DELETE` passe de 65 ms à 7,2 s quand le stockage est occupé. Confier la suppression de
l'objet à une file de messages rendrait la main immédiatement, la ligne en base étant la
seule chose que l'utilisateur voit disparaître. C'est le moins urgent de ces axes, aucun
scénario réel ne supprimant un fichier pendant que deux envois de 500 Mo tournent.

## Limites connues

- **Tout est mesuré sur un seul poste**, où le client k6, nginx, PHP, la base et le
  stockage objet se partagent la même machine, le même disque et la même boucle réseau. Les
  chiffres décrivent des comportements relatifs entre paliers, pas une capacité de
  production. Aucun ne doit être cité comme une performance du service.
- **La concurrence des paliers décroît quand la taille monte**, pour la raison dite plus
  haut. Les paliers ne sont donc pas comparables entre eux à variable unique, ce qui est
  précisément le piège dans lequel la lecture naïve du débit d'écriture tombait.
- **Le téléchargement n'est pas mesuré**, puisqu'il part en direct du stockage.
- **Lighthouse ne voit que les pages accessibles sans session**, `/`, `/login` et
  `/register`. L'espace personnel et la page de téléchargement demanderaient un jeu de
  données et un lien vivant.
- **Les scores de performance de Lighthouse sont mesurés sans latence réseau.** Les
  tailles transférées se transposent, les scores non.
- **Les logs de métriques vivent dans le conteneur `php`**, le temps de la session Docker.
  Une campagne se termine donc par `make metrics` avant tout `docker compose down`, qui les
  effacerait sans prévenir.
- **Aucune mesure n'est rejouée automatiquement.** Rien dans la CI ne vérifie le budget
  front ni ne compare les temps de réponse à la campagne précédente. Les seuils de
  `budget.json` ne protègent que celui qui pense à lancer `make front`.

## Voir aussi

- [perf/README.md](../../perf/README.md), l'outillage et les commandes
- [perf/results/](../../perf/results/README.md), les chiffres bruts et leurs conditions
- [tech_stack.md](../architectureDecisions/tech_stack.md), la décision sur le transit des fichiers
- [TESTING.md](TESTING.md), ce que les tests vérifient par ailleurs
- [SECURITY.md](SECURITY.md), les limites qui touchent aussi à la charge, dont l'upload anonyme non plafonné
- [MAINTENANCE.md](MAINTENANCE.md), la purge des fichiers expirés
