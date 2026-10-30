-- Baseline des fonctions en production (lecture seule, 30/10/2026).
-- Généré depuis pg_get_functiondef. Ne pas exécuter sur une base existante sans relecture.

-- academy_private.archive_application
CREATE OR REPLACE FUNCTION academy_private.archive_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 insert into academy_private.application_history(user_id,actor,previous_row,current_row)
 values(NEW.user_id,auth.uid(),case when TG_OP='UPDATE' then to_jsonb(OLD) end,to_jsonb(NEW));return NEW;
end;$function$;

-- academy_private.archive_dossier
CREATE OR REPLACE FUNCTION academy_private.archive_dossier()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare before_data jsonb;after_data jsonb; row_data jsonb; n integer;begin
 if TG_OP<>'INSERT' then before_data:=to_jsonb(OLD);end if;
 if TG_OP<>'DELETE' then after_data:=to_jsonb(NEW);end if;
 if TG_OP='UPDATE' and before_data=after_data then return NEW;end if;
 row_data:=coalesce(after_data,before_data);
 n:=(row_data->>'level')::integer;
 if n is null then select level into n from public.academy_requirements where id=row_data->>'requirement_id';end if;
 insert into academy_private.dossier_history(table_name,user_id,level,operation,previous_row,current_row,actor)
 values(TG_TABLE_NAME,(row_data->>'user_id')::uuid,n,TG_OP,before_data,after_data,auth.uid());
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end;$function$;

