-- N4 : examens pratiques par métier, sans questionnaire automatique.
alter table public.academy_enrollments add column if not exists specialty_other text;
alter table public.academy_enrollments add constraint academy_specialty_other_valid check (
(specialty_code='autre' and level=4 and length(trim(specialty_other)) between 2 and 120 and specialty_other is not null)
or (specialty_code is distinct from 'autre' and specialty_other is null));
insert into public.academy_specialties(code,title,brief,active) values('autre','Autre spécialité',
'Précisez votre métier. Le formateur valide le contexte, les livrables et les critères du projet avant réalisation.',true) on conflict(code) do nothing;
insert into public.academy_requirements(id,level,step,kind,title,page,last_page,instruction,source_kind,source_title)
select 'n4-cas-autre',4,7,'cas','Examen pratique dans votre métier',page,last_page,
'Décrivez un besoin concret de votre métier, des données fictives ou autorisées, une méthode IA reproductible, deux essais comparés, les risques et les contrôles humains. Faites valider le périmètre par le formateur avant réalisation.',
source_kind,source_title from public.academy_requirements where id='n4-cas-6' on conflict(id) do nothing;
create or replace function academy_private.n4_requirement(p_user uuid,p_id text) returns boolean
language sql stable security definer set search_path='' as $f$
select exists(select 1 from public.academy_enrollments e join auth.users u on lower(u.email)=e.email
where u.id=p_user and e.level=4 and e.status='active' and e.specialty_code is not null
and (p_id in ('n4-cas-1','n4-fil_rouge-14') or p_id=case e.specialty_code
when 'marketing_communication' then 'n4-cas-6' when 'ressources_humaines' then 'n4-cas-7'
when 'finance_gestion' then 'n4-cas-8' when 'juridique_conformite' then 'n4-cas-9'
when 'sante_information' then 'n4-cas-10' when 'education_formation' then 'n4-cas-11'
when 'immobilier' then 'n4-cas-12' when 'industrie_maintenance' then 'n4-cas-13'
when 'autre' then 'n4-cas-autre' end));$f$;
revoke all on function academy_private.n4_requirement(uuid,text) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.academy_choose_specialty_details(p_code text, p_other text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare previous text; previous_other text;begin
 if not public.academy_has_access(4) then raise exception 'Inscription N4 active requise';end if;
 perform academy_private.learning_lock(auth.uid(),4);
 if p_code='autre' and (p_other is null or length(trim(p_other)) not between 2 and 120) then raise exception 'Précisez votre métier (2 à 120 caractères)';end if;
 if not exists(select 1 from public.academy_specialties where code=p_code and active) then raise exception 'Spécialité inconnue';end if;
 select e.specialty_code,e.specialty_other into previous,previous_other from public.academy_enrollments e join auth.users u on lower(u.email)=e.email where u.id=auth.uid() and e.level=4 for update of e;
 if previous=p_code and previous_other is not distinct from (case when p_code='autre' then trim(p_other) else null end) then return;end if;
 if exists(select 1 from public.academy_projects where user_id=auth.uid() and level=4)
 or exists(select 1 from public.academy_work w join public.academy_requirements r on r.id=w.requirement_id where w.user_id=auth.uid() and r.level=4 and r.kind in ('cas','fil_rouge'))
 or exists(select 1 from public.academy_certificates where user_id=auth.uid() and level=4) then raise exception 'Dossier final existant : contactez l’administration pour confirmer la spécialité';end if;
 update public.academy_enrollments e set specialty_code=p_code,specialty_other=case when p_code='autre' then trim(p_other) else null end from auth.users u where u.id=auth.uid() and e.email=lower(u.email) and e.level=4;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'specialty_choice',jsonb_build_object('previous',previous,'code',p_code));
