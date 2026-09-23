# Mot de passe sur un fichier

**Statut** : accepté, 2026-09-23, ticket [#48](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/48)

L'US09 demande qu'un déposant, connecté ou anonyme, puisse protéger le téléchargement d'un fichier par un mot de passe d'au moins six caractères, stocké hashé et vérifié côté serveur avant l'émission de l'URL présignée.

## Ce que l'US09 ajoute réellement

Presque rien côté fonctionnel, et c'est le résultat d'un modèle posé à l'avance. La colonne `password` existe dans l'entité `File` depuis la migration initiale, et l'US02 a livré la vérification en même temps que la route de téléchargement, puisqu'il aurait fallu écrire deux fois le même code pour faire autrement. Le contrat d'API annonce les deux comportements depuis sa rédaction. Aucune migration n'est nécessaire.

Ce qui restait réellement à faire est ailleurs : rien n'empêchait de deviner ce mot de passe en le soumettant en boucle. Un secret de six caractères ne vaut que par la lenteur imposée à celui qui le cherche, et cette lenteur n'existait pas. C'est l'objet principal de ce ticket.

## Le compteur porte sur le lien, pas sur le couple lien plus adresse IP

**Décision** : `POST /api/downloads/{downloadToken}` accepte cinq mots de passe faux par lien et par quinze minutes, quelle que soit l'origine des tentatives. Un second compteur, cinq fois plus large, s'applique par adresse IP.

C'est la seule divergence volontaire avec le `login_throttling` du pare-feu, qui compte lui par couple compte plus adresse. Symfony retient ce couple pour une bonne raison, empêcher qu'un tiers verrouille le compte de quelqu'un d'autre à distance. Transposée ici, la règle raterait sa cible : une rotation d'adresses, qui ne coûte presque rien, rendrait le compteur inopérant, et la protection deviendrait décorative alors que c'est précisément la raison d'être du ticket.

Le secret attaqué appartient au lien. C'est donc le lien qui doit compter. Cinq échecs par quart d'heure plafonnent un lien à 480 essais par jour, contre une dizaine d'heures pour parcourir les mille mots de passe les plus courants si seul le compteur par adresse existait.

**Conséquence assumée** : n'importe qui peut rendre un lien inaccessible à tous ses destinataires pendant quinze minutes, en soumettant cinq mots de passe faux. Le compromis n'est pas celui d'un compte : un compte est un accès permanent dont le blocage est un vrai déni de service, alors qu'un lien vit sept jours au plus, qu'aucune donnée n'est perdue et que la fenêtre se referme d'elle-même.

### Alternatives évaluées

| Option | Raison de l'écarter |
|---|---|
| Clé sur le couple lien plus adresse IP, comme le login | Personne ne peut plus gêner les autres destinataires, mais changer d'adresse suffit à repartir de zéro. La protection principale du ticket disparaît pour éliminer une nuisance de quinze minutes. |
| Compteur par adresse IP seul | Ne protège rien : l'attaque qui compte est justement celle qui répartit ses tentatives. |
| Politique `sliding_window` plutôt que `fixed_window` | Supprime l'effet de bord des frontières de fenêtre, mais une rafale de dix essais au lieu de cinq ne change rien face au nombre de combinaisons. Surtout, sur une vérification sans consommation, `sliding_window` calcule le délai avant que **tous** les jetons se libèrent, ce qui ferait annoncer au front un `Retry-After` systématiquement surestimé. |

## Seuls les échecs comptent, et le blocage précède la comparaison

**Décision** : un mot de passe juste ne consomme rien et remet le compteur du lien à zéro ; la limite est constatée avant que le mot de passe soit comparé.

Les deux moitiés sont indissociables. Compter les tentatives plutôt que les échecs punirait le destinataire légitime qui rafraîchit sa page trois fois. Vérifier la limite après la comparaison la viderait de son sens, puisqu'il suffirait de continuer jusqu'à tomber juste. C'est l'ordre que Symfony applique au login, et le test fonctionnel qui le garde ici porte le même nom que le sien.

Corollaire visible du dehors : une fois la limite atteinte, le bon mot de passe reçoit lui aussi un 429. C'est voulu, et c'est ce qui rend la mesure efficace.

Une tentative sans mot de passe sur un lien protégé compte comme un échec. Le client sait par le GET qu'un mot de passe est requis, un POST vide est donc une devinette comme une autre, et l'exempter ouvrirait un contournement gratuit.

**Le succès ne remet à zéro que le compteur du lien.** Le login réinitialise les deux, ce serait une faille ici : un attaquant qui balaie cinquante liens tout en détenant légitimement l'un d'eux pourrait refaire le plein de son budget par adresse à volonté. Un mot de passe juste sur un lien ne dit rien des quarante-neuf autres.

## Un piège du composant qui mérite d'être écrit

C'est le point le moins évident du ticket, et celui qu'une relecture future casserait le plus facilement.

Vérifier une limite sans la consommer se fait par `consume(0)`, et cet appel renvoie **toujours** un résultat marqué accepté, y compris quand il ne reste plus un seul jeton, en `fixed_window` comme en `sliding_window`. Il faut donc lire aussi le nombre de jetons restants. Sans cette seconde condition, la limite laisse systématiquement passer une tentative de trop, et rien ne le signale : les tests de seuil continuent de passer si on les écrit à la tentative près.

Symfony contourne la même chose au même endroit dans son écouteur de `login_throttling`, avec le même commentaire. Un test unitaire dédié verrouille ce comportement ici, et vérifie d'abord que la prémisse tient toujours, pour que la mise à jour du composant qui corrigerait ce comportement se signale au lieu de passer inaperçue.

## Le mot de passe du partage n'est pas celui du compte

**Décision** : six caractères minimum, sans contrainte de robustesse, et un service de hachage distinct de celui des comptes.

L'écart est franc : un compte exige seize caractères et une note de robustesse moyenne (voir la section correspondante de `tech_stack.md`), un lien se contente de six. Il est imposé par la spécification, qui écrit "minimum 6 caractères, alphanumérique conseillé, aucune contrainte forte dans le MVP", et il se défend : les deux secrets ne protègent pas la même chose, ni pendant la même durée. Un compte ouvre tout l'historique et vit indéfiniment, un lien ouvre un fichier et disparaît sous sept jours. C'est aussi ce qui rend la limitation de tentatives indispensable plutôt que confortable, puisque c'est elle qui compense la faiblesse du seuil.

Le hachage passe par un `NativePasswordHasher` déclaré à part dans `config/services.yaml`, et non par le service de mots de passe des comptes : `File` n'est pas un `UserInterface`, et rien ne justifie de lui en faire endosser le contrat.

**Le hash ne sort jamais.** L'accesseur exposé s'appelle `isPasswordProtected()` et non `hasPassword()`, alors que la propriété sérialisée, elle, se nomme bien `hasPassword`. Ce n'est pas une coquette : un accesseur préfixé par "has" ferait résoudre au sérialiseur une propriété "password", donc lire `getPassword()`, et le hash sortirait dans la réponse sous la clé `hasPassword`. Le commentaire est dans l'entité, il est à conserver.

## Les clés de comptage sont hachées avant d'atteindre le stockage

Le stockage du limiteur construit sa clé de cache à partir d'une empreinte, mais sérialise l'identifiant **en clair dans la valeur**. Or les deux identifiants en jeu sont un jeton de téléchargement, qui est un porteur d'accès au fichier, et une adresse IP, qui est une donnée personnelle. Ni l'un ni l'autre n'est écrit tel quel : les deux passent par un HMAC-SHA256 tronqué, dans la même forme que celle employée par Symfony pour le login. Trois lignes, et la question ne se reposera pas le jour où ce stockage passera sur un Redis mutualisé.

## Points de vigilance

- **La limite est locale à l'instance PHP.** Le stockage est le pool de cache filesystem, celui-là même qu'utilise déjà le `login_throttling`. Répliquer l'application diviserait donc les compteurs par le nombre d'instances, sans qu'aucune erreur ne le signale. Redis est la reprise évidente, à décider en même temps pour les deux limitations, et à mentionner dans `SECURITY.md` ([#20](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/20)).
- **Le mot de passe ne peut être ni modifié, ni retiré, ni récupéré.** Il est fixé au dépôt et aucune route ne permet d'y revenir, la spécification excluant tout mécanisme de récupération. Un déposant qui se trompe n'a d'autre recours que de supprimer son fichier et de recommencer, ce qu'un déposant anonyme ne peut même pas faire ([#26](https://github.com/quentin-mace/OC_AL_P4_DataShare/issues/26)).
- **Une fois émise, l'URL présignée ne demande plus rien.** Elle reste utilisable soixante secondes par quiconque la reçoit, mot de passe ou non. La protection porte sur l'obtention du lien signé, pas sur le transfert lui-même, ce qui est la contrepartie directe du choix de ne jamais faire transiter le fichier par PHP.
- **Les messages d'erreur du périmètre téléchargement passent en anglais** avec ce ticket, alors que ceux de l'upload, des tags et de la validation restent en français. L'incohérence est temporaire et assumée, l'harmonisation du reste de l'API mérite son propre ticket plutôt que d'être glissée ici.
