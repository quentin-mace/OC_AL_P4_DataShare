# Maintenance

**Dernière revue** : 2026-10-19, ticket [#22](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/22)

Deux gestionnaires de paquets, trois jeux de dépendances et huit images Docker. Ce document dit quoi mettre à
jour, à quelle fréquence, comment, et ce qui peut mal se passer.

## Ce qu'on maintient

| Périmètre | Gestionnaire | Version en place |
|---|---|---|
| API | Composer | PHP 8.4, Symfony 8.1, API Platform 4.3, Doctrine ORM 3.6 |
| Front | npm | Node 22, React 19, Vite 8, TypeScript 6, Tailwind 4 |
| Tests de bout en bout | npm | Cypress 16 |
| Base de données | image Docker | `postgres:16-alpine` |
| Stockage S3 | image Docker | `chrislusf/seaweedfs:4.47` |
| Serveur web | image Docker | `nginx:alpine` |
| Outils | images Docker | `adminer:4-standalone`, `amazon/aws-cli:2.37.4` |

## Politique de versions

**Le fichier de verrouillage fait foi.** `composer.lock` et les deux `package-lock.json` sont versionnés. Une
installation reproduit exactement les versions d'une autre, et c'est la relecture de leur diff qui fait la
revue d'une mise à jour.

**Les images portent un tag explicite.** Le tag `latest` est écarté : il ne nomme aucune version, donc rien
n'est reproductible, et il change sous les pieds sans prévenir. Cette règle vient de l'ADR du ticket
[#8](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/8).

**Deux images y dérogent aujourd'hui**, `nginx:alpine` et le `composer:2` du Dockerfile PHP. Les deux ne
nomment qu'une majeure. C'est une dette identifiée, sans conséquence tant que la stack est locale, à reprendre
avant tout déploiement.

**Les dépendances de bout en bout sont épinglées sans accent circonflexe**, et `make install` y fait
volontairement `npm ci` et non `npm install` : un Cypress qui change de version sans qu'on l'ait demandé rend
les échecs de tests illisibles.

**Composer relève ses contraintes tout seul.** `bump-after-update` est activé : après un `composer update`,
`composer.json` est réécrit pour pointer les versions installées. Le voir changer dans un diff est normal.

## Fréquence

| Quand | Quoi |
|---|---|
| Chaque semaine | `make audit` et lecture des avis |
| Chaque mois | montées de correctif et mineures, sur une branche dédiée |
| Chaque trimestre | montées majeures, une à la fois, avec son propre ticket |
| Sans délai | toute vulnérabilité HIGH ou CRITICAL atteignable depuis l'extérieur |
| À chaque montée majeure de l'un des deux langages | relecture des images Docker |

Le mot important est "atteignable". La revue de sécurité du
[#20](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/20) montre le raisonnement : sur deux avis
Composer, un seul était accessible à un client distant. Les deux ont été corrigés parce que la correction ne
coûtait rien, mais c'est le premier qui imposait un délai.

## Mettre à jour les dépendances PHP

```bash
cd DataShare_API
make audit                                               # 1. savoir ce qui est vulnerable
docker compose run --rm php composer outdated --direct   # 2. voir ce qui a bouge
docker compose run --rm php composer update "symfony/*" --with-dependencies   # 3. monter un lot
```

Ne pas lancer un `composer update` nu : il monte tout en une fois, et le moindre problème devient impossible
à attribuer. Monter par famille, `symfony/*`, `doctrine/*`, `api-platform/*`.

Ensuite, dans cet ordre :

1. **Relire le diff de `composer.lock`.** Chercher les montées de majeure, qui n'ont rien à faire dans une
   mise à jour de routine.
2. `make lint`, pour que PHPStan voie les signatures qui ont changé.
3. `make test`, et `make coverage` si la mise à jour touche le noyau.
4. **Vider le cache de test** si des tests fonctionnels échouent sans raison apparente :
   `docker compose run --rm -e APP_ENV=test php bin/console cache:clear`.
5. `make audit` de nouveau, pour vérifier que les avis ont bien disparu.
6. Pousser, et laisser la CI rejouer l'ensemble sur une machine propre.

## Mettre à jour les dépendances npm

```bash
cd DataShare_Front
make audit
docker compose run --rm front npm outdated
docker compose run --rm front npm update        # correctifs et mineures, dans les plages declarees
```

Pour une majeure, modifier la plage dans `package.json` puis relancer `make install`, une dépendance à la
fois.

Puis `make lint`, `make test`, `make coverage` et `make build`. Le build compte autant que les tests : c'est
lui qui lance `tsc -b`, donc le seul endroit où une rupture de typage se voit.

Le projet `e2e/` suit la même procédure, avec `make install` qui respecte strictement le lock. Après toute
montée de Cypress, relancer `make run` sur la stack complète avant de pousser.

## Mettre à jour une image Docker

1. Changer le tag dans le `compose.yaml` concerné, ou dans le Dockerfile pour les images de base.
2. `docker compose build --pull` puis `docker compose up -d` depuis la racine.
3. Vérifier que les migrations passent et que l'application répond.
4. Rejouer les tests de bout en bout, seuls à traverser toute la chaîne.
5. `make audit-images` pour comparer le nombre d'avis avant et après.

Une montée majeure de `postgres` demande en plus une migration des données du volume : l'image refuse de
démarrer sur un répertoire initialisé par une version antérieure. Prévoir un `pg_dump` avant, et un ticket
dédié.

## Le précédent à connaître

Le stockage objet a changé d'implémentation en cours de projet, et l'histoire vaut procédure.

MinIO était le choix initial. L'arrêt de publication de son édition communautaire avait été repéré dès le
ticket [#8](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/8), avec un coût de sortie évalué :
l'application s'adresse à Flysystem, pas à MinIO. En octobre 2026, les images déjà publiées ont à leur tour
été retirées des registres. **C'est la CI qui l'a détecté**, pas un développeur : dernier build vert le
2026-09-23, premier échec le 2026-09-28, sur un simple `unauthorized` au pull de l'image. Les postes qui
avaient l'image en cache ne voyaient rien.

SeaweedFS l'a remplacé au ticket [#65](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/65), sans
qu'une ligne de code applicatif bouge. LocalStack, envisagé d'abord, a été écarté après essai : son édition
communautaire a disparu elle aussi.

Trois leçons en sortent, applicables au reste :

- **Une dépendance d'infrastructure meurt par sa licence avant de mourir par sa technique.** Surveiller les
  annonces de modèle économique autant que les CVE.
- **La CI est le détecteur.** Elle part d'un cache vide à chaque exécution, contrairement aux postes. Une CI
  qui ne tourne plus faute de changement dans son périmètre ne détecte plus rien non plus.
- **Nommer un service par son rôle, pas par son implémentation.** Le service s'appelle `storage`, et c'est
  pour cela que le remplacement a tenu dans un `compose.yaml` et deux variables d'environnement.

## Exploitation courante

### Migrations de base de données

Les migrations sont la source unique du schéma. `doctrine:schema:update` n'est pas utilisé pour faire évoluer
la base.

```bash
cd DataShare_API
make migrate                  # joue les migrations en attente
make migration                # genere une migration depuis les entites
make schema                   # verifie que les entites et la base concordent
make migrate ARGS="first"     # annule tout, pour tester le retour en arriere
```

Après avoir modifié une entité : générer la migration, **la relire**, la jouer, puis tester le retour en
arrière. Tant que la branche n'est pas fusionnée, régénérer la migration existante plutôt que d'en empiler une
seconde.

### Purge des fichiers expirés

**Elle n'est pas implémentée.** La décision est prise et documentée dans
[auto_expiration.md](../architectureDecisions/auto_expiration.md), ticket
[#15](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/15) : une commande console appelée par un cron
conteneurisé, qui supprime l'objet stocké et date la ligne. Le code correspondant n'existe pas : ni
`src/Command/`, ni service cron, ni colonne de purge.

Conséquence réelle, et elle est bénigne : **les octets des fichiers expirés restent dans le stockage
indéfiniment**. L'accès, lui, est déjà fermé, puisque le statut se déduit de la date d'expiration et que la
route de téléchargement répond 410 dès l'échéance. Ce n'est donc pas un incident de sécurité mais une
croissance de stockage, qui ne se voit pas à l'échelle d'un prototype.

Quand la commande existera, sa procédure d'exploitation prendra place ici : horaire en heure creuse, UTC,
rattrapage automatique d'une exécution manquée, et relance manuelle pour la démonstration.

## Quand ça casse

**Un conteneur ne démarre pas.** `docker compose logs <service>` depuis la racine. L'ordre compte : la base et
le stockage avant l'API, l'API avant le front.

**Une mise à jour a cassé quelque chose.** Le lock est la sauvegarde. `git checkout main -- composer.lock`
puis `make install` ramène l'état d'avant, à l'identique. Même chose avec `package-lock.json` et
`make install` côté front.

**Une migration échoue à mi-chemin.** `make migrate ARGS="prev"` revient d'un cran, à condition que la
migration ait un `down()` qui fonctionne : c'est la raison du test de retour en arrière avant de pousser.

**Des tests échouent en local alors que la CI est verte.** Vider le cache Symfony avant toute autre
hypothèse, surtout après un changement de groupe de sérialisation ou d'attribut. Celui de test et celui de
développement sont distincts, et les tests de bout en bout dépendent du second.

**Une réponse d'API a perdu un champ, sans que rien n'ait changé.** Même cause, cache de développement
obsolète : `docker compose exec php bin/console cache:clear`.

**Le front ne voit pas une dépendance installée.** `node_modules` vit dans un volume Docker, distinct de
celui de l'hôte. Un `npm install` lancé sur le poste ne sert qu'à l'IDE ; c'est `make install` qui peuple le
volume.

**Le stockage S3 est inspectable à l'AWS CLI**, SeaweedFS n'ayant pas de console web, contrairement à MinIO.

## Voir aussi

- [SECURITY.md](SECURITY.md), les audits et ce qu'ils ont donné
- [TESTING.md](TESTING.md), ce qu'il faut rejouer après une mise à jour
- [tech_stack.md](../architectureDecisions/tech_stack.md), le choix des briques et leur historique
