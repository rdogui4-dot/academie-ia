# Mise en ligne du N1 : préparation (non exécutée)

Date : 31 octobre 2026. Aucune modification de production n'a été faite. Ce document prépare la bascule du N1 depuis l'ancien parcours vers le nouveau.

## 1. Existant en production (lecture seule)

| Élément | Quantité |
|---|---|
| Étapes N1 (`academy_lessons`) | 8 |
| Exigences (`academy_requirements`) | 24 : 8 activités, 8 exercices, 4 ateliers, 3 cas, 1 fil rouge |
| Pages de lecture (`academy_reading_pages`) | 42 : 38 obligatoires, 4 non obligatoires |
| Apprenants avec une progression N1 | 1 |
| Progression (`academy_progress`) | 1 ligne : étape 1 non terminée |
| Confirmations de lecture (`academy_read_receipts`) | 2 : pages 1 et 4 |
| Remises (`academy_work`) | 2 : `n1-s1-activite` acceptée, `n1-exercice-1` soumise |
| Évaluations et certificats N1 | 0 |
| Fichiers `n1/` dans le stockage | 87 (dont l'ancien manuel complet) |
| Fichiers `brouillon-n1/` | 49 (nouveau N1, invisible des apprenants) |

## 2. Ce qui doit être prêt avant la bascule

1. **Exigences du nouveau N1** : aujourd'hui, les 24 exigences correspondent à l'ancien manuel. Le nouveau parcours en demande d'autres (activités, ateliers, cas, épreuve finale). Elles doivent être rédigées et relues. C'est le point le plus lourd.
2. **Pages obligatoires** : le nouveau N1 compte 21 pages obligatoires (pages 4 à 24 du manuel). Les 42 anciennes lignes doivent être remplacées.
3. **Tests** : les tests de cohérence (`tools/test-coherence.py`, `tools/test-required-learning.mjs`) décrivent encore l'ancien N1. Ils doivent être adaptés avant la bascule, sinon ils échoueront.

## 3. Ordre de la bascule (à exécuter seulement après validation)

1. Gel des remises pendant la bascule (quelques minutes).
2. Transfert du contenu de `brouillon-n1/` vers `n1/` : `course.json` et les 24 pages. Ces fichiers doivent être remplacés **en même temps** que les lignes de base, sinon l'apprenant verrait un manuel qui ne correspond pas à son parcours.
3. Mise à jour de la base, dans une seule transaction, dans cet ordre (les clés étrangères l'imposent) :
   1. `academy_reading_pages` : supprimer les pages qui ne figurent plus dans le nouveau parcours, en tenant compte des confirmations existantes.
   2. `academy_requirements` : garder les identifiants des exigences inchangées (pour que les remises restent rattachées) ; ajouter les nouvelles ; supprimer les autres seulement si aucune remise ne les référence.
   3. `academy_lessons` : mettre à jour titres et pages des 8 étapes (les numéros d'étape ne changent pas).
   4. `academy_progress` : pour les étapes **modifiées**, passer les remises à « à revoir » ; ne pas supprimer les carnets (notes).
   5. `academy_documents` : mettre à jour les pages du manuel.
4. Vérification en lecture seule après bascule (nombre d'étapes, de pages obligatoires, de remises rattachées).
5. Suppression des anciens fichiers `n1/` au-delà du nouveau manuel, après listing et validation.

## 4. Points à décider

- **Étapes modifiées** : le manuel est réécrit. Pour choisir, il faut comparer le texte de l'ancien et du nouveau manuel. Tant que ce n'est pas fait, aucune étape ne peut être dite « inchangée ».
- **Apprenant concerné** : la remise `n1-s1-activite` est acceptée. Si l'étape 1 est modifiée, faut-il la repasser « à revoir » ?
- **Page 1 (confirmation de lecture)** : page de couverture de l'ancien manuel, non obligatoire dans le nouveau. La supprimer avec sa ligne de confirmation, ou la conserver ?
- **Pas de sauvegarde** (votre choix) : le périmètre est faible (un apprenant, une remise acceptée), mais la suppression reste irréversible.

## 5. Ce qui n'est pas encore fait

- Rédaction des exigences du nouveau N1.
- Adaptation des tests.
- Écriture du script SQL de bascule (à partir des décisions du point 4).