-- academy_private.assign_iuid
CREATE OR REPLACE FUNCTION academy_private.assign_iuid(p_user uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare result text;begin
 if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'Compte confirmé requis';end if;
 perform pg_advisory_xact_lock(hashtextextended('iuid:'||p_user::text,0));
 select iuid into result from public.academy_profiles where user_id=p_user;
 if result is not null then return result;end if;
 loop
  -- 11 caractères alphanumériques issus de l'aléa UUID, sans identité personnelle.
  result:='AIG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,11))||'-'||to_char(now() at time zone 'UTC','YYYY');
  begin
   insert into public.academy_profiles(user_id,iuid) values(p_user,result);
   return result;
  exception when unique_violation then
   select iuid into result from public.academy_profiles where user_id=p_user;
   if result is not null then return result;end if;
  end;
 end loop;
end;$function$;

-- academy_private.certificate_identity
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
 return NEW;end;$function$;

-- academy_private.course_ready
CREATE OR REPLACE FUNCTION academy_private.course_ready(p_user uuid, p_level integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select not exists(select 1 from public.academy_lessons l where l.level=p_level and not exists(select 1 from public.academy_progress p where p.user_id=p_user and p.level=l.level and p.step=l.step and p.done and p.requirements_version=2 and length(trim(p.notes))>=80))
 and not exists(select 1 from public.academy_reading_pages p where p.level=p_level and p.required and not exists(select 1 from public.academy_read_receipts r where r.user_id=p_user and r.level=p.level and r.page=p.page))
 and not exists(select 1 from public.academy_requirements r where p_level<>4 and r.level=p_level and r.kind not in ('cas','fil_rouge') and not exists(select 1 from public.academy_work w where w.user_id=p_user and w.requirement_id=r.id and w.state in ('submitted','accepted')))
 and not exists(select 1 from academy_private.quiz_assignments a where p_level<>4 and a.user_id=p_user and a.level=p_level and not exists(select 1 from academy_private.quiz_attempts t where t.user_id=p_user and t.level=a.level and t.step=a.step and t.score>=14));$function$;

-- academy_private.enforce_final_exam_score
CREATE OR REPLACE FUNCTION academy_private.enforce_final_exam_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare final_score integer;begin
 if exists(select 1 from academy_private.exam_assignments where user_id=NEW.user_id and level=NEW.level) then
  select max(t.score) into final_score from academy_private.exam_attempts t where t.user_id=NEW.user_id and t.level=NEW.level and t.submitted_at is not null;
  if final_score is null or NEW.quiz_score is distinct from final_score then raise exception 'Note serveur de l’examen final requise';end if;
  NEW.evidence:=coalesce(NEW.evidence,'{}')||jsonb_build_object('final_exam',(select jsonb_build_object('attempt',id,'exam',exam_id,'score',t.score,'submitted_at',submitted_at) from academy_private.exam_attempts t where t.user_id=NEW.user_id and t.level=NEW.level and t.score=final_score order by number limit 1));
 end if;return NEW;end;$function$;

-- academy_private.enforce_step_quiz
CREATE OR REPLACE FUNCTION academy_private.enforce_step_quiz()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if NEW.done and exists(select 1 from academy_private.quiz_assignments where user_id=NEW.user_id and level=NEW.level and step=NEW.step)
 and not exists(select 1 from academy_private.quiz_attempts where user_id=NEW.user_id and level=NEW.level and step=NEW.step and score>=14) then raise exception 'Quiz de l’étape requis : au moins 14/20';end if;
 return NEW;
end;$function$;

-- academy_private.final_module_enabled
CREATE OR REPLACE FUNCTION academy_private.final_module_enabled(p_user uuid, p_level integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select p_level=4 or exists(select 1 from academy_private.quiz_assignments where user_id=p_user and level=p_level);$function$;

-- academy_private.finance_stamp
CREATE OR REPLACE FUNCTION academy_private.finance_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not public.academy_is_admin() then raise exception 'Administration requise' using errcode='42501'; end if;
 if TG_OP='INSERT' then
   new.created_by:=auth.uid(); new.created_at:=clock_timestamp();
   if TG_TABLE_NAME='academy_finance_entries' then
     if new.void_reason is not null or new.voided_at is not null or new.voided_by is not null then raise exception 'Une écriture neuve ne peut être annulée'; end if;
   end if;
 else
   if old.voided_at is not null then raise exception 'Annulation déjà enregistrée'; end if;
   if new.void_reason is null then raise exception 'Motif obligatoire'; end if;
   new.voided_at:=clock_timestamp(); new.voided_by:=auth.uid();
 end if;
 return new;
end $function$;

-- academy_private.grade_core
CREATE OR REPLACE FUNCTION academy_private.grade_core(p_user uuid, p_level integer, p_quiz integer, p_project numeric, p_feedback text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare qmax integer; pmax integer; qmin integer; pmin integer; qweight integer; pname text; cid uuid; snapshot text;
begin
 if not public.academy_can_review(p_user,p_level) then raise exception 'Correction non autorisée ; auto-correction interdite'; end if;
 if p_level is null or p_level not between 1 and 4 or p_quiz is null or p_project is null or p_feedback is null or length(trim(p_feedback)) not between 10 and 5000 then raise exception 'Évaluation incomplète'; end if;
 perform academy_private.learning_lock(p_user,p_level);
 if not (public.academy_prerequisites(p_level,p_user)->>'ready_grade')::boolean then raise exception 'Lectures, carnets et travaux validés par le formateur requis';end if;
 qmax:=case when p_level in (1,3) then 40 else 30 end;
 pmax:=case when p_level=1 then 60 else 70 end;
 qmin:=case when p_level in (1,3) then 28 else 21 end;
 pmin:=case p_level when 1 then 42 when 2 then 49 else 50 end;
 qweight:=100-pmax;
 if p_quiz<0 or p_quiz>qmax or p_project<0 or p_project>pmax then raise exception 'Note hors barème'; end if;
 select e.full_name into pname from auth.users u join public.academy_enrollments e on e.email=lower(u.email)
 where u.id=p_user and u.email_confirmed_at is not null and e.level=p_level and e.status='active';
 if pname is null then raise exception 'Inscription active requise'; end if;
 select submission into snapshot from public.academy_projects where user_id=p_user and level=p_level for update;
 if snapshot is null then raise exception 'Projet non remis'; end if;
 insert into public.academy_assessments(user_id,level,quiz_score,project_score,feedback,submission_snapshot,assessed_by,assessed_at) values(p_user,p_level,p_quiz,p_project,p_feedback,snapshot,auth.uid(),now())
 on conflict(user_id,level) do update set quiz_score=excluded.quiz_score,project_score=excluded.project_score,feedback=excluded.feedback,submission_snapshot=excluded.submission_snapshot,assessed_by=excluded.assessed_by,assessed_at=excluded.assessed_at;
 if p_quiz>=qmin and p_project>=pmin and (p_quiz::numeric/qmax*qweight+p_project)>=70 then
  insert into public.academy_certificates(user_id,level,full_name) values(p_user,p_level,pname)
  on conflict(user_id,level) do update set revoked=false,full_name=excluded.full_name,specialty_code=excluded.specialty_code returning id into cid;
 else
  update public.academy_certificates set revoked=true where user_id=p_user and level=p_level;
 end if;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'assessment',jsonb_build_object('user',p_user,'level',p_level,'quiz',p_quiz,'project',p_project));
 update public.academy_assessments set evidence=jsonb_build_object('version',2,'requirements',(select jsonb_agg(to_jsonb(w)) from public.academy_work w join public.academy_requirements r on r.id=w.requirement_id where w.user_id=p_user and r.level=p_level),'progress',(select jsonb_agg(to_jsonb(p)) from public.academy_progress p where p.user_id=p_user and p.level=p_level),'reading',(select jsonb_agg(to_jsonb(r)) from public.academy_read_receipts r where r.user_id=p_user and r.level=p_level)) where user_id=p_user and level=p_level;
 return cid;
end; $function$;

-- academy_private.grade_rubric_legacy
CREATE OR REPLACE FUNCTION academy_private.grade_rubric_legacy(p_user uuid, p_level integer, p_quiz integer, p_guide uuid, p_scores jsonb, p_feedback text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare guide jsonb;c jsonb;s jsonb;total integer:=0;cid uuid;begin
 if not public.academy_can_review(p_user,p_level) then raise exception 'Correction non autorisée';end if;
 perform academy_private.learning_lock(p_user,p_level);
 guide:=public.academy_correction_guide(p_user,p_level);
 if p_guide is null or (guide->>'id')::uuid<>p_guide then raise exception 'Guide modifié : rechargez le dossier';end if;
 if p_scores is null or jsonb_typeof(p_scores)<>'object' then raise exception 'Notes par critère requises';end if;
 if (select count(*) from jsonb_object_keys(p_scores))<>jsonb_array_length(guide->'criteria') then raise exception 'Tous les critères doivent être notés';end if;
 for c in select value from jsonb_array_elements(guide->'criteria') loop
  s:=p_scores->(c->>'id');
  if s is null or jsonb_typeof(s)<>'object' or jsonb_typeof(s->'points') is distinct from 'number' or (s->>'points')!~'^[0-9]{1,2}$'
   or jsonb_typeof(s->'feedback') is distinct from 'string' or length(trim(s->>'feedback')) not between 10 and 1000 then raise exception 'Points entiers et justification par critère requis';end if;
  if (s->>'points')::integer>(c->>'max')::integer then raise exception 'Note hors barème';end if;
  total:=total+(s->>'points')::integer;
 end loop;
 cid:=academy_private.grade_core(p_user,p_level,p_quiz,total,p_feedback);
 update public.academy_assessments set evidence=evidence||jsonb_build_object('rubric',guide,'criterion_scores',p_scores,'practical_total',total) where user_id=p_user and level=p_level;
 return cid;
end;$function$;

-- academy_private.invalidate_learning
CREATE OR REPLACE FUNCTION academy_private.invalidate_learning(p_user uuid, p_level integer, p_step integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 update public.academy_progress set done=false where user_id=p_user and level=p_level and step>=p_step;
 update public.academy_certificates set revoked=true where user_id=p_user and level=p_level;
end;$function$;

-- academy_private.learning_lock
CREATE OR REPLACE FUNCTION academy_private.learning_lock(p_user uuid, p_level integer)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$select pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_level::text,0));$function$;

-- academy_private.n4_requirement
CREATE OR REPLACE FUNCTION academy_private.n4_requirement(p_user uuid, p_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select exists(select 1 from public.academy_enrollments e join auth.users u on lower(u.email)=e.email
where u.id=p_user and e.level=4 and e.status='active' and e.specialty_code is not null
and (p_id in ('n4-cas-1','n4-fil_rouge-14') or p_id=case e.specialty_code
when 'marketing_communication' then 'n4-cas-6' when 'ressources_humaines' then 'n4-cas-7'
when 'finance_gestion' then 'n4-cas-8' when 'juridique_conformite' then 'n4-cas-9'
when 'sante_information' then 'n4-cas-10' when 'education_formation' then 'n4-cas-11'
when 'immobilier' then 'n4-cas-12' when 'industrie_maintenance' then 'n4-cas-13'
when 'autre' then 'n4-cas-autre' end));$function$;

-- academy_private.normalize_quiz_answer
CREATE OR REPLACE FUNCTION academy_private.normalize_quiz_answer(p_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$select lower(regexp_replace(btrim(p_text),'[[:space:]]+',' ','g'));$function$;

-- academy_private.protect_iuid
CREATE OR REPLACE FUNCTION academy_private.protect_iuid()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin
 if OLD.iuid is distinct from NEW.iuid or OLD.user_id is distinct from NEW.user_id or OLD.assigned_at is distinct from NEW.assigned_at then raise exception 'IUID permanent : modification interdite';end if;
 return NEW;end;$function$;

-- academy_private.step_open
CREATE OR REPLACE FUNCTION academy_private.step_open(p_user uuid, p_level integer, p_step integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.academy_lessons where level=p_level and step=p_step)
 and not exists(select 1 from public.academy_lessons l where l.level=p_level and l.step<p_step and not exists(
 select 1 from public.academy_progress p where p.user_id=p_user and p.level=l.level and p.step=l.step and p.done and p.requirements_version=2));$function$;

-- public.academy_acknowledge_page
CREATE OR REPLACE FUNCTION public.academy_acknowledge_page(p_level integer, p_page integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare s integer;begin
 perform academy_private.learning_lock(auth.uid(),p_level);
 select step into s from public.academy_reading_pages where level=p_level and page=p_page and required;
 if s is null or not public.academy_has_access(p_level) or not academy_private.step_open(auth.uid(),p_level,s) then raise exception 'Page non autorisée';end if;
 insert into public.academy_read_receipts(user_id,level,page) values(auth.uid(),p_level,p_page) on conflict do nothing;
end;$function$;

-- public.academy_admin_specialty
CREATE OR REPLACE FUNCTION public.academy_admin_specialty(p_user uuid, p_code text, p_confirmation text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if not public.academy_is_admin() or p_user=auth.uid() or p_confirmation is null or length(trim(p_confirmation)) not between 20 and 2000 then raise exception 'Confirmation de l’apprenant et vérification du sujet requises';end if;
 if not exists(select 1 from public.academy_specialties where code=p_code and active) then raise exception 'Spécialité inconnue';end if;
 perform academy_private.learning_lock(p_user,4);
 update public.academy_enrollments e set specialty_code=p_code from auth.users u where u.id=p_user and e.email=lower(u.email) and e.level=4;
 if not found then raise exception 'Inscription N4 inconnue';end if;
 -- Les certificats historiques gardent leur propre instantané, jamais changé ici.
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'admin_specialty',jsonb_build_object('user',p_user,'code',p_code,'confirmation',p_confirmation));
end;$function$;

-- public.academy_apply_trainer
CREATE OR REPLACE FUNCTION public.academy_apply_trainer(p_name text, p_levels integer[], p_specialties text[], p_experience text, p_sample_url text, p_availability text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v text;begin
 v:=academy_private.assign_iuid(auth.uid());
 perform pg_advisory_xact_lock(hashtextextended('trainer:'||auth.uid()::text,0));
 if p_name is null or length(trim(p_name)) not between 2 and 120
 or p_levels is null or cardinality(p_levels) not between 1 and 4 or exists(select 1 from unnest(p_levels) n where n is null or n not between 1 and 4)
 or p_specialties is null or cardinality(p_specialties)>8 or exists(select 1 from unnest(p_specialties) s where s is null or not exists(select 1 from public.academy_specialties c where c.code=s and c.active))
 or (4=any(p_levels) and cardinality(p_specialties)=0) or (not (4=any(p_levels)) and cardinality(p_specialties)>0)
 or p_experience is null or length(trim(p_experience)) not between 80 and 5000
 or p_sample_url is null or length(p_sample_url)>1000 or p_sample_url !~ '^https://[^[:space:]]+$'
 or p_availability is null or length(trim(p_availability)) not between 5 and 1000 then raise exception 'Candidature incomplète ou invalide';end if;
 if exists(select 1 from public.academy_trainer_applications where user_id=auth.uid() and state in ('approved','suspended')) then raise exception 'Contactez l’administration pour modifier votre habilitation';end if;
 insert into public.academy_trainer_applications(user_id,full_name,levels,specialties,experience,sample_url,availability)
 values(auth.uid(),trim(p_name),p_levels,p_specialties,p_experience,p_sample_url,p_availability)
 on conflict(user_id) do update set full_name=excluded.full_name,levels=excluded.levels,specialties=excluded.specialties,
 experience=excluded.experience,sample_url=excluded.sample_url,availability=excluded.availability,state='submitted',decision_feedback='',decided_by=null,updated_at=clock_timestamp();
end;$function$;

-- public.academy_archive_certificate
CREATE OR REPLACE FUNCTION public.academy_archive_certificate(p_id uuid, p_user uuid, p_version integer, p_sha256 text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare c public.academy_certificates;begin
 select * into c from public.academy_certificates where id=p_id for update;
 if not found or c.user_id<>p_user or c.revoked or c.document_version<>p_version then raise exception 'Certificat modifié ou révoqué';end if;
 insert into academy_private.certificate_documents(certificate_id,document_version,path,sha256)
 values(p_id,p_version,p_id::text||'/v'||p_version::text||'.pdf',p_sha256) on conflict(certificate_id,document_version) do nothing;
 if not exists(select 1 from academy_private.certificate_documents where certificate_id=p_id and document_version=p_version and sha256=p_sha256) then raise exception 'Archive différente : intégrité à vérifier';end if;
end;$function$;

-- public.academy_assignment_directory
CREATE OR REPLACE FUNCTION public.academy_assignment_directory()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not public.academy_is_admin() then raise exception 'Administration requise';end if;
 return jsonb_build_object(
 'trainers',coalesce((select jsonb_agg(jsonb_build_object('id',c.user_id,'name',c.full_name,'levels',c.levels,'specialties',c.specialties) order by c.full_name) from public.academy_trainer_applications c join academy_private.trainers t on t.user_id=c.user_id where c.state='approved' and t.active),'[]'::jsonb),
 'learners',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',e.full_name,'level',e.level,'specialty',e.specialty_code,'iuid',p.iuid) order by e.full_name,e.level) from auth.users u join public.academy_enrollments e on e.email=lower(u.email) left join public.academy_profiles p on p.user_id=u.id where e.status='active' and u.email_confirmed_at is not null),'[]'::jsonb));
end;$function$;

-- public.academy_can_read_dossier
CREATE OR REPLACE FUNCTION public.academy_can_read_dossier(p_user uuid, p_level integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (auth.uid()=p_user or public.academy_is_admin()
 or public.academy_can_review(p_user,p_level));$function$;

-- public.academy_can_review
CREATE OR REPLACE FUNCTION public.academy_can_review(p_user uuid, p_level integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and p_user<>auth.uid() and p_level between 1 and 4 and
 (public.academy_is_admin() or exists(select 1 from public.academy_trainer_assignments a
 join academy_private.trainers t on t.user_id=a.trainer_id
 join public.academy_trainer_applications c on c.user_id=t.user_id
 join auth.users u on u.id=a.learner_id
 join public.academy_enrollments e on e.email=lower(u.email) and e.level=a.level
 where a.trainer_id=auth.uid() and a.learner_id=p_user and a.level=p_level and a.active and t.active
 and c.state='approved' and p_level=any(c.levels)
 and (p_level<>4 or (e.specialty_code is not null and e.specialty_code=any(c.specialties)))))
 and exists(select 1 from auth.users u join public.academy_enrollments e on e.email=lower(u.email)
 where u.id=p_user and u.email_confirmed_at is not null and e.level=p_level and e.status='active');$function$;

-- public.academy_case_grading
CREATE OR REPLACE FUNCTION public.academy_case_grading(p_level integer, p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare u uuid:=coalesce(p_user,auth.uid());cases jsonb;begin
 if u=auth.uid() then if not public.academy_has_access(p_level) then raise exception 'Inscription active requise';end if;
 elsif not public.academy_can_review(u,p_level) then raise exception 'Dossier non autorisé';end if;
 select a.cases into cases from academy_private.case_assignments a where a.user_id=u and a.level=p_level;
 return jsonb_build_object('enabled',cases is not null,'cases',coalesce(cases,'[]'),'version',1);
end;$function$;

-- public.academy_certificate_document
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
end;$function$;

-- public.academy_choose_specialty
CREATE OR REPLACE FUNCTION public.academy_choose_specialty(p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin perform public.academy_choose_specialty_details(p_code,null);end;$function$;

-- public.academy_choose_specialty_details
CREATE OR REPLACE FUNCTION public.academy_choose_specialty_details(p_code text, p_other text DEFAULT NULL::text)
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
end;$function$;

-- public.academy_complete_step
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
end;$function$;

-- public.academy_correction_guide
CREATE OR REPLACE FUNCTION public.academy_correction_guide(p_user uuid, p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare code text;result jsonb;begin
 if not public.academy_can_review(p_user,p_level) then raise exception 'Guide réservé au correcteur habilité de ce dossier';end if;
 if p_level=4 then
  select e.specialty_code into code from public.academy_enrollments e join auth.users u on lower(u.email)=e.email where u.id=p_user and e.level=4;
  if code is null then raise exception 'Choix de spécialité N4 requis avant cette correction';end if;
 end if;
 select to_jsonb(g) into result from academy_private.correction_guides g where g.level=p_level and g.specialty_code is not distinct from code order by g.version desc limit 1;
 if result is null then raise exception 'Guide indisponible';end if;return result;
end;$function$;

-- public.academy_decide_trainer
CREATE OR REPLACE FUNCTION public.academy_decide_trainer(p_user uuid, p_state text, p_feedback text, p_expected_updated timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if not public.academy_is_admin() or p_user=auth.uid() then raise exception 'Décision non autorisée ; auto-approbation interdite';end if;
 if p_state is null or p_state not in ('needs_info','approved','rejected','suspended') or p_feedback is null or length(trim(p_feedback)) not between 10 and 2000 then raise exception 'Décision incomplète';end if;
 perform pg_advisory_xact_lock(hashtextextended('trainer:'||p_user::text,0));
 update public.academy_trainer_applications set state=p_state,decision_feedback=p_feedback,decided_by=auth.uid(),updated_at=clock_timestamp()
 where user_id=p_user and updated_at=p_expected_updated;
 if not found then raise exception 'Candidature modifiée ou absente : rechargez';end if;
 if p_state='approved' then
  insert into academy_private.trainers(user_id,active,approved_by) values(p_user,true,auth.uid())
  on conflict(user_id) do update set active=true,approved_by=auth.uid(),updated_at=now();
 else
  update academy_private.trainers set active=false,updated_at=now() where user_id=p_user;
  update public.academy_trainer_assignments set active=false,updated_at=now() where trainer_id=p_user;
 end if;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'trainer_decision',jsonb_build_object('user',p_user,'state',p_state));
end;$function$;

-- public.academy_dossier_history
CREATE OR REPLACE FUNCTION public.academy_dossier_history(p_user uuid, p_level integer, p_before bigint DEFAULT NULL::bigint)
 RETURNS TABLE(id bigint, table_name text, operation text, previous_row jsonb, current_row jsonb, actor uuid, changed_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if not public.academy_can_read_dossier(p_user,p_level) then raise exception 'Dossier non autorisé';end if;
 return query select h.id,h.table_name,h.operation,h.previous_row,h.current_row,h.actor,h.changed_at
 from academy_private.dossier_history h where h.user_id=p_user and h.level=p_level
 and (p_before is null or h.id<p_before) order by h.id desc limit 50;
end;$function$;

-- public.academy_draft_exam
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
end;$function$;

-- public.academy_enable_case_grading
CREATE OR REPLACE FUNCTION public.academy_enable_case_grading(p_user uuid, p_level integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare cases jsonb;begin
 if not public.academy_is_admin() or not public.academy_can_review(p_user,p_level) then raise exception 'Activation administrative non autorisée';end if;
 perform academy_private.learning_lock(p_user,p_level);
 if exists(select 1 from academy_private.case_assignments where user_id=p_user and level=p_level) then return;end if;
 if not academy_private.final_module_enabled(p_user,p_level) then raise exception 'Parcours avec quiz requis';end if;
 if exists(select 1 from public.academy_assessments where user_id=p_user and level=p_level)
 or exists(select 1 from public.academy_certificates where user_id=p_user and level=p_level)
 or exists(select 1 from public.academy_work w join public.academy_requirements r on r.id=w.requirement_id where w.user_id=p_user and r.level=p_level and r.kind in ('cas','fil_rouge')) then raise exception 'Les poids doivent être fixés avant toute remise finale';end if;
 select jsonb_agg(jsonb_build_object('id',id,'title',title,'weight',1,'page',page) order by id) into cases from public.academy_requirements where level=p_level and kind='cas';
 if cases is null then raise exception 'Catalogue des cas indisponible';end if;
 insert into academy_private.case_assignments(user_id,level,cases,created_by) values(p_user,p_level,cases,auth.uid());
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'enable_case_grading',jsonb_build_object('user',p_user,'level',p_level,'cases',cases));
end;$function$;

-- public.academy_enable_exam
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
end;$function$;

-- public.academy_enable_quizzes
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
end;$function$;

-- public.academy_ensure_profile
CREATE OR REPLACE FUNCTION public.academy_ensure_profile()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v text;begin
 v:=academy_private.assign_iuid(auth.uid());
 return (select to_jsonb(p) from public.academy_profiles p where p.user_id=auth.uid());
end;$function$;

-- public.academy_exam_banks
CREATE OR REPLACE FUNCTION public.academy_exam_banks()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if not public.academy_is_admin() then raise exception 'Administration pédagogique requise';end if;
 return coalesce((select jsonb_agg(to_jsonb(e) order by created_at desc) from academy_private.exam_versions e),'[]');end;$function$;

-- public.academy_exam_remediation
CREATE OR REPLACE FUNCTION public.academy_exam_remediation(p_user uuid, p_level integer, p_feedback text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare a academy_private.exam_assignments;used integer;begin
 if not public.academy_can_review(p_user,p_level) then raise exception 'Dossier non autorisé';end if;
 if p_feedback is null or length(trim(p_feedback)) not between 30 and 3000 then raise exception 'Remédiation motivée requise';end if;
 perform academy_private.learning_lock(p_user,p_level);
 select * into a from academy_private.exam_assignments where user_id=p_user and level=p_level for update;
 if a.exam_id is null or a.attempt_limit>=3 then raise exception 'Rattrapage indisponible';end if;
 if a.attempt_limit=2 and not public.academy_is_admin() then raise exception 'Troisième tentative réservée à une décision administrative';end if;
 select count(*) into used from academy_private.exam_attempts where user_id=p_user and level=p_level and submitted_at is not null;
 if used<a.attempt_limit or exists(select 1 from academy_private.exam_attempts where user_id=p_user and level=p_level and score>=case when p_level in (1,3) then 28 else 21 end) then raise exception 'Rattrapage indisponible';end if;
 update academy_private.exam_assignments set attempt_limit=attempt_limit+1 where user_id=p_user and level=p_level;
 insert into academy_private.exam_remediations(user_id,level,actor,feedback,new_limit) values(p_user,p_level,auth.uid(),trim(p_feedback),a.attempt_limit+1);
end;$function$;

-- public.academy_exam_status
CREATE OR REPLACE FUNCTION public.academy_exam_status(p_level integer, p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare u uuid:=coalesce(p_user,auth.uid());a academy_private.exam_assignments;used integer;best integer;open_id uuid;begin
 if u=auth.uid() then if not public.academy_has_access(p_level) then raise exception 'Inscription active requise';end if;
 elsif not public.academy_can_review(u,p_level) then raise exception 'Dossier non autorisé';end if;
 select * into a from academy_private.exam_assignments where user_id=u and level=p_level;
 if a.exam_id is null then return jsonb_build_object('enabled',false);end if;
 select count(*),max(score) into used,best from academy_private.exam_attempts where user_id=u and level=p_level;
 select id into open_id from academy_private.exam_attempts where user_id=u and level=p_level and submitted_at is null;
 return jsonb_build_object('enabled',true,'ready',academy_private.course_ready(u,p_level),'used',used,'limit',a.attempt_limit,'best',best,'maximum',case when p_level in (1,3) then 40 else 30 end,'minimum',case when p_level in (1,3) then 28 else 21 end,'open_id',open_id,
 'attempts',(select coalesce(jsonb_agg(jsonb_build_object('number',t.number,'score',t.score,'submitted_at',t.submitted_at) order by t.number),'[]') from academy_private.exam_attempts t where t.user_id=u and t.level=p_level));
end;$function$;

-- public.academy_final_module
CREATE OR REPLACE FUNCTION public.academy_final_module(p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_specialty_code text; métier text;subject jsonb;begin
 if not public.academy_has_access(p_level) then raise exception 'Inscription active requise';end if;
 if p_level=4 then select e.specialty_code,e.specialty_other into v_specialty_code,métier from public.academy_enrollments e join auth.users u on lower(u.email)=e.email where u.id=auth.uid() and e.level=4;select jsonb_build_object('code',s.code,'title',case when s.code='autre' then s.title||' : '||métier else s.title end,'brief',s.brief) into subject from public.academy_specialties s where s.code=v_specialty_code;end if;
 return jsonb_build_object('enabled',academy_private.final_module_enabled(auth.uid(),p_level),'ready',academy_private.course_ready(auth.uid(),p_level),'specialty',subject,'required_ids',case when p_level=4 then (select jsonb_agg(r.id) from public.academy_requirements r where r.level=4 and academy_private.n4_requirement(auth.uid(),r.id)) else null end);
end;$function$;

-- public.academy_grade
CREATE OR REPLACE FUNCTION public.academy_grade(p_user uuid, p_level integer, p_quiz integer, p_project integer, p_feedback text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if exists(select 1 from academy_private.quiz_assignments where user_id=p_user and level=p_level) then raise exception 'Utilisez la grille de correction du parcours';end if;
 return academy_private.grade_core(p_user,p_level,p_quiz,p_project,p_feedback);
end;$function$;

-- public.academy_grade_n4
CREATE OR REPLACE FUNCTION public.academy_grade_n4(p_user uuid, p_scores jsonb, p_feedback text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
return result;end;$function$;

-- public.academy_grade_with_cases
CREATE OR REPLACE FUNCTION public.academy_grade_with_cases(p_user uuid, p_level integer, p_quiz integer, p_guide uuid, p_cases jsonb, p_fil jsonb, p_feedback text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare plan jsonb;guide jsonb;c jsonb;r jsonb;s jsonb;part integer;weighted integer:=0;weights integer:=0;fil integer:=0;total numeric;cid uuid;case_totals jsonb:='{}';begin
 if not public.academy_can_review(p_user,p_level) then raise exception 'Correction non autorisée';end if;
 perform academy_private.learning_lock(p_user,p_level);
 select cases into plan from academy_private.case_assignments where user_id=p_user and level=p_level;
 if plan is null then raise exception 'Notation par cas non activée';end if;
 guide:=public.academy_correction_guide(p_user,p_level);
 if p_guide is null or (guide->>'id')::uuid<>p_guide then raise exception 'Guide modifié : rechargez';end if;
 if jsonb_typeof(p_cases) is distinct from 'object' or jsonb_typeof(p_fil) is distinct from 'object' then raise exception 'Grilles des cas et fil rouge requises';end if;
 if (select count(*) from jsonb_object_keys(p_cases))<>jsonb_array_length(plan) then raise exception 'Tous les cas doivent être notés';end if;
 if (select count(*) from jsonb_object_keys(p_fil))<>(select count(*) from jsonb_array_elements(guide->'criteria') item where item->>'group'='fil_rouge') then raise exception 'Tous les critères du fil rouge sont requis';end if;
 for r in select value from jsonb_array_elements(plan) loop
  if jsonb_typeof(p_cases->(r->>'id')) is distinct from 'object' then raise exception 'Grille de cas manquante';end if;
  if (select count(*) from jsonb_object_keys(p_cases->(r->>'id')))<>(select count(*) from jsonb_array_elements(guide->'criteria') item where item->>'group'='cas') then raise exception 'Tous les critères de chaque cas sont requis';end if;
  part:=0;
  for c in select value from jsonb_array_elements(guide->'criteria') where value->>'group'='cas' loop
   s:=p_cases->(r->>'id')->(c->>'id');
   if jsonb_typeof(s->'points') is distinct from 'number' or (s->>'points')!~'^[0-9]{1,2}$' or jsonb_typeof(s->'feedback') is distinct from 'string' or length(trim(s->>'feedback')) not between 10 and 1000 then raise exception 'Points entiers et justification requis pour chaque critère';end if;
   if (s->>'points')::integer>(c->>'max')::integer then raise exception 'Note de cas hors barème';end if;
   part:=part+(s->>'points')::integer;
  end loop;
  weighted:=weighted+part*(r->>'weight')::integer;weights:=weights+(r->>'weight')::integer;
  case_totals:=case_totals||jsonb_build_object(r->>'id',part);
 end loop;
 for c in select value from jsonb_array_elements(guide->'criteria') where value->>'group'='fil_rouge' loop
  s:=p_fil->(c->>'id');
  if jsonb_typeof(s->'points') is distinct from 'number' or (s->>'points')!~'^[0-9]{1,2}$' or jsonb_typeof(s->'feedback') is distinct from 'string' or length(trim(s->>'feedback')) not between 10 and 1000 then raise exception 'Points entiers et justification requis pour le fil rouge';end if;
  if (s->>'points')::integer>(c->>'max')::integer then raise exception 'Note du fil rouge hors barème';end if;
  fil:=fil+(s->>'points')::integer;
 end loop;
 total:=weighted::numeric/weights+fil;
 cid:=academy_private.grade_core(p_user,p_level,p_quiz,total,p_feedback);
 update public.academy_assessments set evidence=evidence||jsonb_build_object('rubric',guide,'case_plan',plan,'case_criteria',p_cases,'case_totals',case_totals,'case_numerator',weighted,'case_denominator',weights,'case_average',weighted::numeric/weights,'fil_criteria',p_fil,'fil_total',fil,'practical_total',total) where user_id=p_user and level=p_level;
 return cid;
end;$function$;

-- public.academy_grade_with_rubric
CREATE OR REPLACE FUNCTION public.academy_grade_with_rubric(p_user uuid, p_level integer, p_quiz integer, p_guide uuid, p_scores jsonb, p_feedback text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if exists(select 1 from academy_private.case_assignments where user_id=p_user and level=p_level) then raise exception 'Correction individuelle de chaque cas requise';end if;
 return academy_private.grade_rubric_legacy(p_user,p_level,p_quiz,p_guide,p_scores,p_feedback);
end;$function$;

-- public.academy_has_access
CREATE OR REPLACE FUNCTION public.academy_has_access(p_level integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from auth.users u join public.academy_enrollments e on e.email=lower(u.email)
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null and e.level=p_level and e.status='active'); $function$;

-- public.academy_is_admin
CREATE OR REPLACE FUNCTION public.academy_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from academy_private.admins where user_id=(select auth.uid())); $function$;

-- public.academy_is_trainer
CREATE OR REPLACE FUNCTION public.academy_is_trainer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from academy_private.trainers t where t.user_id=auth.uid() and t.active);$function$;

-- public.academy_n4_context
CREATE OR REPLACE FUNCTION public.academy_n4_context(p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=coalesce(p_user,auth.uid()); result jsonb;begin
if u=auth.uid() then if not public.academy_has_access(4) then raise exception 'Inscription active requise';end if;
elsif not public.academy_can_review(u,4) then raise exception 'Dossier non autorisé';end if;
select jsonb_build_object('title',case when e.specialty_code='autre' then s.title||' : '||e.specialty_other else s.title end,'brief',s.brief,
'required_ids',(select jsonb_agg(r.id) from public.academy_requirements r where r.level=4 and academy_private.n4_requirement(u,r.id)))
into result from public.academy_enrollments e join auth.users a on lower(a.email)=e.email left join public.academy_specialties s on s.code=e.specialty_code where a.id=u and e.level=4;
return result;end;$function$;

-- public.academy_prerequisites
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
end;$function$;

-- public.academy_publish_exam
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
end;$function$;

-- public.academy_publish_quiz
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
end;$function$;

-- public.academy_quiz_remediation
CREATE OR REPLACE FUNCTION public.academy_quiz_remediation(p_user uuid, p_level integer, p_step integer, p_feedback text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare a academy_private.quiz_assignments;used integer;begin
 if not public.academy_can_review(p_user,p_level) then raise exception 'Remédiation non autorisée';end if;
 if p_feedback is null or length(trim(p_feedback)) not between 30 and 3000 then raise exception 'Compte rendu de remédiation requis (30 caractères minimum)';end if;
 perform academy_private.learning_lock(p_user,p_level);
 select * into a from academy_private.quiz_assignments where user_id=p_user and level=p_level and step=p_step for update;
 if a.quiz_id is null then raise exception 'Quiz non activé';end if;
 select count(*) into used from academy_private.quiz_attempts where user_id=p_user and level=p_level and step=p_step and submitted_at is not null;
 if used<a.attempt_limit or a.attempt_limit>=30 or exists(select 1 from academy_private.quiz_attempts where user_id=p_user and level=p_level and step=p_step and score>=14) then raise exception 'Remédiation non disponible';end if;
 update academy_private.quiz_assignments set attempt_limit=attempt_limit+1 where user_id=p_user and level=p_level and step=p_step;
 insert into academy_private.quiz_remediations(user_id,level,step,trainer_id,feedback,new_limit) values(p_user,p_level,p_step,auth.uid(),trim(p_feedback),a.attempt_limit+1);
end;$function$;

-- public.academy_quiz_status
CREATE OR REPLACE FUNCTION public.academy_quiz_status(p_level integer, p_step integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare a academy_private.quiz_assignments;used integer;best integer;open_id uuid;begin
 if not public.academy_has_access(p_level) then raise exception 'Inscription active requise';end if;
 select * into a from academy_private.quiz_assignments where user_id=auth.uid() and level=p_level and step=p_step;
 if a.quiz_id is null then return jsonb_build_object('enabled',false);end if;
 select count(*),max(score) into used,best from academy_private.quiz_attempts where user_id=auth.uid() and level=p_level and step=p_step;
 select id into open_id from academy_private.quiz_attempts where user_id=auth.uid() and level=p_level and step=p_step and submitted_at is null;
 return jsonb_build_object('enabled',true,'used',used,'limit',a.attempt_limit,'best',best,'passed',coalesce(best>=14,false),'open_id',open_id,'remediation',used>=a.attempt_limit and open_id is null and coalesce(best,0)<14);
end;$function$;

-- public.academy_review_exam
CREATE OR REPLACE FUNCTION public.academy_review_exam(p_user uuid, p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if not public.academy_can_review(p_user,p_level) then raise exception 'Dossier non autorisé';end if;
 return jsonb_build_object('attempts',(select coalesce(jsonb_agg(to_jsonb(t) order by number),'[]') from academy_private.exam_attempts t where user_id=p_user and level=p_level),'remediations',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from academy_private.exam_remediations r where user_id=p_user and level=p_level));
end;$function$;

-- public.academy_review_work
CREATE OR REPLACE FUNCTION public.academy_review_work(p_user uuid, p_requirement text, p_state text, p_feedback text, p_expected_updated timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare r public.academy_requirements;begin
 select * into r from public.academy_requirements where id=p_requirement;
 if r.id is null or not public.academy_can_review(p_user,r.level) then raise exception 'Correction non autorisée ; auto-correction interdite';end if;
 if p_state is null or p_state not in ('accepted','revision') or p_feedback is null or length(trim(p_feedback)) not between 10 and 5000 then raise exception 'Décision ou retour invalide';end if;
 perform academy_private.learning_lock(p_user,r.level);
 update public.academy_work set state=p_state,feedback=p_feedback,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=clock_timestamp()
 where user_id=p_user and requirement_id=p_requirement and updated_at=p_expected_updated;
 if not found then raise exception 'Travail modifié ou absent : rechargez avant de corriger';end if;
 if p_state='revision' then
 if academy_private.final_module_enabled(p_user,r.level) and r.kind in ('cas','fil_rouge') then update public.academy_certificates set revoked=true where user_id=p_user and level=r.level;
 else perform academy_private.invalidate_learning(p_user,r.level,r.step);end if;end if;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'review_work',jsonb_build_object('user',p_user,'requirement',p_requirement,'state',p_state));
end;$function$;

-- public.academy_save_notes
CREATE OR REPLACE FUNCTION public.academy_save_notes(p_level integer, p_step integer, p_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare previous text;begin
 perform academy_private.learning_lock(auth.uid(),p_level);
 if not public.academy_has_access(p_level) or not academy_private.step_open(auth.uid(),p_level,p_step) then raise exception 'Étape non autorisée';end if;
 if p_notes is null or length(p_notes)>20000 then raise exception 'Carnet invalide';end if;
 select notes into previous from public.academy_progress where user_id=auth.uid() and level=p_level and step=p_step;
 if previous is distinct from p_notes then perform academy_private.invalidate_learning(auth.uid(),p_level,p_step);end if;
 insert into public.academy_progress(user_id,level,step,notes,done,requirements_version) values(auth.uid(),p_level,p_step,p_notes,false,2)
 on conflict(user_id,level,step) do update set notes=excluded.notes,updated_at=now();
end;$function$;

-- public.academy_set_enrollment
CREATE OR REPLACE FUNCTION public.academy_set_enrollment(p_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not public.academy_is_admin() or p_status not in ('active','revoked','pending') then raise exception 'Non autorisé'; end if;
 update public.academy_enrollments set status=p_status where id=p_id;
 if not found then raise exception 'Inscription inconnue'; end if;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'enrollment',jsonb_build_object('id',p_id,'status',p_status));
end; $function$;

-- public.academy_set_trainer_assignment
CREATE OR REPLACE FUNCTION public.academy_set_trainer_assignment(p_trainer uuid, p_learner uuid, p_level integer, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if not public.academy_is_admin() or p_active is null or p_trainer is null or p_learner is null or p_level is null or p_level not between 1 and 4 or p_trainer=p_learner then raise exception 'Affectation non autorisée';end if;
 perform pg_advisory_xact_lock(hashtextextended('trainer:'||p_trainer::text,0));
 if not p_active then
  update public.academy_trainer_assignments set active=false,assigned_by=auth.uid(),updated_at=now() where trainer_id=p_trainer and learner_id=p_learner and level=p_level;
 else
  if not exists(select 1 from academy_private.trainers t join public.academy_trainer_applications c on c.user_id=t.user_id
   join auth.users u on u.id=p_learner join public.academy_enrollments e on e.email=lower(u.email) and e.level=p_level
   where t.user_id=p_trainer and t.active and c.state='approved' and p_level=any(c.levels)
   and e.status='active' and u.email_confirmed_at is not null
   and (p_level<>4 or e.specialty_code=any(c.specialties))) then raise exception 'Habilitation ou inscription incompatible avec ce dossier';end if;
  insert into public.academy_trainer_assignments(trainer_id,learner_id,level,active,assigned_by)
  values(p_trainer,p_learner,p_level,true,auth.uid()) on conflict(trainer_id,learner_id,level)
  do update set active=true,assigned_by=excluded.assigned_by,updated_at=now();
 end if;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'trainer_assignment',jsonb_build_object('trainer',p_trainer,'learner',p_learner,'level',p_level,'active',p_active));
end;$function$;

-- public.academy_start_exam
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
end;$function$;

-- public.academy_start_quiz
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
end;$function$;

-- public.academy_submit_exam
CREATE OR REPLACE FUNCTION public.academy_submit_exam(p_attempt uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t academy_private.exam_attempts;q jsonb;a jsonb;x jsonb;i integer:=0;total integer:=0;detail jsonb:='[]';points integer;begin
 select * into t from academy_private.exam_attempts where id=p_attempt and user_id=auth.uid();
 if t.id is null or not public.academy_has_access(t.level) then raise exception 'Tentative non autorisée';end if;
 perform academy_private.learning_lock(auth.uid(),t.level);
 select * into t from academy_private.exam_attempts where id=p_attempt for update;
 if t.submitted_at is null then
  if not academy_private.course_ready(auth.uid(),t.level) then raise exception 'Parcours devenu incomplet';end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'Réponses requises';end if;
  if jsonb_array_length(p_answers)<>jsonb_array_length(t.questions) or octet_length(p_answers::text)>16000 then raise exception 'Réponses invalides';end if;
  for q in select value from jsonb_array_elements(t.questions) loop
   a:=p_answers->i;points:=0;
   if jsonb_typeof(a)<>'array' then raise exception 'Choix requis';end if;
   if jsonb_array_length(a)>jsonb_array_length(q->'options') then raise exception 'Trop de choix';end if;
   for x in select value from jsonb_array_elements(a) loop
    if jsonb_typeof(x)<>'number' or x::text!~'^[0-7]$' then raise exception 'Choix invalide';end if;
    if x::text::integer>=jsonb_array_length(q->'options') then raise exception 'Choix hors options';end if;
   end loop;
   if (select count(distinct value) from jsonb_array_elements(a))<>jsonb_array_length(a) then raise exception 'Choix répété';end if;
   if a @> (q->'correct') and (q->'correct') @> a then points:=2;end if;
   total:=total+points;detail:=detail||jsonb_build_array(points);i:=i+1;
  end loop;
  update academy_private.exam_attempts set answers=p_answers,score=total,points=detail,submitted_at=clock_timestamp() where id=t.id returning * into t;
  insert into academy_private.audit(actor,action,details) values(auth.uid(),'submit_exam',jsonb_build_object('attempt',t.id,'score',t.score));
 end if;
 -- Pas de corrigé ni de détail par question dans la réponse de l'examen certificatif.
 return jsonb_build_object('score',t.score,'maximum',case when t.level in (1,3) then 40 else 30 end,'passed',t.score>=case when t.level in (1,3) then 28 else 21 end);
end;$function$;

-- public.academy_submit_project
CREATE OR REPLACE FUNCTION public.academy_submit_project(p_level integer, p_submission text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare previous text;canonical text;begin
 perform academy_private.learning_lock(auth.uid(),p_level);
 if academy_private.final_module_enabled(auth.uid(),p_level) then
 if not public.academy_has_access(p_level) then raise exception 'Inscription active requise';end if;
 select w.answer into canonical from public.academy_work w join public.academy_requirements r on r.id=w.requirement_id where w.user_id=auth.uid() and r.level=p_level and r.kind='fil_rouge';
 if canonical is null or canonical is distinct from p_submission then raise exception 'Remettez votre fil rouge dans le module final ; aucune copie distincte du projet n’est requise';end if;return;end if;
 if not public.academy_has_access(p_level) or not (public.academy_prerequisites(p_level)->>'ready')::boolean then raise exception 'Terminez toutes les lectures, carnets et remises avant le projet final';end if;
 if p_submission is null or length(trim(p_submission)) not between 200 and 30000 then raise exception 'Dossier final : 200 à 30000 caractères';end if;
 select submission into previous from public.academy_projects where user_id=auth.uid() and level=p_level;
 if previous is distinct from p_submission then
 update public.academy_certificates set revoked=true where user_id=auth.uid() and level=p_level;
 end if;
 insert into public.academy_projects(user_id,level,submission) values(auth.uid(),p_level,p_submission)
 on conflict(user_id,level) do update set submission=excluded.submission,updated_at=now();
end;$function$;

-- public.academy_submit_quiz
CREATE OR REPLACE FUNCTION public.academy_submit_quiz(p_attempt uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare t academy_private.quiz_attempts;q jsonb;a jsonb;choice jsonb;bank jsonb;i integer:=0;points integer;total integer:=0;detail jsonb:='[]';begin
 select * into t from academy_private.quiz_attempts where id=p_attempt and user_id=auth.uid();
 if t.id is null or not public.academy_has_access(t.level) then raise exception 'Tentative non autorisée';end if;
 perform academy_private.learning_lock(auth.uid(),t.level);
 select * into t from academy_private.quiz_attempts where id=p_attempt for update;
 if t.submitted_at is not null then return jsonb_build_object('score',t.score,'points',t.points,'passed',t.score>=14);end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'Liste de réponses requise';end if;
 if jsonb_array_length(p_answers)<>7 or octet_length(p_answers::text)>16000 then raise exception 'Sept réponses requises';end if;
 select questions into bank from academy_private.quiz_versions where id=t.quiz_id;
 for q in select value from jsonb_array_elements(bank) loop
  a:=p_answers->i;points:=0;
  if q->>'type'='qcm' then
   if jsonb_typeof(a)<>'array' then raise exception 'Liste de choix requise';end if;
   if jsonb_array_length(a)>jsonb_array_length(q->'options') then raise exception 'Trop de choix';end if;
   for choice in select value from jsonb_array_elements(a) loop
    if jsonb_typeof(choice)<>'number' or choice::text!~'^[0-7]$' then raise exception 'Choix invalide';end if;
    if (choice::text)::integer>=jsonb_array_length(q->'options') then raise exception 'Choix hors options';end if;
   end loop;
   if (select count(distinct value) from jsonb_array_elements(a))<>jsonb_array_length(a) then raise exception 'Choix répété';end if;
   if a @> (q->'correct') and (q->'correct') @> a then points:=2;end if;
  else
   if jsonb_typeof(a)<>'string' or length(a#>>'{}')>1000 then raise exception 'Réponse courte invalide';end if;
   if exists(select 1 from jsonb_array_elements_text(q->'variants') v where academy_private.normalize_quiz_answer(v)=academy_private.normalize_quiz_answer(a#>>'{}')) then points:=5;end if;
  end if;
  total:=total+points;detail:=detail||jsonb_build_array(points);i:=i+1;
 end loop;
 update academy_private.quiz_attempts set answers=p_answers,score=total,points=detail,submitted_at=clock_timestamp() where id=t.id;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'submit_quiz',jsonb_build_object('attempt',t.id,'score',total));
 return jsonb_build_object('score',total,'points',detail,'passed',total>=14);
end;$function$;

-- public.academy_submit_work
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
end;$function$;

-- public.academy_sync_enrollment
CREATE OR REPLACE FUNCTION public.academy_sync_enrollment(p_event text, p_email text, p_name text, p_level integer, p_specialty text DEFAULT NULL::text)
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
 insert into academy_private.events(event_id) values(p_event) on conflict do nothing;
 if not found then return;end if;
 -- Une nouvelle réponse ne modifie jamais une inscription existante, même révoquée.
 insert into public.academy_enrollments(email,level,full_name,source_id,specialty_code,specialty_required)
 values(lower(trim(p_email)),p_level,trim(p_name),p_event,p_specialty,p_level=4)
 on conflict(email,level) do nothing;
end;$function$;

-- public.academy_sync_enrollment_details
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
end;$function$;

-- public.academy_teaches_level
CREATE OR REPLACE FUNCTION public.academy_teaches_level(p_level integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.academy_trainer_assignments a
 where a.trainer_id=auth.uid() and a.level=p_level and public.academy_can_review(a.learner_id,a.level));$function$;

-- public.academy_trainer_dossier
CREATE OR REPLACE FUNCTION public.academy_trainer_dossier(p_user uuid, p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result jsonb;
begin
 if auth.uid() is null or not public.academy_can_review(p_user,p_level) then raise exception 'Dossier non autorisé';end if;
 select jsonb_build_object('user_id',p_user,'level',p_level,'full_name',e.full_name,'iuid',p.iuid,
 'specialty',case when p_level=4 then public.academy_n4_context(p_user) else null end,
 'checks',public.academy_prerequisites(p_level,p_user),
 'requirements',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('work',(select to_jsonb(w) from public.academy_work w where w.user_id=p_user and w.requirement_id=r.id)) order by r.step,r.id) from public.academy_requirements r where r.level=p_level and (p_level<>4 or academy_private.n4_requirement(p_user,r.id))),'[]'::jsonb),
 'notes',coalesce((select jsonb_agg(jsonb_build_object('step',pr.step,'notes',pr.notes,'done',pr.done,'updated_at',pr.updated_at) order by pr.step) from public.academy_progress pr where pr.user_id=p_user and pr.level=p_level),'[]'::jsonb),
 'certificate',(select jsonb_build_object('id',c.id,'issued_at',c.issued_at,'revoked',c.revoked) from public.academy_certificates c where c.user_id=p_user and c.level=p_level order by c.issued_at desc limit 1)) into v_result
 from auth.users u join public.academy_enrollments e on e.email=lower(u.email) and e.level=p_level left join public.academy_profiles p on p.user_id=u.id where u.id=p_user;
 return v_result;
end;$function$;

-- public.academy_trainer_quizzes
CREATE OR REPLACE FUNCTION public.academy_trainer_quizzes(p_user uuid, p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if not public.academy_can_review(p_user,p_level) then raise exception 'Dossier non autorisé';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('step',a.step,'version',q.version,'questions',q.questions,'limit',a.attempt_limit,
 'attempts',(select coalesce(jsonb_agg(to_jsonb(t) order by t.number),'[]') from academy_private.quiz_attempts t where t.user_id=p_user and t.level=p_level and t.step=a.step),
 'remediations',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from academy_private.quiz_remediations r where r.user_id=p_user and r.level=p_level and r.step=a.step)) order by a.step)
 from academy_private.quiz_assignments a join academy_private.quiz_versions q on q.id=a.quiz_id where a.user_id=p_user and a.level=p_level),'[]');
end;$function$;

-- public.academy_trainer_workspace
CREATE OR REPLACE FUNCTION public.academy_trainer_workspace(p_search text DEFAULT ''::text, p_level integer DEFAULT NULL::integer, p_state text DEFAULT 'all'::text, p_page integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result jsonb; v_admin boolean:=public.academy_is_admin();
begin
 if auth.uid() is null or not (v_admin or public.academy_is_trainer()) then raise exception 'Espace réservé aux formateurs habilités'; end if;
 if p_page is null or p_page<0 or p_page>10000 or length(coalesce(p_search,''))>120 or (p_level is not null and p_level not between 1 and 4) or p_state is null or p_state not in ('all','pending','revision','certified') then raise exception 'Filtres invalides'; end if;
 with scoped as materialized (
 select u.id as user_id,e.level,e.full_name,p.iuid,
 case when e.specialty_code='autre' then s.title||' : '||e.specialty_other else s.title end as specialty,
 (select count(*) from public.academy_work w join public.academy_requirements r on r.id=w.requirement_id where w.user_id=u.id and r.level=e.level and w.state='submitted' and (e.level<>4 or academy_private.n4_requirement(u.id,r.id))) as pending,
 (select count(*) from public.academy_work w join public.academy_requirements r on r.id=w.requirement_id where w.user_id=u.id and r.level=e.level and w.state='revision' and (e.level<>4 or academy_private.n4_requirement(u.id,r.id))) as revision,
 (select count(*) from public.academy_progress pr where pr.user_id=u.id and pr.level=e.level and pr.done) as completed_steps,
 (select count(*) from public.academy_lessons l where l.level=e.level) as total_steps,
 exists(select 1 from public.academy_certificates c where c.user_id=u.id and c.level=e.level and not c.revoked) as certified,
 greatest(e.created_at,(select max(w.updated_at) from public.academy_work w join public.academy_requirements r on r.id=w.requirement_id where w.user_id=u.id and r.level=e.level)) as updated_at
 from public.academy_enrollments e join auth.users u on lower(u.email)=e.email
 left join public.academy_profiles p on p.user_id=u.id left join public.academy_specialties s on s.code=e.specialty_code
 where public.academy_can_review(u.id,e.level)
 ), filtered as materialized (
 select * from scoped d where (p_level is null or d.level=p_level)
 and (coalesce(p_search,'')='' or strpos(lower(concat_ws(' ',d.full_name,d.iuid,d.specialty)),lower(p_search))>0)
 and (p_state='all' or (p_state='pending' and d.pending>0) or (p_state='revision' and d.revision>0) or (p_state='certified' and d.certified))
 ), page_rows as (select * from filtered order by pending desc,updated_at desc,user_id,level limit 20 offset p_page*20)
 select jsonb_build_object('admin',v_admin,'total',(select count(*) from filtered),'page',p_page,'page_size',20,
 'stats',jsonb_build_object('learners',(select count(distinct user_id) from scoped),'dossiers',(select count(*) from scoped),'pending',(select coalesce(sum(pending),0) from scoped),'certified',(select count(*) from scoped where certified)),
 'items',coalesce((select jsonb_agg(to_jsonb(d) order by d.pending desc,d.updated_at desc,d.user_id,d.level) from page_rows d),'[]'::jsonb)) into v_result;
 return v_result;
end;$function$;

-- public.academy_tutor_quota
CREATE OR REPLACE FUNCTION public.academy_tutor_quota(p_level integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer; total integer;
begin
 if not public.academy_has_access(p_level) then return false; end if;
 perform pg_advisory_xact_lock(810032026);
 select coalesce(sum(calls),0) into total from academy_private.tutor_usage where day=current_date;
 select calls into n from academy_private.tutor_usage where user_id=auth.uid() and day=current_date;
 if coalesce(n,0)>=30 or total>=200 then return false; end if;
 insert into academy_private.tutor_usage values(auth.uid(),current_date,1) on conflict(user_id,day) do update set calls=academy_private.tutor_usage.calls+1;
 return true;
end; $function$;

-- public.academy_verify_certificate
CREATE OR REPLACE FUNCTION public.academy_verify_certificate(p_id uuid)
 RETURNS TABLE(id uuid, level integer, issued_at timestamp with time zone, valid boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select c.id,c.level,c.issued_at,not c.revoked from public.academy_certificates c where c.id=p_id; $function$;
