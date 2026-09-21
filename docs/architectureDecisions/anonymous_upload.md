# Upload anonyme

**Statut** : accepté, 2026-09-21, ticket [#26](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/26)

L'US07 demande qu'un visiteur sans compte puisse déposer un fichier et obtenir un lien de téléchargement, avec les mêmes règles que l'envoi authentifié de l'US01, mais sans rattachement à un utilisateur, sans historique et sans gestion du fichier.

## Ce que l'US07 ajoute réellement

Presque rien, et c'est le résultat d'un modèle posé à l'avance plutôt que d'une coïncidence. `File.owner` est nullable depuis la migration initiale, l'entité porte déjà la mention "null pour un envoi anonyme", et les deux routes qu'un fichier sans propriétaire pourrait mettre en danger sont sûres par construction.

`DELETE /api/files/{id}` est protégé par l'expression `object.getOwner() === user` : un propriétaire nul ne peut jamais être égal à un utilisateur authentifié, la route répond donc 403 sans qu'une seule ligne ait à traiter le cas. `GET /api/files` passe par un provider qui interroge le dépôt avec l'utilisateur connecté, un fichier sans propriétaire ne figure dans aucun résultat. Aucune migration n'est nécessaire.

Ce qui reste à faire tient donc en trois points : ouvrir la route, laisser le propriétaire à null, et décider du sort des tags.

## Une route plutôt que deux

**Décision** : `POST /api/files` accepte les deux cas, l'authentification y est facultative. Pas de route `/api/files/anonymous` dédiée.

Le contrat d'API l'annonce ainsi depuis sa rédaction, avant même que l'US01 soit implémentée. Les deux parcours partagent tout : les mêmes contrôles de saisie, le même stockage, le même jeton de téléchargement, la même expiration. La seule différence est la valeur d'un champ. Une seconde route dupliquerait le DTO d'entrée, le processeur et l'essentiel des tests pour exprimer cette différence.

La spécification écrit de son côté que l'upload anonyme est "accessible uniquement aux utilisateurs non authentifiés". L'écart est assumé : cette phrase décrit le parcours utilisateur, une page d'accueil publique proposant le dépôt sans inscription, et non une contrainte technique qui imposerait de refuser un envoi parce qu'il est authentifié. Un utilisateur connecté qui déposerait un fichier depuis cette page obtiendrait simplement le comportement de l'US01, plus utile pour lui puisqu'il retrouverait son fichier dans son historique.

### Alternative évaluée

| Option | Raison de l'écarter |
|---|---|
| Route dédiée `/api/files/anonymous`, la route existante restant authentifiée | Colle à la lettre de la spécification, mais duplique un processeur de soixante lignes, une seconde entrée OpenAPI et une douzaine de tests, pour une unique différence de comportement. Obligerait par ailleurs à reprendre le contrat d'API, que le front consomme déjà. |

## Pourquoi le 401 survit au retrait de la clause de sécurité

C'est le point le moins évident du ticket, et celui qu'une relecture future casserait le plus facilement.

Retirer `security: "is_granted('IS_AUTHENTICATED_FULLY')"` de l'opération n'ouvre pas la route à un jeton invalide. Le pare-feu `main` est déclaré `lazy`, ce qui ne signifie pas qu'il ignore l'authentification, mais qu'il la diffère tant que personne ne la réclame. Or l'authentificateur JWT annonce supporter toute requête portant un en-tête `Authorization`, et cette annonce est un booléen strict, jamais un "peut-être". Un jeton présent suffit donc à faire basculer le pare-feu en authentification immédiate, dès l'entrée de la requête, bien avant que le pipeline d'API Platform et ses expressions de sécurité aient leur mot à dire. Un jeton cassé ou expiré est rejeté là, en 401.

La paresse ne joue qu'en l'absence complète d'en-tête `Authorization`. Dans ce cas seul, aucun authentificateur ne se déclare, aucune règle de contrôle d'accès ne s'applique (`access_control` est vide, la protection étant faite opération par opération), et la requête atteint le processeur avec un utilisateur nul.

**Conséquence** : le 401 sur jeton invalide n'est plus garanti par l'opération mais par le pare-feu. Les deux tests fonctionnels correspondants en sont désormais les seuls gardiens, et portent chacun un commentaire qui le dit.

Un second effet, purement documentaire : sans exigence de sécurité déclarée, Swagger UI n'attacherait plus du tout le jeton saisi dans "Authorize" sur cette route. L'opération conserve donc un bloc OpenAPI qui déclare le schéma JWT **ou** l'absence d'authentification, forme prévue par la spécification OpenAPI pour une authentification facultative.

## Les tags sont refusés, pas ignorés

**Décision** : un envoi anonyme qui soumet des tags est rejeté en 422, avec une violation sur `tags`.

Un tag appartient à un compte : c'est ce qui le rend réutilisable d'un fichier à l'autre et ce qui permet de filtrer l'historique. Accepté sans compte, il serait un enregistrement sans propriétaire, que personne ne pourrait plus jamais retrouver ni réutiliser, et il faudrait pour cela relâcher une contrainte de non-nullité en base au profit d'une donnée morte.

Le refus est explicite plutôt que silencieux. Le contrôle vit dans une contrainte de validation dédiée, `AuthenticatedOnly`, portée par le champ concerné du DTO d'entrée : la violation sort dans le même format que toutes les autres, et surtout la validation s'exécute **avant** l'écriture dans le stockage. Un envoi refusé ne laisse aucun octet derrière lui.

### Alternatives évaluées

| Option | Raison de l'écarter |
|---|---|
| Accepter les tags et les jeter | Le client croit avoir taggué son fichier, l'API lui répond 201 avec une liste de tags vide sans rien expliquer. Une perte de données silencieuse est le pire des deux comportements. |
| Rendre `tag.owner` nullable pour accepter des tags anonymes | Crée des enregistrements que rien ne peut plus atteindre, ni par l'historique ni par le filtrage, et fragilise un invariant du modèle pour une fonctionnalité que l'US07 exclut explicitement. |
| Placer le contrôle dans le processeur | Techniquement possible, mais il faudrait construire la liste de violations à la main alors que le pipeline de validation le fait dix lignes plus tôt, et le fichier serait déjà écrit dans le stockage au moment du refus. |

## Points de vigilance

- **Écriture sans compte et sans limite de débit.** N'importe qui peut désormais remplir le stockage, un gigaoctet à la fois, sans jamais s'authentifier. Le composant de limitation de débit est déjà installé mais ne sert aujourd'hui qu'aux tentatives de connexion. Une limite par adresse IP sur cette route est le premier sujet à traiter dans SECURITY.md ([#20](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/20)).
- **Un fichier anonyme est ineffaçable par son déposant.** C'est la conséquence directe de "pas de gestion du fichier" : personne ne peut le supprimer avant son terme, et la purge automatique de l'US10 est le seul mécanisme qui le retire. Un envoi par erreur reste donc accessible à qui détient le lien jusqu'à sept jours.
- **Le mot de passe de partage reste disponible.** C'est le seul contrôle d'accès dont dispose un déposant anonyme, et le seul recours face au point précédent.
