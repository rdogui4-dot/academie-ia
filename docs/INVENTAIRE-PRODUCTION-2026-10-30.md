# Inventaire de la production — 30 octobre 2026

Projet Supabase « Academie » (référence `feryogknkzewcaazeoax`, région eu-west-1, PostgreSQL 17.11, statut `ACTIVE_HEALTHY`).

Ce document est un **inventaire** (lecture seule via le catalogue système) : il liste ce qui existe réellement en production et l'écart avec le dépôt. Il ne remplace pas une sauvegarde complète du schéma. Pour une baseline exécutable, voir la dernière section.

## 1. Historique des migrations

| Version en production | Nom en production | Fichier correspondant dans le dépôt |
|---|---|---|
| 20261017115012 | security_function_grants | `20261017115012_security_function_grants.sql` |
| 20261028175508 | n4_practical_specialties | `20261028175007_n4_practical_specialties.sql` (horodatage différent) |
| 20261028191735 | fix_n4_specialty_code_ambiguity | **absent du dépôt** |
| 20261028192114 | trainer_workspace_scoped_api | `20261028192125_trainer_workspace_and_n4_fix.sql` (horodatage différent) |
| 20261029230308 | finance_admin | `20261029225234_finance_admin.sql` (horodatage différent) |

- Le dépôt contient **7** migrations ; la production n'en enregistre **5**.
- `202610030001_academy`, `202610030002_required_learning` et `202610030003_course_coherence` **ne figurent pas** dans l'historique, alors que leurs objets existent en production (par exemple `academy_lessons`, `academy_work`, `academy_documents`). Le schéma a donc été appliqué hors de l'historique.
- Une migration de production (`fix_n4_specialty_code_ambiguity`) n'est pas dans le dépôt.

## 2. Fonctions Edge

| Fonction | Version | verify_jwt | Dans le dépôt | Remarque |
|---|---|---|---|---|
| enrollment-sync | 12 | false | oui | Code de production relu : fonctionnellement équivalent au dépôt (comparaison visuelle) |
| tutor | 7 | false | oui | Vérifier l'identité du code déployé (non relu ici) |
| certificate-pdf | 3 | false | **ajoutée** (`supabase/functions/certificate-pdf/`) | Auparavant absente du dépôt |
| chariow-store | 1 | false | oui | Absente du rapport d'état précédent |
| learning-support-release | 3 | true | oui | Le code déployé ne diffère du dépôt que par un commentaire ; le statut 410 est identique |

`certificate-pdf` : archivage du certificat dans le bucket `academy-certificates`, empreinte SHA-256 vérifiée, édition versionnée (`document_version`), contrôle de concurrence par `academy_archive_certificate`. Le fichier `assets.ts`, généré par `build-assets.py` à partir de `assets/fonts/DejaVuSans.ttf` et `assets/logo-officiel-blanc.png`, reproduit à l'octet près celui de production.

## 3. Tables

**Schéma `public` : 19 tables, toutes avec RLS activée et politiques.**
Tables présentes en production mais absentes du dépôt : `academy_profiles`, `academy_trainer_applications`, `academy_trainer_assignments`, `academy_specialties`. Politiques présentes : `profiles_read`, `application_read`, `assignments_read`, `specialties_read`.

**Schéma `academy_private` : 18 tables.**
- RLS activée sur 4 : `admins`, `audit`, `events`, `tutor_usage`.
- RLS **désactivée** sur 14 : `application_history`, `case_assignments`, `certificate_documents`, `correction_guides`, `dossier_history`, `exam_assignments`, `exam_attempts`, `exam_remediations`, `exam_versions`, `quiz_assignments`, `quiz_attempts`, `quiz_remediations`, `quiz_versions`, `trainers`.
- Aucun droit de table pour `anon` ni `authenticated` sur ces tables (vérifié). Le schéma n'est donc pas exposé par l'API. La RLS sur ces 14 tables reste une protection de défense en profondeur à activer.

## 4. Fonctions

**`public` : 56 fonctions, dont 31 définies dans les migrations du dépôt et 25 présentes uniquement en production.**
Présentes uniquement en production : `admin_specialty`, `apply_trainer`, `archive_certificate`, `can_read_dossier`, `can_review`, `case_grading`, `correction_guide`, `decide_trainer`, `dossier_history`, `enable_case_grading`, `ensure_profile`, `exam_banks`, `exam_remediation`, `exam_status`, `grade_with_cases`, `grade_with_rubric`, `is_trainer`, `quiz_remediation`, `quiz_status`, `review_exam`, `set_trainer_assignment`, `submit_exam`, `submit_quiz`, `teaches_level`, `trainer_quizzes`.

Le dépôt ne contient donc pas les fonctions de décision formateur, d'affectation et de correction par étude de cas. Elles sont appelées par le frontend et exécutables par `authenticated`.

**`academy_private` : 17 fonctions, dont 8 dans le dépôt et 9 présentes uniquement en production** : `archive_application`, `archive_dossier`, `assign_iuid`, `enforce_final_exam_score`, `enforce_step_quiz`, `grade_core`, `grade_rubric_legacy`, `normalize_quiz_answer`, `protect_iuid`.

**Toutes les fonctions `SECURITY DEFINER` ont un `search_path` vide** (vérifié sur les 56 + 17 fonctions de production pour `public` et `academy_private` lues ici).

## 5. Alertes du conseiller de sécurité (état au 30/10/2026)

- `anon_security_definer_function_executable` : `academy_verify_certificate` seulement. C'est voulu (vérification publique).
- `authenticated_security_definer_function_executable` : 53 fonctions. Parmi elles, des fonctions de contrôle comme `academy_can_review`, `academy_can_read_dossier`, `academy_is_trainer`, qui reçoivent un identifiant d'utilisateur. Elles ne divulguent pas de données par elles-mêmes, mais devraient être retirées de l'API si elles ne sont appelées que depuis la base.
- `auth_leaked_password_protection` : désactivée. Le parcours utilise un code par e-mail, donc le risque est réduit.
- `rls_enabled_no_policy` : 4 tables de `academy_private` (`admins`, `audit`, `events`, `tutor_usage`), sans accès API.

## 6. Baseline exécutable (à faire par un administrateur)

Le connecteur ne fournit pas le texte complet des fonctions et politiques en un seul export. Pour une baseline complète et rejouable, exécuter en lecture seule depuis un poste administrateur :

```bash
pg_dump "postgresql://postgres:MOT_DE_PASSE@db.feryogknkzewcaazeoax.supabase.co:5432/postgres" \
  --schema-only --schema=public --schema=academy_private --schema=storage \
  --no-owner --no-privileges > baseline-production-2026-10-30.sql
```

Le mot de passe ne doit jamais être collé dans un chat ni committé. Le fichier produit doit être relu avant d'être versionné, en particulier pour retirer les objets de Supabase gérés par la plateforme.
