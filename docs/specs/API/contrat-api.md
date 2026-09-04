# Contrat d'API

Contrat d'interface front/back pour le MVP. Réponses en JSON simple (voir tech_stack.md), pas d'enveloppe de pagination.

## Authentification

| Méthode | Route | US | Auth | Corps de la requête | Réponse |
|---|---|---|---|---|---|
| POST | /api/register | US03 | non | `{ email, password }` | 201 `{ id, email }` |
| POST | /api/login | US04 | non | `{ email, password }` | 200 `{ token }` (JWT) |

Le token JWT est ensuite transmis dans l'en-tête `Authorization: Bearer <token>` sur les routes qui le requièrent.

## Fichiers

| Méthode | Route | US | Auth | Corps de la requête | Réponse |
|---|---|---|---|---|---|
| POST | /api/files | US01, US07, US09 | optionnelle (connecté ou anonyme) | multipart/form-data : `file`, `expiresInDays?` (1 à 7, défaut 7), `password?` (min 6 car.), `tags?` (string[]) | 201 `{ id, name, size, mimeType, downloadToken, expiresAt, hasPassword, tags }` |
| GET | /api/files | US05 | requise | query `tag?` (filtrage facultatif) | 200 `[{ id, name, size, sentAt, expiresAt, status, tags }]` |
| DELETE | /api/files/{id} | US06 | requise, propriétaire uniquement | aucun | 204 |

`downloadToken` est l'identifiant non prédictible utilisé dans le lien de téléchargement partagé.

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

- 400 : validation (taille > 1 Go, type de fichier interdit, durée d'expiration > 7 jours, mot de passe < 6 caractères)
- 401 : authentification manquante ou invalide, ou mot de passe de téléchargement incorrect
- 403 : action sur une ressource dont l'utilisateur n'est pas propriétaire
- 404 / 410 : ressource introuvable ou lien de téléchargement expiré
- 409 : email déjà utilisé à l'inscription
