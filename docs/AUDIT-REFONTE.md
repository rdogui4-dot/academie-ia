# Audit et refonte — 2 octobre 2026

## Périmètre vérifié avant modification

Les 13 pages HTML, les feuilles de style, les scripts de progression, le quiz,
les écrans de certificat et le code Apps Script publié ont été examinés.
Référence distante : `ce1bb6009bf7c9a296d5e0d3cd4738a7e786154b`.
Tous les fichiers locaux utilisés pour la refonte correspondaient à cette
référence, sauf le backend : celui-ci a été lu séparément dans sa version publiée.
La navigation publique accueil → catalogue → N1 → module 1 a été observée dans
le navigateur. Aucun formulaire d’inscription, courriel ou certificat réel
n’a été envoyé pour cet audit.

## Fonctionnement existant

L’accueil présente l’Académie et conduit au catalogue. Le catalogue annonce
quatre niveaux et renvoie au formulaire Google d’inscription. L’espace
apprenant répète les quatre niveaux et permet de reprendre N1. Une troisième
page présente encore N1. Les cinq modules N1 utilisent le stockage du navigateur
pour la progression ; le quiz final est débloqué après leur validation.
Le quiz contient dix questions corrigées dans la page ; 70 % sont nécessaires.
Après réussite, une page de résultat conduit au certificat nominatif et à son
enregistrement via Apps Script. Le QR code conduit à la vérification en ligne.
L’inscription Google Forms et les envois de documents sont un autre flux Apps Script.

N2, N3 et N4 ne possèdent pas de modules de cours dans le dépôt. Le catalogue
présente leurs programmes et inscriptions, pas une plateforme de cours complète.

## Doublons, écarts et corrections

| Constat | Correction apportée |
| --- | --- |
| Catalogue et espace apprenant répètent les mêmes quatre niveaux | Une page `formations.html` réunit catalogue et reprise du parcours |
| Présentation N1 supplémentaire | Redirection de `formations/n1.html` vers le parcours unifié |
| Anciennes adresses utilisées par les apprenants | Conservation des deux anciennes pages comme redirections avec lien de secours |
| Deux identités visuelles et trois présentations d’en-tête | Charte commune et navigation identique sur les pages actives |
| Logos approximatifs et fichier officiel vide | Logos extraits directement du PDF ; retrait des anciens fichiers |
| Modules 1–2 et 3–5 différents | Même structure pour les cinq modules : objectifs, leçon, synthèse, activité, validation et navigation |
| Module 4 annoncé « Premiers prompts », contenu sur l’éthique | Intitulé harmonisé « Usage responsable », contenu conservé |
| Menu réécrit en « Module 1 », « Module 2 », etc. | Titres conservés, liens utilisables, état terminé/verrouillé explicite |
| Quiz parfois traité comme un sixième module | Élément de quiz distinct des cinq modules |
| Réponses aux exercices perdues en quittant une page | Sauvegarde automatique locale et message en cas d’échec |
| Accès vérifié seulement avec le module immédiatement précédent | Vérification de tous les prérequis via le premier module non terminé |
| Module 5 redirige automatiquement ; lien « Terminer » ramène au programme | Validation explicite puis lien vers le quiz final |
| Emplacements vidéo sans vidéo | Retrait des faux lecteurs ; les leçons textuelles restent disponibles |
| Ancien script et CSS du portail font double emploi | Retrait, progression gérée par un script commun |

## Charte appliquée

Source : `01-Charte_Graphique_Academie_IA_Generative.pdf`, 11 pages.
Violet #2D0A6E, bleu #0057FF, cyan #00A4FA, vert #0F8A2E,
encre #14142B et gris #6B7280. Titres et boutons en Poppins ; texte en DejaVu Sans.
Les éléments neutres et les états d’erreur conservent des couleurs fonctionnelles.
La signature blanche officielle apparaît sur fond violet, sans déformation.
L’icône officielle sert de favicon. Le logo couleur intégré au PDF comporte
un damier dans l’image : il n’a donc pas été utilisé comme logo transparent.
La taille du logo complet reste supérieure à 240 px dans les en-têtes.
L’application exacte de toutes les marges de protection du logo et le rendu mobile
devront être confirmés visuellement avant la mise en production finale.

## Parcours cible

Accueil → Formations → commencer/reprendre N1 → modules 1 à 5 → quiz final
→ résultat → certificat → vérification par QR code.

Le catalogue reste l’unique source des tarifs et durées : N1 14 h / 50 000 FCFA,
N2 28 h / 120 000 FCFA, N3 35 h / 250 000 FCFA, N4 sur mesure / 25 h recommandées.
Ces informations commerciales existantes n’ont pas été modifiées.
Le modèle de module est applicable aux futurs cours N2 à N4, mais les contenus
absents n’ont pas été inventés ou remplacés par des copies de N1.

## Certification : limite constatée

Le quiz côté site et le moteur de quiz Apps Script sont deux implémentations
distinctes. Le site ne consomme pas le moteur serveur. Le certificat utilise
des résultats stockés côté navigateur ; dans le code Apps Script publié,
la route `register` ne rattache pas l’enregistrement à un résultat de quiz signé.
La vérification QR prouve l’existence d’une ligne enregistrée, pas à elle seule
la réussite d’une évaluation protégée. Les commentaires du backend annonçant
une protection ne suffisent pas à la démontrer.

Cette refonte ne remplace pas le système de certification ni le déploiement
Apps Script. Un raccordement serveur complet demande une modification coordonnée
du quiz, du certificat et du projet Google, avec tests sur un environnement dédié.
Le fichier `apps-script/Code.js` n’est pas inclus dans les modifications livrées.

## Vérifications et limites

- 13 pages et 239 liens locaux contrôlés : aucun fichier lié manquant, aucune
  ancre cassée ni identifiant dupliqué.
- 12 scénarios de progression testés : nouvel apprenant, reprise historique,
  prérequis, retour aux cours terminés, validation, accès au quiz, retour au
  résultat, stockage indisponible et lecture d’un brouillon.
- Syntaxe de tous les scripts JavaScript vérifiée.
- Prévisualisation locale refusée par le navigateur de la session
  (`ERR_BLOCKED_BY_CLIENT`). Le rendu réel ordinateur/mobile de la refonte n’a
  pas pu être validé visuellement dans ce navigateur.
- Aucun test réel d’envoi, d’inscription ou de création de certificat effectué.
- La progression reste attachée au navigateur et à l’origine du site : ce n’est
  pas un compte apprenant synchronisé entre appareils.

## Publication et retour arrière

Le correctif est un patch Git qui ne touche pas au backend. Le lanceur Windows
vérifie le dépôt, un état propre et l’application du correctif avant modification,
crée une sauvegarde Git, applique et crée un commit. La publication utilise un
push normal, jamais forcé. En cas de rejet, le commit local reste disponible.
Pour annuler après publication, utiliser `git revert` sur le commit de refonte,
puis un push normal. Ne pas réinitialiser les historiques des deux dépôts fusionnés.
