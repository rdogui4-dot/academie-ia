-- Exécuter dans un projet Supabase neuf ou dédié. Pas de suppression de données existantes.
create schema if not exists academy_private;
revoke all on schema academy_private from public, anon, authenticated;
create table academy_private.admins(user_id uuid primary key references auth.users(id));
create table public.academy_enrollments(
 id uuid primary key default gen_random_uuid(), email text not null check(email=lower(trim(email))),
 level integer not null check(level between 1 and 4), full_name text not null,
 status text not null default 'pending' check(status in ('pending','active','revoked')),
 source_id text not null unique, created_at timestamptz not null default now(),
 unique(email,level));
create table public.academy_progress(
 user_id uuid references auth.users(id) not null, level integer not null check(level between 1 and 4),
 step integer not null check(step between 1 and case level when 1 then 8 when 2 then 12 when 3 then 11 else 10 end), notes text not null default '' check(length(notes)<=20000),
 done boolean not null default false, updated_at timestamptz not null default now(),primary key(user_id,level,step));
create table public.academy_projects(
 user_id uuid references auth.users(id) not null, level integer not null check(level between 1 and 4),
 submission text not null check(length(submission) between 20 and 30000),
 updated_at timestamptz not null default now(), primary key(user_id,level));
create table public.academy_assessments(
 user_id uuid references auth.users(id) not null, level integer not null check(level between 1 and 4),
 quiz_score integer not null, project_score integer not null, feedback text not null,
 submission_snapshot text not null, assessed_by uuid references auth.users(id) not null, assessed_at timestamptz not null default now(),
 primary key(user_id,level));
create table public.academy_certificates(
 id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) not null,
 level integer not null check(level between 1 and 4),full_name text not null,
 issued_at timestamptz not null default now(), revoked boolean not null default false,unique(user_id,level));
create table academy_private.audit(id bigint generated always as identity primary key, actor uuid, action text not null, details jsonb not null, created_at timestamptz default now());
create table academy_private.events(event_id text primary key,created_at timestamptz default now());
create table academy_private.tutor_usage(user_id uuid not null, day date not null, calls integer not null,primary key(user_id,day));

create function public.academy_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from academy_private.admins where user_id=(select auth.uid())); $$;
create function public.academy_has_access(p_level integer) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.academy_enrollments e on e.email=lower(u.email)
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null and e.level=p_level and e.status='active'); $$;
revoke all on function public.academy_is_admin(),public.academy_has_access(integer) from public;
grant execute on function public.academy_is_admin(),public.academy_has_access(integer) to authenticated;

alter table public.academy_enrollments enable row level security;
alter table public.academy_progress enable row level security;
alter table public.academy_projects enable row level security;
alter table public.academy_assessments enable row level security;
alter table public.academy_certificates enable row level security;
revoke all on public.academy_enrollments,public.academy_progress,public.academy_projects,public.academy_assessments,public.academy_certificates from anon,authenticated;
grant select on public.academy_enrollments,public.academy_assessments,public.academy_certificates to authenticated;
grant select,insert,update on public.academy_progress,public.academy_projects to authenticated;
create policy enrollment_read on public.academy_enrollments for select to authenticated using(email=lower((select auth.jwt()->>'email')) or public.academy_is_admin());
create policy progress_read on public.academy_progress for select to authenticated using(user_id=(select auth.uid()) or public.academy_is_admin());
create policy progress_insert on public.academy_progress for insert to authenticated with check(user_id=(select auth.uid()) and public.academy_has_access(level));
create policy progress_update on public.academy_progress for update to authenticated using(user_id=(select auth.uid()) and public.academy_has_access(level)) with check(user_id=(select auth.uid()) and public.academy_has_access(level));
create policy project_read on public.academy_projects for select to authenticated using(user_id=(select auth.uid()) or public.academy_is_admin());
create policy project_insert on public.academy_projects for insert to authenticated with check(user_id=(select auth.uid()) and public.academy_has_access(level));
create policy project_update on public.academy_projects for update to authenticated using(user_id=(select auth.uid()) and public.academy_has_access(level)) with check(user_id=(select auth.uid()) and public.academy_has_access(level));
create policy assessment_read on public.academy_assessments for select to authenticated using(user_id=(select auth.uid()) or public.academy_is_admin());
create policy certificate_read on public.academy_certificates for select to authenticated using(user_id=(select auth.uid()) or public.academy_is_admin());

