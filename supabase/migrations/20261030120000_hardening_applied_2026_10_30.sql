-- Durcissement appliqué en production le 30/10/2026 via SQL (non enregistré dans l'historique Supabase).
-- Idempotent : peut être rejoué sans effet sur une base déjà durcie.

-- 1. RLS activée sur les tables privées (aucune politique : accès direct refusé à tous les rôles API).
--    Les fonctions appartiennent à postgres, qui contourne la RLS : leur fonctionnement n'est pas modifié.
alter table academy_private.application_history enable row level security;
alter table academy_private.case_assignments enable row level security;
alter table academy_private.certificate_documents enable row level security;
alter table academy_private.correction_guides enable row level security;
alter table academy_private.dossier_history enable row level security;
alter table academy_private.exam_assignments enable row level security;
alter table academy_private.exam_attempts enable row level security;
alter table academy_private.exam_remediations enable row level security;
alter table academy_private.exam_versions enable row level security;
alter table academy_private.quiz_assignments enable row level security;
alter table academy_private.quiz_attempts enable row level security;
alter table academy_private.quiz_remediations enable row level security;
alter table academy_private.quiz_versions enable row level security;
alter table academy_private.trainers enable row level security;

-- 2. Retirer l'exécution aux connectés pour les fonctions qu'aucun écran, politique ni Edge Function n'appelle.
--    Rétablissement possible : grant execute on function ... to authenticated;
revoke execute on function public.academy_admin_specialty(uuid,text,text) from authenticated;
revoke execute on function public.academy_choose_specialty(text) from authenticated;
revoke execute on function public.academy_grade(uuid,integer,integer,integer,text) from authenticated;
revoke execute on function public.academy_grade_with_cases(uuid,integer,integer,uuid,jsonb,jsonb,text) from authenticated;
revoke execute on function public.academy_grade_with_rubric(uuid,integer,integer,uuid,jsonb,text) from authenticated;
