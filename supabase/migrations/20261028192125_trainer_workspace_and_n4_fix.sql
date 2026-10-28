CREATE OR REPLACE FUNCTION public.academy_final_module(p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_specialty_code text; métier text;subject jsonb;begin
 if not public.academy_has_access(p_level) then raise exception 'Inscription active requise';end if;
 if p_level=4 then select e.specialty_code,e.specialty_other into v_specialty_code,métier from public.academy_enrollments e join auth.users u on lower(u.email)=e.email where u.id=auth.uid() and e.level=4;select jsonb_build_object('code',s.code,'title',case when s.code='autre' then s.title||' : '||métier else s.title end,'brief',s.brief) into subject from public.academy_specialties s where s.code=v_specialty_code;end if;
 return jsonb_build_object('enabled',academy_private.final_module_enabled(auth.uid(),p_level),'ready',academy_private.course_ready(auth.uid(),p_level),'specialty',subject,'required_ids',case when p_level=4 then (select jsonb_agg(r.id) from public.academy_requirements r where r.level=4 and academy_private.n4_requirement(auth.uid(),r.id)) else null end);
end;$function$

-- Read APIs for the trainer workspace. Existing write APIs retain their checks.
create or replace function public.academy_trainer_workspace(p_search text default '', p_level integer default null, p_state text default 'all', p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
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
end;$$;
revoke all on function public.academy_trainer_workspace(text,integer,text,integer) from public,anon;
grant execute on function public.academy_trainer_workspace(text,integer,text,integer) to authenticated;

create or replace function public.academy_trainer_dossier(p_user uuid,p_level integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
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
end;$$;
revoke all on function public.academy_trainer_dossier(uuid,integer) from public,anon;
grant execute on function public.academy_trainer_dossier(uuid,integer) to authenticated;

create or replace function public.academy_assignment_directory()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.academy_is_admin() then raise exception 'Administration requise';end if;
 return jsonb_build_object(
 'trainers',coalesce((select jsonb_agg(jsonb_build_object('id',c.user_id,'name',c.full_name,'levels',c.levels,'specialties',c.specialties) order by c.full_name) from public.academy_trainer_applications c join academy_private.trainers t on t.user_id=c.user_id where c.state='approved' and t.active),'[]'::jsonb),
 'learners',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',e.full_name,'level',e.level,'specialty',e.specialty_code,'iuid',p.iuid) order by e.full_name,e.level) from auth.users u join public.academy_enrollments e on e.email=lower(u.email) left join public.academy_profiles p on p.user_id=u.id where e.status='active' and u.email_confirmed_at is not null),'[]'::jsonb));
end;$$;
revoke all on function public.academy_assignment_directory() from public,anon;
grant execute on function public.academy_assignment_directory() to authenticated;
