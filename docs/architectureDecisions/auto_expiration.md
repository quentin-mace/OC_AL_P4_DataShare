# Expiration automatique des fichiers

**Statut** : accepté, 2026-09-21, ticket [#15](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/15)

Un fichier porte une durée de vie choisie à l'envoi, de un à sept jours, sept par défaut. L'US10 demande qu'une tâche planifiée purge chaque jour les fichiers arrivés à échéance.

## Ce que l'US10 ajoute réellement

L'expiration est déjà effective, et elle l'était avant ce ticket. La date est posée à l'upload et bornée côté serveur, le statut `active` ou `expired` est dérivé de cette date sans jamais être stocké, et `GET /api/downloads/{downloadToken}` répond 410 dès l'échéance passée, avec le même message qu'un token inexistant.

Autrement dit, le lien est déjà fermé et aucun accès ne dépend de la purge. Ce qui manque est la destruction des octets : sans elle, un fichier expiré reste stocké indéfiniment dans MinIO, sans qu'aucun parcours de l'application ne puisse plus le servir.

Cette distinction commande tout le reste de la décision. La purge répond à une question de stockage et de coût, pas de confidentialité, ce qui autorise une exécution quotidienne et rend une exécution manquée bénigne. Une purge dont dépendrait la fermeture des accès aurait exigé des garanties d'ordonnancement autrement coûteuses.

## Périmètre de la purge

**Décision** : l'objet stocké, et lui seul. La ligne d'historique est conservée.

La spécification demande "la suppression du fichier et des données associées". La lecture retenue est que les données du fichier sont détruites, ce qui reste étant la métadonnée d'historique : un nom, une taille, deux dates. Le tableau de bord continue de lister le fichier, avec la mention prévue par la maquette, "Ce fichier a expiré, il n'est plus stocké chez nous". L'écart avec la lettre de la spécification est assumé et documenté ici.

Ce comportement n'est pas un choix ouvert au moment où le ticket est traité, il est déjà inscrit dans trois endroits du projet. Le contrat d'API garantit que `GET /api/files` renvoie l'historique complet, fichiers expirés inclus, et que `status` est dérivé de `expiresAt`. Le processeur de suppression de l'US06 absorbe explicitement le cas d'un objet déjà retiré par la purge sur une ligne toujours présente. Un test fonctionnel de l'US06 couvre ce cas précis. Trancher dans l'autre sens reviendrait à reprendre le contrat d'API, la maquette du tableau de bord et ce test.

### Alternatives évaluées

| Option | Raison de l'écarter |
|---|---|
| Purge de la ligne en même temps que l'objet | Conforme à la lettre de la spécification, mais l'historique perdrait ses fichiers expirés, la mention prévue par la maquette deviendrait inatteignable et l'écran du tableau de bord se viderait tout seul au fil des jours. |
| Purge en deux temps, objet à l'échéance puis ligne après une rétention supplémentaire | Satisfait les deux lectures, au prix d'un second seuil à configurer, à tester et à expliquer. La question qu'il résout, la croissance de l'historique, ne se pose pas à l'échelle d'un prototype de démonstration. |

### Conséquences

- Les réponses décrites par `contrat-api.md` restent exactes, aucune route n'est à reprendre. Un seul de ses arguments est fragilisé, voir les points de vigilance.
- Le front continue de traiter un fichier `expired` comme listable mais non téléchargeable, sans traitement particulier pour un fichier purgé.
- La purge est invisible depuis l'API. C'est voulu : elle ne change aucune réponse.

## Déclenchement

**Décision** : une commande console, appelée par un cron système hébergé dans un conteneur dédié de la stack Docker.

Les trois options mises en balance par le ticket partagent le même dénominateur. Dans chacune, la logique de purge vit dans une commande console, seul endroit testable en isolation et seul endroit qu'un exploitant puisse déclencher à la main. Ce qui les distingue n'est donc pas la conception, mais le coût du déclencheur. Le critère d'arbitrage du #1 s'applique inchangé : la maîtrise préalable du stack prime sur l'intérêt technique, et tout temps d'apprentissage est pris sur les livrables.

Le cron système ne demande aucune dépendance nouvelle et aucun process PHP permanent. La stack Docker gagne un service qui réutilise l'image déjà construite, et l'entrée de crontab est versionnée dans le dépôt au même titre que le reste de la configuration.

### Alternatives évaluées

| Option | Raison de l'écarter |
|---|---|
| Symfony Scheduler | La meilleure option sur le papier, la planification étant déclarée en PHP, versionnée et testable. Mais elle tire `symfony/scheduler` et `symfony/messenger`, aucun des deux n'étant installé, et impose un worker permanent à superviser et à redémarrer, pour une tâche qui s'exécute une fois par jour. |
| Messenger seul | N'ordonnance rien, c'est un bus de messages. Sans Scheduler par-dessus, il ne répond pas au besoin. |
| Règle de cycle de vie MinIO | L'expiration S3 native s'exprime en jours depuis l'écriture de l'objet, alors que la durée de vie varie d'un fichier à l'autre. Elle exigerait un jeu de règles et un tag d'objet par durée, et ne laisserait aucune trace en base de ce qu'elle a supprimé. |
| Cron de la machine hôte | Aucun conteneur supplémentaire, mais la planification sort du dépôt pour devenir une étape d'installation manuelle de plus, à documenter et à refaire sur chaque environnement. |

### Conséquences

- Un service dédié dans `compose.yaml`, construit sur l'image PHP du projet, dont le seul rôle est de faire tourner le démon cron.
- Une cible dans le `Makefile` pour déclencher la purge à la main, nécessaire à la démonstration comme au rattrapage.
- La procédure d'exploitation, la fréquence et la conduite à tenir en cas de panne reviennent à `MAINTENANCE.md` (#22).

## Mise en oeuvre, à grands traits

La commande retrouve les fichiers dont la date d'expiration est passée et dont l'objet n'a pas encore été purgé, supprime l'objet dans le stockage, puis date la ligne correspondante.

L'ordre est celui de l'US06, et pour la même raison : l'objet part avant que la base ne soit touchée. Une panne entre les deux laisse une ligne dont l'objet a déjà disparu, cas que le service sait absorber et que la purge suivante corrigera. L'ordre inverse laisserait dans MinIO un objet que plus aucune ligne ne désigne, donc que rien ne pourrait plus réclamer.

Un échec sur un fichier n'interrompt pas le lot. Une clé absente n'est pas une erreur : l'API S3 répond sans broncher sur une clé inconnue, ce qui rend l'opération rejouable sans précaution.

La conservation de la ligne d'historique a une conséquence directe sur la requête. Sans marqueur, la sélection des fichiers expirés ramènerait chaque nuit tout l'historique expiré depuis l'ouverture du service, et le travail croîtrait sans borne. Une colonne dédiée, renseignée au moment de la purge, restreint la sélection aux seules lignes non encore traitées, ce qui ramène le travail d'une nuit ordinaire aux fichiers fraîchement expirés tout en rattrapant d'office ceux qu'une exécution manquée aurait laissés. Elle demande une migration et un index sur la date d'expiration, aujourd'hui absent. Elle apporte accessoirement mieux qu'une idempotence : la mention "il n'est plus stocké chez nous" devient un fait constaté et daté, et non plus une déduction faite à partir de l'heure qu'il est.

Les dates étant stockées en UTC, la planification doit raisonner dans le même repère. L'horaire visé est une heure creuse, la tâche n'ayant aucune contrainte de latence.

## Points de vigilance

- **Une purge manquée n'est pas un incident de sécurité.** Les liens expirés restent fermés indépendamment d'elle. Une nuit sautée se rattrape à l'exécution suivante sans intervention, puisque la sélection porte sur ce qui reste à purger et non sur ce qui a expiré depuis la veille.
- **Deux exécutions simultanées** ne se gênent pas au point de causer un dommage, la suppression d'un objet déjà supprimé étant sans effet. Le sujet ne justifie pas `symfony/lock`, non installé, à raison d'une exécution quotidienne.
- **Les objets écrits hors du cycle applicatif**, par les tests fonctionnels ou une manipulation directe, ne sont désignés par aucune ligne et échappent donc à la purge. Le nettoyage du bucket de test reste à la charge des tests eux-mêmes.
- **L'historique n'est borné par rien.** `contrat-api.md` avance que "le volume reste borné par les sept jours de rétention maximum" pour justifier une collection renvoyée entière et paginée côté client. La conservation des lignes retire cette borne : ce sont les octets qui vivent sept jours, pas les lignes, et l'historique d'un compte cumule tous ses envois. L'argument de la pagination client reste valable à l'échelle du prototype, mais il repose sur le volume réel et non sur la rétention.
- **La volumétrie** de la tâche et son temps d'exécution relèvent de `PERF.md` (#21), la couverture de la commande du #17.