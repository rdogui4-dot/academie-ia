# Raccordement des supports Canva — 2 octobre 2026

Les quatre documents importés par l’utilisateur ont été identifiés via Canva :

| Parcours | Document Canva | Pages |
| --- | --- | ---: |
| N1 | DAHW5qJQ88M — Fondamentaux du Prompt Engineering | 42 |
| N2 | DAHW5vTnZqE — Prompts structurés et productivité | 59 |
| N3 | DAHW5rPcTHI — IA générative avancée | 40 |
| N4 | DAHW5qFijy0 — IA générative appliquée | 60 |

Leurs URL de consultation, retournées par Canva, figurent dans
`cours/integration.js`, propriété `canvaViews`. Le bouton « Ouvrir dans Canva »
ouvre le bon support dans un nouvel onglet. Aucun lien d’édition fourni dans
la conversation n’a été placé dans le site.

La lecture anonyme n’a pas pu être testée : Canva bloque le navigateur de cette
session. L’accès via la connexion Canva est confirmé, mais ne prouve pas un
partage public. Si un apprenant reçoit une demande d’accès, vérifier les réglages
de consultation dans Canva. Aucun réglage de partage n’a été modifié par l’agent.

L’affichage dans une iframe reste désactivé : aucun code d’intégration Canva
n’a été fourni. Pour l’activer, obtenir l’URL `src` du code d’intégration de
chaque document et la renseigner dans `canvaEmbeds`, sans modifier `canvaViews`.
Le PDF local reste disponible quelle que soit la disponibilité de Canva.

Cette mise à jour ne configure pas le tuteur IA et ne contient aucune clé API.
Tests : neuf scénarios LMS, dont les quatre associations Canva, et contrôle
des liens locaux. Aucun test visuel des documents Canva n’a été possible.
