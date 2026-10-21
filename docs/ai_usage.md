# Utilisation de l'IA

## La posture adoptée

Elle est triple, et c'est ce qui la distingue du simple binômage. L'IA a d'abord été un partenaire de
discussion, chargé de contredire mes idées plutôt que de les exécuter. Elle a ensuite tenu le rôle d'un
développeur junior à qui l'on assigne des tickets. Elle a enfin servi de relecteur, pour chercher les failles,
les mauvaises pratiques et les manques dans la documentation.

Ces trois rôles sont restés distincts tout au long du projet, et je suis resté l'unique décideur.

## Les tâches confiées

La collaboration a suivi l'ordre du projet.

Au départ, l'IA a servi d'interlocuteur pour arrêter le choix du socle technique et pour mettre à l'épreuve
mes décisions d'architecture, chaque option devant résister à la contradiction avant d'être retenue.

Elle a ensuite rédigé les tickets, à partir d'une liste de travaux que je lui ai fournie et des décisions
d'architecture déjà prises. Ces tickets ont fait l'objet d'allers-retours de ma part, pour en corriger la
pertinence et en redécouper plusieurs.

Elle a enfin pris en charge les tickets un par un.

## La supervision et les corrections

Chaque ticket s'est déroulé en deux temps. L'IA produisait d'abord un plan d'implémentation, que je relisais
et corrigeais avant toute écriture de code. L'implémentation ne commençait qu'une fois ce plan validé, et se
terminait par un test manuel de ma part.

L'IA créait ensuite la branche et la demande de fusion, mais **n'a jamais été autorisée à fusionner quoi que
ce soit**. Chaque fusion a été faite par un humain, après relecture des modifications ligne à ligne, et à la
double condition que le test manuel et l'intégration continue soient l'un et l'autre au vert. Cette règle n'a
pas souffert d'exception.

## Les apports

- **Le gain de temps a été considérable**, au point que je ne pense pas que le projet aurait tenu dans les
  délais sans cette aide.
- **La sécurité en est sortie renforcée**, un relecteur systématique repérant ce qu'une relecture humaine
  laisse passer.
- **Des technologies et des services que je ne connaissais pas** m'ont été signalés, et ont simplifié
  certaines implémentations.
- **Une couverture de tests systématique pour un effort réduit**, là où elle aurait sinon été la première
  chose sacrifiée.

## Les limites

Deux, et elles tiennent au même phénomène.

**L'apprentissage des technologies est moins profond** qu'il ne l'aurait été en écrivant soi-même : une part
de confiance accordée au code produit remplace la compréhension qu'on acquiert en se trompant.

**La quantité de code produite en peu de temps crée une surcharge cognitive**, qui limite la capacité à garder
un œil critique sur l'intégralité de ce qui est écrit.

C'est précisément ce que la relecture obligatoire avant fusion, le test manuel et l'intégration continue
servent à contenir, sans jamais le supprimer complètement.
