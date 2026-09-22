# Gestion des tags

**Statut** : accepté, 2026-09-22, ticket [#46](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/46)

L'US08 demande qu'un utilisateur connecté puisse organiser ses fichiers par tags, de 0 à N par fichier, en texte libre, d'au plus 30 caractères, sans doublon sur un même fichier, avec un filtrage de l'historique en option.

## Ce que l'US08 ajoute réellement

Moins qu'il n'y paraît, et pour la même raison que l'US07 : le modèle avait été posé d'avance. L'entité `Tag`, la table de jointure `file_tag` et la relation `ManyToMany` existent depuis la migration initiale. L'US01 pose déjà des tags à l'upload, en validant la longueur et l'unicité dans le fichier, et l'US05 filtre déjà l'historique par `?tag=`.

Ce qui manquait tenait en une phrase : une fois le fichier envoyé, plus personne ne pouvait toucher à ses tags. Le contrat d'API annonçait pourtant trois routes pour cela depuis sa rédaction, sans qu'aucune ligne ne les implémente.

Trois écarts secondaires ont été comblés au passage. La colonne `tag.name` était en `VARCHAR(255)` sans contrainte de validation, la règle des 30 caractères ne vivant que dans le DTO d'upload ; rien ne garantissait en base l'unicité du couple `(owner, name)`, pourtant supposée partout dans le code ; et aucun test ne couvrait la longueur maximale.

## Trois routes imbriquées sous le fichier

**Décision** : `POST /api/files/{id}/tags`, `PUT` et `DELETE /api/files/{id}/tags/{tag}`, opérations de la ressource `File` et non d'une ressource `Tag`.

Un tag n'a pas d'existence propre dans ce produit. Il n'a ni page, ni cycle de vie indépendant, ni même d'identifiant que le front manipulerait : il n'existe que par les fichiers qu'il porte, et disparaît avec le dernier d'entre eux. Les trois routes répondent d'ailleurs `{ id, tags }`, l'état du fichier après l'opération, et non la ressource créée ou modifiée.

`{tag}` est donc le nom du tag, encodé dans l'URL, et non un identifiant technique. C'est ce dont le front dispose, puisque `GET /api/files` lui renvoie une liste de chaînes. La conséquence est assumée : un nom contenant "/" n'est pas adressable par ces routes.

### Alternative évaluée

| Option | Raison de l'écarter |
|---|---|
| Exposer `Tag` en ressource, avec son CRUD et ses identifiants | Impose un second schéma OpenAPI et une forme de réponse différente de celle que le tableau de bord consomme déjà, pour une entité que le front ne manipule jamais autrement que par son nom. Obligerait aussi à reprendre le contrat d'API, que le front consomme. |

## Le provider Doctrine ne peut pas servir ces routes

C'est le point le moins évident du ticket, et celui qu'une relecture future casserait le plus silencieusement.

Le provider Doctrine par défaut lit les variables d'URI par décalage et non par nom : il dépile la liste au fur et à mesure. Sur `/files/3/tags/facture`, le lien portant `id` reçoit la valeur `facture`, que le transformateur d'entiers convertit ensuite en `0`. La requête part alors chercher un fichier d'identifiant zéro, sans la moindre erreur, et la route répond 404 pour une raison qui n'a rien à voir avec ce que le client a demandé.

S'ajoute un second problème, propre au `POST` : la lecture a bien lieu, mais un résultat nul n'est converti en 404 que pour les méthodes sûres. Un identifiant inconnu atteindrait donc l'expression de sécurité avec un objet nul, et l'appel à `object.getOwner()` partirait en 500 au lieu du 404 annoncé par le contrat.

**Décision** : un provider maison, `FileTagProvider`, partagé par les trois opérations. Quinze lignes règlent les deux problèmes à la fois, et surtout laissent `{tag}` intact dans les variables d'URI que reçoit le processeur, ce qui est tout l'intérêt de nommer un tag dans l'URL.

Le 404 "ce fichier n'existe pas" y est levé, mais pas le 404 "ce tag n'est pas sur ce fichier". Ce dernier vit dans les processeurs, et ce n'est pas un détail d'organisation : le provider s'exécute **avant** l'expression de sécurité. Un 404 levé là serait renvoyé à un utilisateur qui n'est pas propriétaire du fichier, et la différence entre 403 et 404 lui permettrait de sonder les tags des fichiers des autres.

## Le renommage ne renomme que sur ce fichier

**Décision** : `PUT /api/files/{id}/tags/{tag}` détache l'ancien tag du fichier et lui en rattache un autre. Les autres fichiers du compte qui portaient l'ancien nom ne changent pas.

L'URL désigne un fichier, la réponse décrit un fichier. Un appel qui modifierait au passage une douzaine d'autres fichiers, sans qu'aucun n'apparaisse dans la réponse, serait une surprise pour le client comme pour le relecteur.

La mise en oeuvre découle de la décision et mérite d'être dite explicitement, parce que le raccourci est tentant : **jamais `setName()` sur le tag**. Le tag est partagé par tous les fichiers du compte, le renommer en place les renommerait tous, et pourrait heurter l'index unique si le compte porte déjà le nom visé.

### Alternative évaluée

| Option | Raison de l'écarter |
|---|---|
| Renommer le tag pour tout le compte | Plus pratique pour corriger une faute de frappe, mais un appel sur un fichier modifierait des données que le client ne voyait pas, et la réponse n'en montrerait rien. Reste possible plus tard, sous une route qui dirait ce qu'elle fait, du genre `PUT /api/tags/{tag}`. |

## Un tag sans fichier est supprimé

**Décision** : dès qu'un tag ne porte plus aucun fichier, il est retiré de son propriétaire, ce qui suffit à le supprimer en base.

Le mécanisme existait déjà : `User::$tags` est une collection en `orphanRemoval`. Détacher le tag de cette collection programme sa suppression au flush, sans requête explicite ni service de nettoyage. L'ordre des opérations dans `File::detachTag()` est ce qui rend le test juste : retirer le fichier du tag initialise d'abord la collection inverse, si bien que le test "ne porte plus aucun fichier" lit un état en mémoire à jour, et non l'état en base d'avant la modification.

Un tag vide ne rend service à personne. Il ne ramènerait aucun résultat dans le filtre de l'historique, et polluerait la liste de suggestions le jour où le front en proposera une.

### Alternatives évaluées

| Option | Raison de l'écarter |
|---|---|
| Laisser les tags orphelins en base | La table accumule des lignes que rien n'atteint, qu'aucune route ne permet de supprimer, et qui referaient surface dans toute future autocomplétion. |
| Nettoyer périodiquement, comme la purge de l'US10 | Ajoute une commande et une planification pour une opération qui tient en deux lignes au bon endroit, et laisse entre deux passages des tags visibles mais vides. |

## La virgule sépare les tags à l'envoi

**Décision** : `POST /api/files` accepte les tags sous deux formes, un champ `tags` contenant une liste séparée par des virgules, ou un champ `tags[]` répété. Un nom de tag ne peut donc pas contenir de virgule.

Le problème n'est apparu qu'en essayant la route depuis sa propre documentation, et il était total : l'envoi répondait 400 quoi qu'on saisisse. PHP ne construit un tableau à partir d'un formulaire que si le champ s'appelle littéralement `tags[]`. Un champ `tags` répété est écrasé, seule la dernière valeur survit, et Swagger UI ne le répète même pas : il joint les valeurs par des virgules en un champ unique. La seule forme que l'API acceptait était donc précisément celle qu'aucun formulaire ordinaire ne produit.

Aucun réglage OpenAPI ne rattrape cela sans renommer le champ documenté en `tags[]`, ce qui aurait imposé d'écrire à la main le schéma des quatre champs de l'envoi et de le maintenir en parallèle du DTO. Découper sur la virgule coûte une ligne et rend le champ utilisable partout, y compris depuis la documentation.

La contrepartie est assumée : un tag ne peut plus contenir de virgule. C'est la restriction qu'imposent la plupart des systèmes de tags, pour cette raison exacte.

Le découpage vit dans le décodeur multipart, avec le retrait des espaces de bordure, et non plus loin dans la chaîne. C'est ce qui garantit que les deux formes d'envoi atteignent le contrôle de doublon et la résolution du tag à l'identique : sans cela, `facture` et ` facture` passeraient le contrôle de doublon puis se résoudraient vers le même nom, et heurteraient l'index unique en 500. C'est aussi ce qui aligne l'envoi sur `POST /api/files/{id}/tags`, qui nettoyait déjà les espaces de son côté.

Un segment vide, comme dans `facture,` ou `a,,b`, est ignoré. C'est un artefact du séparateur et non un tag soumis, et le décodeur appliquait déjà cette règle au champ facultatif laissé intact par le client.

### Alternatives évaluées

| Option | Raison de l'écarter |
|---|---|
| Documenter le champ `tags[]` et réécrire le corps multipart à la main | Ne change pas l'API et n'interdit rien dans un nom de tag, mais fige dans l'attribut OpenAPI un schéma de quatre champs qui duplique le DTO et dérivera de lui à la première évolution. |
| Accepter une chaîne et en faire un tag unique | Répond 201 en enregistrant un tag nommé "facture,client-x". Le client croit en avoir posé deux, l'API n'en dit rien : la même perte silencieuse que celle refusée pour les tags d'un envoi anonyme. |
| Ne rien changer et corriger le contrat d'API | Laisse une route dont la documentation intégrée ne peut pas fonctionner, ce que le premier essai du front aurait retrouvé. |

## Deux décisions de forme

**La réponse `{ id, tags }` passe par un groupe de sérialisation**, `file:tags`, posé sur l'identifiant et sur l'accesseur qui liste les noms, et non par un DTO de sortie. Le corps demandé est une projection de l'entité : les deux valeurs existent déjà, sous ces noms, dans les réponses des autres routes. Un DTO dupliquerait ce mappage et devrait être construit après l'écriture pour disposer de l'identifiant. Le DTO de sortie se justifie pour l'URL présignée de téléchargement, parce que la donnée renvoyée n'est pas le fichier ; ce n'est pas le cas ici.

**La validation se fait en deux temps.** Les règles de saisie, tag non vide et d'au plus 30 caractères, vivent dans le DTO d'entrée `TagInput`, où le pipeline les transforme en 422 sans une ligne de code. La règle "pas de doublon sur ce fichier" ne le peut pas : elle dépend des tags que porte déjà le fichier, que le DTO ne connaît pas. Elle est donc appliquée par les processeurs, qui lèvent l'exception de validation d'API Platform plutôt qu'une simple erreur HTTP, afin que la réponse contienne les mêmes `violations` que toutes les autres, avec `propertyPath` à `tag`.

### Alternative évaluée

| Option | Raison de l'écarter |
|---|---|
| Un validateur personnalisé, sur le modèle de `AuthenticatedOnly` | Il devrait lire le fichier dans un attribut interne de la requête posé par API Platform. `AuthenticatedOnly` s'appuie sur un service de premier rang ; coupler une contrainte de validation à un détail du pipeline HTTP la rendrait intestable sans requête et fragile à toute montée de version. |

## Points de vigilance

- **Deux requêtes concurrentes peuvent heurter l'index unique.** Poser le même tag neuf sur deux fichiers au même instant fait passer les deux résolutions avant la première écriture, et la seconde viole `UNIQ_TAG_OWNER_NAME`. La réponse est aujourd'hui un 500 ; le jour où le cas se présente, c'est un 409 qu'il faudra renvoyer, en rattrapant l'exception d'intégrité.
- **Une virgule dans un nom de tag le coupe en deux, sans avertissement.** C'est la contrepartie directe du séparateur, et elle n'est visible que dans la réponse, qui liste alors deux tags. Le front gagnerait à refuser la virgule dans son champ de saisie plutôt qu'à laisser la surprise arriver.
- **La casse distingue les tags.** "Facture" et "facture" sont deux tags, en base comme dans le filtre de l'historique. C'est cohérent avec le "texte libre" de la spécification, mais un utilisateur ne le comprendra pas forcément. Une normalisation est possible plus tard, elle imposera une migration de fusion.
- **Aucun plafond sur le nombre de tags par fichier.** La spécification dit "0 à N" et rien d'autre. Un client automatisé peut en poser des milliers, un par requête. À traiter avec la limitation de débit évoquée dans SECURITY.md ([#20](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/20)).
- **Il n'existe pas de renommage global.** Corriger une faute de frappe sur un tag porté par dix fichiers demande dix appels. C'est la contrepartie directe de la décision sur le renommage, à garder en tête si le front veut proposer une page de gestion des tags.
