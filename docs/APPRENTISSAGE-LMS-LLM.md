# Plateforme d’apprentissage et tuteur — livraison du 2 octobre 2026

## Ce qui est livré

- Bouton « Je m’inscris » dans les 14 en-têtes, vers le formulaire existant.
- Quatre parcours de lecture guidée basés sur les supports originaux fournis.
- 41 étapes : objectifs, pages à lire, activité, questions d’auto-évaluation,
  validation personnelle et navigation progressive.
- PDF complets consultables depuis le site, sans conversion destructrice des tableaux.
- Carnets locaux indépendants par niveau et étape, exportables en texte.
- Ancien parcours N1 et clés de progression conservés séparément.
- Interface de tuteur IA intégrée, désactivée tant que le serveur n'est pas configuré.
- Serveur de tuteur documentaire, corpus extrait des supports, codes d’accès,
  quotas persistants et réponses renvoyant aux pages consultées.

| Niveau | Support fourni | Pages | Étapes |
| --- | --- | ---: | ---: |
| N1 | Fondamentaux du Prompt Engineering | 42 | 8 |
| N2 | Prompts structurés et productivité augmentée | 59 | 12 |
| N3 | IA générative avancée | 40 | 11 |
| N4 | IA générative appliquée par métier | 60 | 10 |

Les fichiers de `ressources/` sont des copies exactes des PDF remis par
l’utilisateur. Ils seront accessibles publiquement après publication sur GitHub
Pages, comme le reste du site. Le texte pédagogique des PDF n’a pas été réécrit.
Les numéros sont ceux des pages physiques du PDF, de 1 à la dernière page.

## Canva : raccordement préparé, import bloqué

L’import du PDF N1 via la connexion Canva a renvoyé HTTP 403. Aucun design Canva
n’a été créé et aucun lien d’intégration n’a été inventé. L’intégration est prévue
dans `cours/integration.js`, avec une URL distincte par niveau.

Pour l’activer : importer chaque support dans Canva, obtenir son URL d’intégration
à partir de l’option de partage/intégration de Canva, puis recopier uniquement
l’URL `src` de l’iframe dans `canvaEmbeds`. Ne pas coller tout le HTML ou un lien
d’édition privé. Vérifier que le support s’affiche pour un visiteur déconnecté.
Le bouton Canva reste masqué tant qu’une URL n'est pas configurée. Le PDF demeure
accessible indépendamment de Canva. Canva sert de support visuel ; la progression
et le tuteur appartiennent au site et à son serveur.

## Tuteur IA : activation restante

Le code serveur utilise l’API OpenAI Responses. Il reste à choisir un modèle
disponible dans votre compte, configurer la clé dans les secrets du serveur,
héberger le service en HTTPS et renseigner `tutorApiBase`. Aucun appel payant n’a
été effectué et aucun compte fournisseur n’a été créé.

Instructions techniques : `server-tuteur/README.md`.
Ne transmettez jamais une clé API dans la conversation ou dans le code du site.
Le code d’accès apprenant est distinct de la clé API du fournisseur.

Les PDF peuvent comporter des approximations ou des références datées ; le tuteur
reçoit une instruction explicite de les signaler. La recherche est lexicale,
limitée au niveau choisi, avec cinq extraits maximum. Elle peut manquer une
paraphrase. Les liens de sources désignent les passages fournis au modèle et
ne garantissent pas automatiquement la justesse de chaque phrase produite.

## Périmètre pédagogique et limites

Cette version est un espace d’autoformation avec stockage local, pas un LMS à
comptes utilisateurs synchronisés. Elle n’inclut ni paiement, ni espace formateur
de correction, ni journal de notes centralisé. Les codes d’accès limitent l’usage
du tuteur ; ils ne synchronisent pas les carnets entre appareils.

Les QCM et projets des PDF restent des activités à faire évaluer selon les
modalités de la formation. Les auto-évaluations de la page sont des questions
de réflexion, pas une reproduction automatisée des banques de QCM des PDF.
Aucun nouveau certificat officiel n’est émis automatiquement à partir d’une
case cochée ou d’une réponse du tuteur. Le mécanisme historique de certificat
N1 reste inchangé, avec les limites documentées dans l’audit précédent.

## Validation réalisée

- 14 pages et 252 liens locaux : fichiers et ancres présents.
- 8 scénarios LMS : quatre niveaux, couverture des pages, prérequis, reprise,
  sauvegarde, séparation des données, stockage indisponible et inscription.
- 12 scénarios historiques de progression N1 conservés.
- 7 tests serveur : isolation des niveaux, recherche, validation des entrées,
  quota persistant et contrat API simulé.
- Contrôle de syntaxe JavaScript et Python.
- Aucun test réel avec une clé API, Canva intégré ou déploiement serveur.
- La prévisualisation locale du site est bloquée par le navigateur de cette
  session ; vérifier le rendu réel sur ordinateur et téléphone après publication.

## Installation

Le ZIP fournit un correctif Git et un lanceur Windows. Il exige un dépôt propre,
crée une sauvegarde, applique le patch, crée un commit puis publie avec un push
normal. Le patch n’inclut pas `apps-script/Code.js` et n’efface pas vos données
locales de progression. Ne pas relancer les anciens scripts de fusion/refonte.