create function public.academy_set_enrollment(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.academy_is_admin() or p_status not in ('active','revoked','pending') then raise exception 'Non autorisé'; end if;
 update public.academy_enrollments set status=p_status where id=p_id;
 if not found then raise exception 'Inscription inconnue'; end if;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'enrollment',jsonb_build_object('id',p_id,'status',p_status));
end; $$;

create function public.academy_sync_enrollment(p_event text,p_email text,p_name text,p_level integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_level not between 1 and 4 or length(p_email)>254 or length(p_name) not between 2 and 120 then raise exception 'Données invalides'; end if;
 insert into academy_private.events(event_id) values(p_event) on conflict do nothing;
 if not found then return; end if;
 -- Un doublon ne réactive jamais une inscription révoquée et ne change pas son identité validée.
 insert into public.academy_enrollments(email,level,full_name,source_id) values(lower(trim(p_email)),p_level,p_name,p_event)
 on conflict(email,level) do nothing;
end; $$;
revoke all on function public.academy_sync_enrollment(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.academy_sync_enrollment(text,text,text,integer) to service_role;

create function public.academy_grade(p_user uuid,p_level integer,p_quiz integer,p_project integer,p_feedback text) returns uuid language plpgsql security definer set search_path='' as $$
declare qmax integer; pmax integer; qmin integer; pmin integer; qweight integer; pname text; cid uuid; snapshot text;
begin
 if not public.academy_is_admin() then raise exception 'Formateur requis'; end if;
 if p_level not between 1 and 4 or p_quiz is null or p_project is null or length(trim(p_feedback))<10 then raise exception 'Évaluation incomplète'; end if;
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
 insert into public.academy_assessments values(p_user,p_level,p_quiz,p_project,p_feedback,snapshot,auth.uid(),now())
 on conflict(user_id,level) do update set quiz_score=excluded.quiz_score,project_score=excluded.project_score,feedback=excluded.feedback,submission_snapshot=excluded.submission_snapshot,assessed_by=excluded.assessed_by,assessed_at=excluded.assessed_at;
 if p_quiz>=qmin and p_project>=pmin and (p_quiz::numeric/qmax*qweight+p_project)>=70 then
  insert into public.academy_certificates(user_id,level,full_name) values(p_user,p_level,pname)
  on conflict(user_id,level) do update set revoked=false,full_name=excluded.full_name returning id into cid;
 else
  update public.academy_certificates set revoked=true where user_id=p_user and level=p_level;
 end if;
 insert into academy_private.audit(actor,action,details) values(auth.uid(),'assessment',jsonb_build_object('user',p_user,'level',p_level,'quiz',p_quiz,'project',p_project));
 return cid;
end; $$;
create function public.academy_verify_certificate(p_id uuid) returns table(id uuid,level integer,issued_at timestamptz,valid boolean)
language sql stable security definer set search_path='' as $$
 select c.id,c.level,c.issued_at,not c.revoked from public.academy_certificates c where c.id=p_id; $$;
create function public.academy_tutor_quota(p_level integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer; total integer;
begin
 if not public.academy_has_access(p_level) then return false; end if;
 perform pg_advisory_xact_lock(810032026);
 select coalesce(sum(calls),0) into total from academy_private.tutor_usage where day=current_date;
 select calls into n from academy_private.tutor_usage where user_id=auth.uid() and day=current_date;
 if coalesce(n,0)>=30 or total>=200 then return false; end if;
 insert into academy_private.tutor_usage values(auth.uid(),current_date,1) on conflict(user_id,day) do update set calls=academy_private.tutor_usage.calls+1;
 return true;
end; $$;
revoke all on function public.academy_set_enrollment(uuid,text),public.academy_grade(uuid,integer,integer,integer,text),public.academy_verify_certificate(uuid),public.academy_tutor_quota(integer) from public;
grant execute on function public.academy_set_enrollment(uuid,text),public.academy_grade(uuid,integer,integer,integer,text),public.academy_tutor_quota(integer) to authenticated;
grant execute on function public.academy_verify_certificate(uuid) to anon,authenticated;

insert into storage.buckets(id,name,public) values('academy-private','academy-private',false) on conflict(id) do update set public=false;
create policy academy_resources on storage.objects for select to authenticated using(
 bucket_id='academy-private' and case when (storage.foldername(name))[1] ~ '^n[1-4]$'
 then public.academy_has_access(substring((storage.foldername(name))[1] from 2)::integer) else false end);
