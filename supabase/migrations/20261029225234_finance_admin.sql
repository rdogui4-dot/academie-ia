-- Journal de gestion interne. Aucun droit comptable attribué aux formateurs.
begin;
create table public.academy_finance_entries (
 id uuid primary key default gen_random_uuid(),
 occurred_on date not null,
 kind text not null check(kind in ('sale','refund','expense','tax','social','owner_draw','funding')),
 description text not null check(length(btrim(description)) between 3 and 300),
 reference text not null check(length(btrim(reference)) between 3 and 120),
 channel text not null check(channel in ('chariow','mobile_money','bank','cash','other')),
 level smallint check(level between 1 and 4),
 amount bigint not null check(amount between 1 and 1000000000),
 fee bigint not null default 0 check(fee>=0 and fee<=amount),
 vat bigint not null default 0 check(vat>=0 and vat<amount),
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 void_reason text check(void_reason is null or length(btrim(void_reason)) between 10 and 300),
 voided_at timestamptz,
 voided_by uuid references auth.users(id),
 check((kind='sale') or fee=0),
 check((kind in ('sale','refund')) or vat=0),
 check((void_reason is null and voided_at is null and voided_by is null) or (void_reason is not null and voided_at is not null and voided_by is not null))
);
create unique index academy_finance_reference on public.academy_finance_entries(channel,kind,lower(btrim(reference))) where voided_at is null;
create index academy_finance_period on public.academy_finance_entries(occurred_on,id);
create table public.academy_finance_settings (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 tax_mode text not null check(tax_mode in ('ca','vat')),
 tax_rate numeric(6,3) not null check(tax_rate between 0 and 50),
 commission_rate numeric(6,3) not null check(commission_rate between 0 and 50),
 regime_confirmed boolean not null default false,
 family_target bigint not null check(family_target between 0 and 100000000),
 social_budget bigint not null check(social_budget between 0 and 100000000),
 extra_tax_reserve bigint not null check(extra_tax_reserve between 0 and 100000000),
 business_reserve bigint not null check(business_reserve between 0 and 100000000),
 sales_target bigint not null check(sales_target between 0 and 1000000000),
 fixed_budget bigint not null check(fixed_budget between 0 and 100000000),
 variable_rate numeric(6,3) not null check(variable_rate between 0 and 90),
 note text not null check(length(btrim(note)) between 10 and 500)
);
create function academy_private.finance_stamp() returns trigger language plpgsql security invoker set search_path='' as $$
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
end $$;
revoke all on function academy_private.finance_stamp() from public,anon,authenticated;
create trigger finance_entry_stamp before insert or update on public.academy_finance_entries for each row execute function academy_private.finance_stamp();
create trigger finance_setting_stamp before insert on public.academy_finance_settings for each row execute function academy_private.finance_stamp();
alter table public.academy_finance_entries enable row level security;
alter table public.academy_finance_settings enable row level security;
revoke all on public.academy_finance_entries,public.academy_finance_settings from anon,authenticated;
grant select on public.academy_finance_entries,public.academy_finance_settings to authenticated;
grant insert(occurred_on,kind,description,reference,channel,level,amount,fee,vat) on public.academy_finance_entries to authenticated;
grant update(void_reason) on public.academy_finance_entries to authenticated;
grant insert(tax_mode,tax_rate,commission_rate,regime_confirmed,family_target,social_budget,extra_tax_reserve,business_reserve,sales_target,fixed_budget,variable_rate,note) on public.academy_finance_settings to authenticated;
create policy finance_entries_read on public.academy_finance_entries for select to authenticated using((select public.academy_is_admin()));
create policy finance_entries_insert on public.academy_finance_entries for insert to authenticated with check((select public.academy_is_admin()) and created_by=(select auth.uid()));
create policy finance_entries_void on public.academy_finance_entries for update to authenticated using((select public.academy_is_admin())) with check((select public.academy_is_admin()));
create policy finance_settings_read on public.academy_finance_settings for select to authenticated using((select public.academy_is_admin()));
create policy finance_settings_insert on public.academy_finance_settings for insert to authenticated with check((select public.academy_is_admin()) and created_by=(select auth.uid()));
commit;