end;$function$
;revoke all on function public.academy_choose_specialty_details(text,text) from public,anon;
grant execute on function public.academy_choose_specialty_details(text,text) to authenticated;
create or replace function public.academy_choose_specialty(p_code text) returns void language plpgsql security definer set search_path='' as $f$begin perform public.academy_choose_specialty_details(p_code,null);end;$f$;
CREATE OR REPLACE FUNCTION academy_private.final_module_enabled(p_user uuid, p_level integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select p_level=4 or exists(select 1 from academy_private.quiz_assignments where user_id=p_user and level=p_level);$function$
;
CREATE OR REPLACE FUNCTION academy_private.course_ready(p_user uuid, p_level integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select not exists(select 1 from public.academy_lessons l where l.level=p_level and not exists(select 1 from public.academy_progress p where p.user_id=p_user and p.level=l.level and p.step=l.step and p.done and p.requirements_version=2 and length(trim(p.notes))>=80))
 and not exists(select 1 from public.academy_reading_pages p where p.level=p_level and p.required and not exists(select 1 from public.academy_read_receipts r where r.user_id=p_user and r.level=p.level and r.page=p.page))
 and not exists(select 1 from public.academy_requirements r where p_level<>4 and r.level=p_level and r.kind not in ('cas','fil_rouge') and not exists(select 1 from public.academy_work w where w.user_id=p_user and w.requirement_id=r.id and w.state in ('submitted','accepted')))
 and not exists(select 1 from academy_private.quiz_assignments a where p_level<>4 and a.user_id=p_user and a.level=p_level and not exists(select 1 from academy_private.quiz_attempts t where t.user_id=p_user and t.level=a.level and t.step=a.step and t.score>=14));$function$
;
CREATE OR REPLACE FUNCTION public.academy_complete_step(p_level integer, p_step integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 perform academy_private.learning_lock(auth.uid(),p_level);
 if not public.academy_has_access(p_level) or not academy_private.step_open(auth.uid(),p_level,p_step) then raise exception 'Étape non autorisée';end if;
 if not exists(select 1 from public.academy_progress where user_id=auth.uid() and level=p_level and step=p_step and length(trim(notes))>=80) then raise exception 'Carnet obligatoire : 80 caractères minimum';end if;
 if exists(select 1 from public.academy_reading_pages p where p.level=p_level and p.required and p.step=p_step and not exists(select 1 from public.academy_read_receipts r where r.user_id=auth.uid() and r.level=p.level and r.page=p.page)) then raise exception 'Consultez et confirmez chaque page de cette étape';end if;
 if exists(select 1 from public.academy_requirements r where p_level<>4 and r.level=p_level and r.step=p_step and not (academy_private.final_module_enabled(auth.uid(),p_level) and r.kind in ('cas','fil_rouge')) and not exists(select 1 from public.academy_work w where w.user_id=auth.uid() and w.requirement_id=r.id and w.state in ('submitted','accepted'))) then raise exception 'Tous les travaux sont obligatoires ; corrigez les remises renvoyées';end if;
 update public.academy_progress set done=true,requirements_version=2,updated_at=now() where user_id=auth.uid() and level=p_level and step=p_step;
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_prerequisites(p_level integer, p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=coalesce(p_user,auth.uid()); missing_steps integer;missing_pages integer;missing_work integer;unreviewed integer;begin
 if not public.academy_can_read_dossier(u,p_level) then raise exception 'Non autorisé';end if;
 if p_level is null or p_level not between 1 and 4 then raise exception 'Niveau invalide';end if;
 select count(*) into missing_steps from public.academy_lessons l where l.level=p_level and not exists(select 1 from public.academy_progress p where p.user_id=u and p.level=l.level and p.step=l.step and p.done and p.requirements_version=2 and length(trim(p.notes))>=80);
 select count(*) into missing_pages from public.academy_reading_pages p where p.level=p_level and p.required and not exists(select 1 from public.academy_read_receipts r where r.user_id=u and r.level=p.level and r.page=p.page);
 select count(*),count(*) filter(where w.state is distinct from 'accepted') into missing_work,unreviewed from public.academy_requirements r left join public.academy_work w on w.requirement_id=r.id and w.user_id=u where r.level=p_level and (p_level<>4 or academy_private.n4_requirement(u,r.id)) and (w.state is null or w.state='revision');
 select count(*) into unreviewed from public.academy_requirements r left join public.academy_work w on w.requirement_id=r.id and w.user_id=u where r.level=p_level and (p_level<>4 or academy_private.n4_requirement(u,r.id)) and w.state is distinct from 'accepted';
 return jsonb_build_object('missing_steps',missing_steps,'missing_pages',missing_pages,'missing_work',missing_work,'unreviewed',unreviewed,'ready',missing_steps=0 and missing_pages=0 and missing_work=0,'ready_grade',missing_steps=0 and missing_pages=0 and missing_work=0 and unreviewed=0);
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_submit_work(p_requirement text, p_answer text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare r public.academy_requirements;previous text;final_work boolean;begin
 select * into r from public.academy_requirements where id=p_requirement;
 if r.id is null then raise exception 'Travail inconnu';end if;
 perform academy_private.learning_lock(auth.uid(),r.level);
 if r.level=4 and not academy_private.n4_requirement(auth.uid(),r.id) then raise exception 'Travail hors spécialité N4 ou métier non renseigné';end if;
 if not public.academy_has_access(r.level) or not academy_private.step_open(auth.uid(),r.level,r.step) then raise exception 'Étape non autorisée';end if;
 final_work:=academy_private.final_module_enabled(auth.uid(),r.level) and r.kind in ('cas','fil_rouge');
 if final_work and not academy_private.course_ready(auth.uid(),r.level) then raise exception 'Terminez les étapes du parcours avant les évaluations finales';end if;
 if final_work and r.kind='fil_rouge' and length(trim(p_answer))<200 then raise exception 'Fil rouge : 200 caractères minimum';end if;
 if final_work and r.level=4 and r.kind='fil_rouge' and not exists(select 1 from public.academy_enrollments e join auth.users u on lower(u.email)=e.email where u.id=auth.uid() and e.level=4 and e.specialty_code is not null) then raise exception 'Choisissez votre spécialité N4 avant le fil rouge';end if;
 if p_answer is null or length(trim(p_answer)) not between 120 and 30000 then raise exception 'Remettez un travail de 120 à 30000 caractères';end if;
 select answer into previous from public.academy_work where user_id=auth.uid() and requirement_id=r.id;
 if previous=p_answer then return;end if;
 if final_work then update public.academy_certificates set revoked=true where user_id=auth.uid() and level=r.level;
 else perform academy_private.invalidate_learning(auth.uid(),r.level,r.step);end if;
 insert into public.academy_work(user_id,requirement_id,answer) values(auth.uid(),r.id,p_answer)
 on conflict(user_id,requirement_id) do update set answer=excluded.answer,state='submitted',feedback='',reviewed_by=null,reviewed_at=null,updated_at=now();
if final_work and r.kind='fil_rouge' then
 insert into public.academy_projects(user_id,level,submission) values(auth.uid(),r.level,p_answer) on conflict(user_id,level) do update set submission=excluded.submission,updated_at=now();
 end if;
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_final_module(p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare code text; métier text;subject jsonb;begin
 if not public.academy_has_access(p_level) then raise exception 'Inscription active requise';end if;
 if p_level=4 then select e.specialty_code,e.specialty_other into code,métier from public.academy_enrollments e join auth.users u on lower(u.email)=e.email where u.id=auth.uid() and e.level=4;select jsonb_build_object('code',s.code,'title',case when s.code='autre' then s.title||' : '||métier else s.title end,'brief',s.brief) into subject from public.academy_specialties s where s.code=code;end if;
 return jsonb_build_object('enabled',academy_private.final_module_enabled(auth.uid(),p_level),'ready',academy_private.course_ready(auth.uid(),p_level),'specialty',subject,'required_ids',case when p_level=4 then (select jsonb_agg(r.id) from public.academy_requirements r where r.level=4 and academy_private.n4_requirement(auth.uid(),r.id)) else null end);
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_draft_exam(p_level integer, p_questions jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare q jsonb;a jsonb;result uuid;n integer;begin
 if p_level=4 then raise exception 'N4 : examens pratiques et fil rouge uniquement';end if;
 if not public.academy_is_admin() then raise exception 'Administration pédagogique requise';end if;
 if p_level is null or p_level not between 1 and 4 or jsonb_typeof(p_questions) is distinct from 'array' then raise exception 'Examen invalide';end if;
 n:=case when p_level in (1,3) then 20 else 15 end;
 if jsonb_array_length(p_questions)<>n or octet_length(p_questions::text)>100000 then raise exception 'Nombre de questions invalide';end if;
 for q in select value from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(q->'prompt') is distinct from 'string' or length(trim(q->>'prompt')) not between 10 and 2000
  or jsonb_typeof(q->'source') is distinct from 'string' or length(trim(q->>'source')) not between 3 and 500
  or jsonb_typeof(q->'explanation') is distinct from 'string' or length(trim(q->>'explanation')) not between 10 and 2000
  or q->>'type' is distinct from 'qcm' then raise exception 'QCM, source et explication requis';end if;
  if jsonb_typeof(q->'options') is distinct from 'array' or jsonb_typeof(q->'correct') is distinct from 'array' then raise exception 'Options et corrigé requis';end if;
  if jsonb_array_length(q->'options') not between 2 and 8 or jsonb_array_length(q->'correct') not between 1 and jsonb_array_length(q->'options') then raise exception 'QCM invalide';end if;
  for a in select value from jsonb_array_elements(q->'options') loop
   if jsonb_typeof(a)<>'string' or length(trim(a#>>'{}')) not between 1 and 500 then raise exception 'Option invalide';end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements(q->'options'))<>jsonb_array_length(q->'options') then raise exception 'Options répétées';end if;
  for a in select value from jsonb_array_elements(q->'correct') loop
   if jsonb_typeof(a)<>'number' or a::text!~'^[0-7]$' then raise exception 'Réponse invalide';end if;
   if a::text::integer>=jsonb_array_length(q->'options') then raise exception 'Réponse hors options';end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements(q->'correct'))<>jsonb_array_length(q->'correct') then raise exception 'Réponse répétée';end if;
 end loop;
 if (select count(distinct value->>'prompt') from jsonb_array_elements(p_questions))<>n then raise exception 'Questions répétées';end if;
 insert into academy_private.exam_versions(level,questions,author) values(p_level,p_questions,auth.uid()) returning id into result;return result;
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_enable_exam(p_user uuid, p_level integer, p_exam uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if p_level=4 then raise exception 'N4 : examens pratiques et fil rouge uniquement';end if;
 if not public.academy_is_admin() or not public.academy_can_review(p_user,p_level) then raise exception 'Activation non autorisée';end if;
 perform academy_private.learning_lock(p_user,p_level);
 if exists(select 1 from academy_private.exam_assignments where user_id=p_user and level=p_level and exam_id=p_exam) then return;end if;
 if exists(select 1 from academy_private.exam_assignments where user_id=p_user and level=p_level)
 or exists(select 1 from public.academy_assessments where user_id=p_user and level=p_level)
 or exists(select 1 from public.academy_certificates where user_id=p_user and level=p_level) then raise exception 'Parcours déjà engagé dans une évaluation : conserver son historique';end if;
 if not academy_private.final_module_enabled(p_user,p_level) then raise exception 'Nouveau parcours avec quiz requis';end if;
 if not exists(select 1 from academy_private.exam_versions where id=p_exam and level=p_level and published_at is not null) then raise exception 'Examen publié du niveau requis';end if;
 insert into academy_private.exam_assignments(user_id,level,exam_id) values(p_user,p_level,p_exam);
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'enable_exam',jsonb_build_object('user',p_user,'level',p_level,'exam',p_exam));
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_enable_quizzes(p_user uuid, p_level integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if p_level=4 then raise exception 'N4 : examens pratiques et fil rouge uniquement';end if;
 if not public.academy_is_admin() or p_user=auth.uid() or not public.academy_can_review(p_user,p_level) then raise exception 'Activation non autorisée';end if;
 perform academy_private.learning_lock(p_user,p_level);
 if exists(select 1 from academy_private.quiz_assignments where user_id=p_user and level=p_level) then return;end if;
 if exists(select 1 from public.academy_progress where user_id=p_user and level=p_level and done)
 or exists(select 1 from public.academy_projects where user_id=p_user and level=p_level)
 or exists(select 1 from public.academy_certificates where user_id=p_user and level=p_level) then raise exception 'Parcours commencé : migration pédagogique explicite requise';end if;
 if not exists(select 1 from public.academy_lessons where level=p_level) or exists(select 1 from public.academy_lessons l where l.level=p_level and not exists(select 1 from academy_private.quiz_versions q where q.level=l.level and q.step=l.step)) then raise exception 'Une banque validée est requise pour chaque étape du niveau';end if;
 insert into academy_private.quiz_assignments(user_id,level,step,quiz_id)
 select p_user,l.level,l.step,(select q.id from academy_private.quiz_versions q where q.level=l.level and q.step=l.step order by q.version desc limit 1)
 from public.academy_lessons l where l.level=p_level;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'enable_quizzes',jsonb_build_object('user',p_user,'level',p_level));
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_publish_exam(p_exam uuid, p_feedback text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare e academy_private.exam_versions;begin
 if not public.academy_is_admin() then raise exception 'Publication non autorisée';end if;
 select * into e from academy_private.exam_versions where id=p_exam for update;
 if e.level=4 then raise exception 'N4 : examens pratiques et fil rouge uniquement';end if;
 if e.id is null or e.author=auth.uid() then raise exception 'Relecture indépendante requise';end if;
 if p_feedback is null or length(trim(p_feedback)) not between 30 and 3000 then raise exception 'Compte rendu de relecture requis';end if;
 if e.published_at is not null then return;end if;
 update academy_private.exam_versions set reviewer=auth.uid(),review_note=trim(p_feedback),published_at=clock_timestamp() where id=p_exam;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'publish_exam',jsonb_build_object('exam',p_exam,'author',e.author));
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_publish_quiz(p_level integer, p_step integer, p_questions jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q jsonb;opt jsonb;a jsonb;i integer:=0;qc integer:=0;sc integer:=0;v integer;result uuid;
begin
 if p_level=4 then raise exception 'N4 : examens pratiques et fil rouge uniquement';end if;
 if not public.academy_is_admin() then raise exception 'Publication réservée à l’administration';end if;
 if p_questions is null or jsonb_typeof(p_questions)<>'array' then raise exception 'Liste de questions requise';end if;
 if jsonb_array_length(p_questions)<>7 or octet_length(p_questions::text)>50000 then raise exception 'Sept questions requises';end if;
 if not exists(select 1 from public.academy_lessons where level=p_level and step=p_step) then raise exception 'Étape inconnue';end if;
 for q in select value from jsonb_array_elements(p_questions) loop
  i:=i+1;
  if jsonb_typeof(q)<>'object' or jsonb_typeof(q->'prompt') is distinct from 'string' or length(trim(q->>'prompt')) not between 10 and 2000
   or jsonb_typeof(q->'source') is distinct from 'string' or length(trim(q->>'source')) not between 3 and 500 then raise exception 'Énoncé et référence au support requis';end if;
  if q->>'type'='qcm' then
   qc:=qc+1;
   if jsonb_typeof(q->'options') is distinct from 'array' or jsonb_typeof(q->'correct') is distinct from 'array' then raise exception 'Options et corrigé QCM requis';end if;
   if jsonb_array_length(q->'options') not between 2 and 8 or jsonb_array_length(q->'correct') not between 1 and jsonb_array_length(q->'options') then raise exception 'QCM invalide';end if;
   for opt in select value from jsonb_array_elements(q->'options') loop
    if jsonb_typeof(opt)<>'string' or length(trim(opt#>>'{}')) not between 1 and 500 then raise exception 'Option invalide';end if;
   end loop;
   for a in select value from jsonb_array_elements(q->'correct') loop
    if jsonb_typeof(a)<>'number' or (a::text)!~'^[0-7]$' then raise exception 'Index de réponse invalide';end if;
    if (a::text)::integer>=jsonb_array_length(q->'options') then raise exception 'Index hors options';end if;
   end loop;
   if (select count(distinct value) from jsonb_array_elements(q->'correct'))<>jsonb_array_length(q->'correct') then raise exception 'Réponse répétée';end if;
  elsif q->>'type'='short' then
   sc:=sc+1;
   if jsonb_typeof(q->'variants') is distinct from 'array' then raise exception 'Variantes admises requises';end if;
   if jsonb_array_length(q->'variants') not between 1 and 30 then raise exception 'Variantes invalides';end if;
   for a in select value from jsonb_array_elements(q->'variants') loop
    if jsonb_typeof(a)<>'string' or length(trim(a#>>'{}')) not between 1 and 500 then raise exception 'Variante invalide';end if;
   end loop;
  else raise exception 'Type inconnu : qcm ou short attendu';end if;
 end loop;
 if qc<>5 or sc<>2 then raise exception 'Cinq QCM et deux réponses courtes requis';end if;
 perform pg_advisory_xact_lock(hashtextextended('quiz-bank:'||p_level||':'||p_step,0));
 select id into result from academy_private.quiz_versions where level=p_level and step=p_step and questions=p_questions order by version desc limit 1;
 if result is not null then return result;end if;
 select coalesce(max(version),0)+1 into v from academy_private.quiz_versions where level=p_level and step=p_step;
 insert into academy_private.quiz_versions(level,step,version,questions,published_by) values(p_level,p_step,v,p_questions,auth.uid()) returning id into result;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'publish_quiz',jsonb_build_object('id',result,'level',p_level,'step',p_step,'version',v));
 return result;
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_start_exam(p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare a academy_private.exam_assignments;t academy_private.exam_attempts;bank jsonb;display jsonb;used integer;begin
 if p_level=4 then raise exception 'N4 : examens pratiques et fil rouge uniquement';end if;
 if not public.academy_has_access(p_level) then raise exception 'Inscription active requise';end if;
 perform academy_private.learning_lock(auth.uid(),p_level);
 select * into a from academy_private.exam_assignments where user_id=auth.uid() and level=p_level;
 if a.exam_id is null or not academy_private.course_ready(auth.uid(),p_level) then raise exception 'Examen non activé ou parcours incomplet';end if;
 select * into t from academy_private.exam_attempts where user_id=auth.uid() and level=p_level and submitted_at is null;
 if t.id is null then
  if exists(select 1 from academy_private.exam_attempts where user_id=auth.uid() and level=p_level and score>=case when p_level in (1,3) then 28 else 21 end) then raise exception 'Examen déjà réussi';end if;
  select count(*) into used from academy_private.exam_attempts where user_id=auth.uid() and level=p_level;
  if used>=a.attempt_limit then raise exception 'Rattrapage soumis à autorisation';end if;
  select jsonb_agg(q order by random()) into bank from academy_private.exam_versions e cross join lateral jsonb_array_elements(e.questions) q where e.id=a.exam_id;
  insert into academy_private.exam_attempts(user_id,level,exam_id,number,questions) values(auth.uid(),p_level,a.exam_id,used+1,bank) returning * into t;
 end if;
 select jsonb_agg(jsonb_build_object('type','qcm','prompt',value->>'prompt','options',value->'options','points',2) order by ord) into display from jsonb_array_elements(t.questions) with ordinality as q(value,ord);
 return jsonb_build_object('id',t.id,'number',t.number,'questions',display);
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_start_quiz(p_level integer, p_step integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare a academy_private.quiz_assignments;t academy_private.quiz_attempts;q academy_private.quiz_versions;used integer;display jsonb;begin
 if p_level=4 then raise exception 'N4 : examens pratiques et fil rouge uniquement';end if;
 if not public.academy_has_access(p_level) then raise exception 'Inscription active requise';end if;
 perform academy_private.learning_lock(auth.uid(),p_level);
 select * into a from academy_private.quiz_assignments where user_id=auth.uid() and level=p_level and step=p_step;
 if a.quiz_id is null then raise exception 'Quiz non activé pour ce parcours';end if;
 if exists(select 1 from public.academy_lessons l where l.level=p_level and l.step<p_step and not exists(select 1 from public.academy_progress p where p.user_id=auth.uid() and p.level=l.level and p.step=l.step and p.done and p.requirements_version=2)) then raise exception 'Terminez les étapes précédentes';end if;
 select * into t from academy_private.quiz_attempts where user_id=auth.uid() and level=p_level and step=p_step and submitted_at is null;
 if t.id is null then
  if exists(select 1 from academy_private.quiz_attempts where user_id=auth.uid() and level=p_level and step=p_step and score>=14) then raise exception 'Quiz déjà réussi';end if;
  select count(*) into used from academy_private.quiz_attempts where user_id=auth.uid() and level=p_level and step=p_step;
  if used>=a.attempt_limit then raise exception 'Remédiation avec votre formateur requise';end if;
  insert into academy_private.quiz_attempts(user_id,level,step,quiz_id,number) values(auth.uid(),p_level,p_step,a.quiz_id,used+1) returning * into t;
 end if;
 select * into q from academy_private.quiz_versions where id=t.quiz_id;
 select jsonb_agg(jsonb_build_object('type',value->>'type','prompt',value->>'prompt','options',case when value->>'type'='qcm' then value->'options' else null end,'points',case when value->>'type'='qcm' then 2 else 5 end) order by ord) into display from jsonb_array_elements(q.questions) with ordinality as j(value,ord);
 return jsonb_build_object('id',t.id,'number',t.number,'version',q.version,'questions',display);
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_sync_enrollment_details(p_event text, p_email text, p_name text, p_level integer, p_specialty text DEFAULT NULL::text, p_other text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if p_event is null or length(trim(p_event)) not between 1 and 300
 or p_level is null or p_level not between 1 and 4
 or p_email is null or length(p_email)>254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 or p_name is null or length(trim(p_name)) not between 2 and 120 then raise exception 'Données invalides';end if;
 if p_specialty is not null and (p_level<>4 or not exists(select 1 from public.academy_specialties where code=p_specialty and active)) then raise exception 'Spécialité invalide';end if;
 if p_specialty='autre' and (p_other is null or length(trim(p_other)) not between 2 and 120) then raise exception 'Métier requis';end if;
 insert into academy_private.events(event_id) values(p_event) on conflict do nothing;
 if not found then return;end if;
 -- Une nouvelle réponse ne modifie jamais une inscription existante, même révoquée.
 insert into public.academy_enrollments(email,level,full_name,source_id,specialty_code,specialty_required,specialty_other)
 values(lower(trim(p_email)),p_level,trim(p_name),p_event,p_specialty,p_level=4,case when p_specialty='autre' then trim(p_other) else null end)
 on conflict(email,level) do nothing;
end;$function$
;revoke all on function public.academy_sync_enrollment_details(text,text,text,integer,text,text) from public,anon,authenticated;grant execute on function public.academy_sync_enrollment_details(text,text,text,integer,text,text) to service_role;
alter table public.academy_certificates add column if not exists specialty_other text;
CREATE OR REPLACE FUNCTION academy_private.certificate_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if TG_OP='INSERT' then
  NEW.iuid:=academy_private.assign_iuid(NEW.user_id);
  if NEW.level=4 then select e.specialty_code,e.specialty_other into NEW.specialty_code,NEW.specialty_other from public.academy_enrollments e join auth.users u on lower(u.email)=e.email where u.id=NEW.user_id and e.level=4;end if;
 elsif NEW.specialty_other is distinct from OLD.specialty_other or NEW.full_name is distinct from OLD.full_name or NEW.iuid is distinct from OLD.iuid or NEW.specialty_code is distinct from OLD.specialty_code then
  NEW.document_version:=OLD.document_version+1;NEW.edited_at:=now();
 end if;
 return NEW;end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_certificate_document(p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare result jsonb;begin
 if not public.academy_has_access(p_level) then raise exception 'Inscription active requise';end if;
 select to_jsonb(c)||jsonb_build_object('specialty_title',case when c.specialty_code='autre' then s.title||' : '||c.specialty_other else s.title end,'document_path',d.path,'sha256',d.sha256)
 into result from public.academy_certificates c
 left join public.academy_specialties s on s.code=c.specialty_code
 left join academy_private.certificate_documents d on d.certificate_id=c.id and d.document_version=c.document_version
 where c.user_id=auth.uid() and c.level=p_level and not c.revoked;
 if result is null then raise exception 'Certificat valide requis';end if;return result;
end;$function$
;
create or replace function public.academy_grade_n4(p_user uuid,p_scores jsonb,p_feedback text) returns uuid language plpgsql security definer set search_path='' as $f$
declare c jsonb; item jsonb; i integer:=0; exams integer:=0; project integer:=0; points integer; result uuid;
begin
if not public.academy_can_review(p_user,4) then raise exception 'Correction non autorisée';end if;
perform academy_private.learning_lock(p_user,4);
if not exists(select 1 from public.academy_enrollments e join auth.users u on lower(u.email)=e.email where u.id=p_user and e.level=4 and e.specialty_code is not null) then raise exception 'Spécialité et métier requis';end if;
if jsonb_typeof(p_scores) is distinct from 'array' or jsonb_array_length(p_scores)<>10 then raise exception 'Dix critères requis';end if;
for item in select value from jsonb_array_elements(p_scores) loop
 if jsonb_typeof(item->'points') is distinct from 'number' or (item->>'points') !~ '^(10|[0-9])$'
 or jsonb_typeof(item->'feedback') is distinct from 'string' or length(trim(item->>'feedback')) not between 10 and 1000 then raise exception 'Chaque critère exige une note entière sur 10 et une justification';end if;
 points:=(item->>'points')::integer;
 if i<3 then exams:=exams+points;else project:=project+points;end if;i:=i+1;
end loop;
result:=academy_private.grade_core(p_user,4,exams,project,p_feedback);
update public.academy_assessments set evidence=evidence||jsonb_build_object('n4_mode','practical','criteria','["Examen : compréhension du besoin métier","Examen : réalisation et reproductibilité","Examen : vérifications, risques et restitution","Fil rouge : cadrage et critères de réussite","Fil rouge : données autorisées et confidentialité","Fil rouge : méthode et prompts documentés","Fil rouge : livrables adaptés au métier","Fil rouge : tests et preuves comparées","Fil rouge : limites et contrôle humain","Fil rouge : documentation et soutenance"]'::jsonb,'scores',p_scores) where user_id=p_user and level=4;
return result;end;$f$;
revoke all on function public.academy_grade_n4(uuid,jsonb,text) from public,anon;
grant execute on function public.academy_grade_n4(uuid,jsonb,text) to authenticated;

create or replace function public.academy_n4_context(p_user uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $f$
declare u uuid:=coalesce(p_user,auth.uid()); result jsonb;begin
if u=auth.uid() then if not public.academy_has_access(4) then raise exception 'Inscription active requise';end if;
elsif not public.academy_can_review(u,4) then raise exception 'Dossier non autorisé';end if;
select jsonb_build_object('title',case when e.specialty_code='autre' then s.title||' : '||e.specialty_other else s.title end,'brief',s.brief,
'required_ids',(select jsonb_agg(r.id) from public.academy_requirements r where r.level=4 and academy_private.n4_requirement(u,r.id)))
into result from public.academy_enrollments e join auth.users a on lower(a.email)=e.email left join public.academy_specialties s on s.code=e.specialty_code where a.id=u and e.level=4;
return result;end;$f$;
revoke all on function public.academy_n4_context(uuid) from public,anon;
grant execute on function public.academy_n4_context(uuid) to authenticated;
