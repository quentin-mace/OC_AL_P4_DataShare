# Contrat d'API

Contrat d'interface front/back pour le MVP. Réponses en JSON simple (voir tech_stack.md), pas d'enveloppe de pagination.

## Authentification

| Méthode | Route | US | Auth | Corps de la requête | Réponse |
|---|---|---|---|---|---|
| POST | /api/register | US03 | non | `{ email, plainPassword, firstName, lastName }` | 201 `{ id, email, firstName, lastName }` |
| POST | /api/login | US04 | non | `{ email, password }` | 200 `{ token }` (JWT) |

Le mot de passe est soumis dans `plainPassword` à l'inscription : il n'est ni stocké ni renvoyé, seul son condensé l'est. Il doit faire au moins 16 caractères et atteindre un score de robustesse moyen.

Le token JWT est ensuite transmis dans l'en-tête `Authorization: Bearer <token>` sur les routes qui le requièrent. Il vaut une heure et ne peut pas être révoqué avant son expiration, d'où cette durée courte.

Un mot de passe faux et une adresse inconnue renvoient le même 401, au mot près, afin de ne pas révéler quels comptes existent. Un corps de requête mal formé ou incomplet renvoie 400.

Au-delà de cinq échecs en quinze minutes, la connexion renvoie 429 pour ce compte, y compris si le bon mot de passe est finalement présenté. Un second compteur, cinq fois plus large, s'applique par adresse IP.

## Fichiers

| Méthode | Route | US | Auth | Corps de la requête | Réponse |
|---|---|---|---|---|---|
| POST | /api/files | US01, US07, US09 | optionnelle (connecté ou anonyme) | multipart/form-data : `file`, `expiresInDays?` (1 à 7, défaut 7), `password?` (min 6 car.), `tags?` (string[]) | 201 `{ id, name, size, mimeType, downloadToken, expiresAt, hasPassword, tags }` |
| GET | /api/files | US05 | requise | query `tag?` (filtrage facultatif) | 200 `[{ id, name, size, sentAt, expiresAt, status, hasPassword, downloadToken, tags }]` |
| DELETE | /api/files/{id} | US06 | requise, propriétaire uniquement | aucun | 204 |

`downloadToken` est l'identifiant non prédictible utilisé dans le lien de téléchargement partagé.

`POST /api/files` accepte un envoi sans en-tête `Authorization` (US07). Le fichier n'appartient alors à aucun compte : il n'apparaît dans aucun historique, ne peut pas être supprimé, et son lien de téléchargement est le seul moyen d'y accéder jusqu'à l'expiration. Les `tags` y sont refusés (422 sur `tags`), un tag appartenant à un compte. Facultative ne veut pas dire ignorée : un `Authorization` présent mais invalide ou expiré renvoie 401, il n'est jamais traité comme un envoi anonyme.

`GET /api/files` ne renvoie que les fichiers du compte connecté, y compris ceux dont le lien a expiré : la maquette du tableau de bord les affiche avec la mention "Ce fichier a expiré, il n'est plus stocké chez nous". `status` vaut `active` ou `expired`, valeur dérivée de `expiresAt` et non stockée en base.

`hasPassword` et `downloadToken` ne figuraient pas dans la version initiale de ce contrat. Ils ont été ajoutés pour que le tableau de bord affiche le cadenas et le bouton "Accéder" sans un second appel par fichier.

La collection est triée par `sentAt` décroissant et renvoyée entière, sans enveloppe (voir tech_stack.md). La pagination par dix, comme les filtres Tous / Actifs / Expiré, s'applique côté client sur la liste déjà chargée, sans rechargement. Le volume reste borné par les sept jours de rétention maximum. Si l'historique devait un jour dépasser quelques centaines de lignes, la reprise consisterait à ajouter `page` et `status` en paramètres de requête, sans changer la forme de la réponse.

## Tags

| Méthode | Route | US | Auth | Corps de la requête | Réponse |
|---|---|---|---|---|---|
| POST | /api/files/{id}/tags | US08 | requise, propriétaire uniquement | `{ tag }` (texte libre, max 30 car., pas de doublon sur le fichier) | 201 `{ id, tags }` |
| PUT | /api/files/{id}/tags/{tag} | US08 | requise, propriétaire uniquement | `{ tag }` (nouveau nom, mêmes règles que la création) | 200 `{ id, tags }` |
| DELETE | /api/files/{id}/tags/{tag} | US08 | requise, propriétaire uniquement | aucun | 200 `{ id, tags }` |

La modification (renommage) d'un tag existant n'est pas décrite littéralement dans US08 (specs/spécifications.pdf) ; c'est une extension ajoutée à la demande du produit.

## Téléchargement (lien public)

| Méthode | Route | US | Auth | Corps de la requête | Réponse |
|---|---|---|---|---|---|
| GET | /api/downloads/{downloadToken} | US02 | non | aucun | 200 `{ name, size, mimeType, expiresAt, hasPassword }` ; 410 si lien expiré ou invalide |
| POST | /api/downloads/{downloadToken} | US02, US09 | non | `{ password? }` (requis si `hasPassword` = true) | 200 `{ presignedUrl, expiresIn }` ; 401 si mot de passe invalide ; 410 si lien expiré ou invalide |

Le fichier n'est jamais servi directement par l'API : la route de téléchargement ne fait que vérifier l'expiration et le mot de passe, puis renvoie une URL présignée MinIO/S3 à durée de vie courte (voir tech_stack.md, section "Transit des fichiers").

## Codes d'erreur communs

- 400 : requête illisible, corps JSON mal formé ou champ de connexion absent
- 401 : authentification manquante ou invalide, ou mot de passe de téléchargement incorrect
- 403 : action sur une ressource dont l'utilisateur n'est pas propriétaire
- 404 / 410 : ressource introuvable ou lien de téléchargement expiré
- 422 : validation (email déjà utilisé, mot de passe trop court ou trop faible, taille > 1 Go, type de fichier interdit, durée d'expiration > 7 jours, tags soumis sans compte)
- 429 : trop de tentatives de connexion échouées

Les erreurs de validation suivent la RFC 7807 : les champs fautifs sont listés sous `violations`, chacun avec son `propertyPath` et son message.
