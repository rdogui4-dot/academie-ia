# Configuration serveur requise

Ces réglages ne sont pas dans le dépôt : ils se saisissent dans le tableau de bord. Sans eux, les fonctions répondent une erreur générique.

## Supabase : Edge Functions › Secrets

| Nom | Valeur attendue | Utilisé par | Si absent |
|---|---|---|---|
| `SITE_ORIGIN` | `https://rdogui4-dot.github.io` (sans chemin ni barre finale) | tutor, certificate-pdf, chariow-store | Requêtes refusées (« Origine refusée ») |
| `CERTIFICATE_SITE_URL` | `https://rdogui4-dot.github.io/academie-ia/` (avec barre finale) | certificate-pdf | Certificats PDF non configurés (503) |
| `ENROLLMENT_WEBHOOK_SECRET` | Chaîne aléatoire d'au moins 32 caractères, **identique** à la propriété du même nom dans Apps Script | enrollment-sync | Inscriptions non synchronisées (503) |
| `GEMINI_API_KEY` | Clé de l'API Gemini | tutor | Tuteur non configuré (503) |
| `GEMINI_MODEL` | Optionnel, défaut `gemini-3.5-flash-lite` | tutor | Le défaut s'applique |
| `CHARIOW_API_KEY` | Clé de l'API Chariow | chariow-store | Boutique affichée sans informations dynamiques (repli sur le lien direct) |

Les variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies automatiquement par Supabase : ne pas les recopier.

## Apps Script : Propriétés du script (formulaire d'inscription)

| Nom | Valeur |
|---|---|
| `SUPABASE_URL` | `https://feryogknkzewcaazeoax.supabase.co` |
| `ENROLLMENT_WEBHOOK_SECRET` | La même valeur que dans Supabase |

Le registre historique (`apps-script/Code.js`) n'a plus besoin d'aucune propriété. Supprimez `REGISTER_API_TOKEN` s'il existe encore.

## Vérification rapide

1. Le secret `ENROLLMENT_WEBHOOK_SECRET` est identique des deux côtés (ne pas le coller dans un document partagé).
2. `SITE_ORIGIN` ne contient ni chemin, ni barre finale.
3. `CERTIFICATE_SITE_URL` se termine par une barre oblique et commence par la même origine que `SITE_ORIGIN`.

## Risques acceptés

- **Protection des mots de passe compromis** (Supabase › Attack Protection) : réservée au plan Pro, non activée. Sans effet sur le parcours actuel, car la connexion se fait uniquement par code envoyé par e-mail, sans mot de passe. À réexaminer si un mot de passe est ajouté ou si le plan évolue.
