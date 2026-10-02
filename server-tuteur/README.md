# Activation du tuteur documentaire

Ce service séparé n'est PAS exécuté par GitHub Pages. Il est livré désactivé côté
site jusqu'à son hébergement HTTPS et la configuration d'une clé API. Les PDF et
les carnets fonctionnent sans lui. Aucun service payant n'a été souscrit.

## Configuration administrateur

Python 3.11+ suffit ; aucune dépendance externe. Utiliser un serveur avec proxy
HTTPS, un seul processus applicatif et un volume persistant pour SQLite.
Configurer les variables dans le gestionnaire de secrets de l'hébergeur :

- `OPENAI_API_KEY` : clé du projet API, jamais dans Git ni dans le navigateur.
- `TUTOR_MODEL` : identifiant d'un modèle compatible Responses disponible dans
  votre projet ; à choisir et vérifier avant activation.
- `SITE_ORIGIN` : `https://rdogui4-dot.github.io` (sans chemin).
- `TUTOR_DATABASE` : chemin vers la base de quotas sur le volume persistant.
- `TUTOR_ACCESS_HASHES` : objet JSON associant SHA-256 de chaque code d'accès à un
  identifiant pseudonyme distinct. Ne pas utiliser les courriels comme identifiants.
- `BIND_HOST` et `PORT` : selon le proxy/hébergeur ; défaut 127.0.0.1:8080.

Créer les codes individuellement avec `python create_access.py`. Le code est
remis à l'apprenant par votre canal habituel ; seul son hash entre dans la variable
serveur. Ne publier ni les codes ni la clé API dans ce dépôt. Un code révoqué doit
être retiré de la configuration, puis le service redémarré.

Démarrage : `python app.py`. Configurer le proxy HTTPS (limite de requête 45 Ko,
timeout 45 s, limitation de débit à l'entrée), conserver SQLite sur disque persistant,
puis ajouter l'URL HTTPS du service dans `cours/integration.js`, champ
`tutorApiBase`. Ce fichier ne doit jamais contenir de secret.

## Contrôles à effectuer avant activation

1. Tester un appel autorisé sur un cours, un code invalide et un dépassement de quota.
2. Vérifier une réponse avec ses pages sources et le comportement hors sujet.
3. Fixer les limites de dépenses et surveiller le projet du fournisseur IA.
4. Tester depuis le site HTTPS et sur téléphone.

Le service réserve au maximum 30 appels par code et 200 par jour pour l'ensemble
des apprenants. Les appels échoués consomment aussi une réservation. Cela limite
le nombre d'appels, pas un montant monétaire garanti. Un redémarrage ne doit pas
effacer la base. Ne pas multiplier les instances avec des bases distinctes.

## Fonctionnement et données

Recherche lexicale dans les passages extraits des PDF, filtrée sur le niveau
choisi ; cinq passages maximum transmis au modèle, avec la question et au plus
six messages d'historique. Le carnet n'est jamais transmis. La réponse est affichée
en texte simple et les pages consultées sont proposées à l'apprenant.
Ce premier moteur n'utilise pas d'embeddings ; il peut manquer des paraphrases.
Les citations sont des pages du document fourni, pas des vérifications web.

L'appel utilise l'API Responses avec `store:false` ; ce paramètre ne constitue pas
une promesse d'absence de toute conservation par le fournisseur. Adapter les
informations de confidentialité et les conditions de formation à l'exploitation.
Le service ne journalise pas les questions et ne certifie aucune réussite.

Documentation API consultée le 2 octobre 2026 :
https://developers.openai.com/api/docs/guides/migrate-to-responses

Tests sans réseau ni clé : `python -m unittest test_app.py`.
