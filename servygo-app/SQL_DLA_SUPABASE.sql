-- =====================================================
-- LEGACY / ARCHIWUM
-- Plik historyczny: SQL_DLA_SUPABASE.sql
-- Status: przestarzały (all-in-one, pozostawiony tylko referencyjnie).
-- Docelowo używaj nowych, numerowanych plików z folderu:
--   supabase/sql/
-- Instrukcja: SUPABASE_SQL_INSTRUKCJA.md
-- =====================================================
-- SQL dla Supabase (ServyGo) - pakiet all-in-one
-- Wklej CAŁOŚĆ do Supabase SQL Editor i uruchom.

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1) TABLES
-- =========================================================

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  vehicle_type text,
  vehicle_type_label text,
  brand text,
  model text,
  year integer,
  fuel text,
  service text,
  problem text,
  city text,
  phone text,
  email text,
  manual_type text,
  manual_brand text,
  manual_model text,
  manual_year text,
  manual_description text,
  vehicle_source text,
  payload_json jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  role text default 'client',
  country text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  vehicle_type text,
  brand text,
  model text,
  year integer,
  fuel text,
  plate_number text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  nip text,
  phone text,
  email text,
  city text,
  address text,
  description text,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.workshop_services (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid references public.workshops(id) on delete cascade,
  service_name text not null,
  created_at timestamptz default now()
);

create table if not exists public.workshop_leads (
  id uuid primary key default gen_random_uuid(),
  workshop_name text not null,
  nip text,
  phone text,
  email text not null,
  city text,
  postal_code text,
  address text,
  contact_person text,
  description text,
  message text,
  status text default 'nowe_zgloszenie',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================================================
-- 2) SAFE COLUMN SYNC
-- =========================================================

alter table public.service_requests add column if not exists vehicle_type text;
alter table public.service_requests add column if not exists vehicle_type_label text;
alter table public.service_requests add column if not exists brand text;
alter table public.service_requests add column if not exists model text;
alter table public.service_requests add column if not exists year integer;
alter table public.service_requests add column if not exists fuel text;
alter table public.service_requests add column if not exists service text;
alter table public.service_requests add column if not exists problem text;
alter table public.service_requests add column if not exists city text;
alter table public.service_requests add column if not exists phone text;
alter table public.service_requests add column if not exists email text;
alter table public.service_requests add column if not exists manual_type text;
alter table public.service_requests add column if not exists manual_brand text;
alter table public.service_requests add column if not exists manual_model text;
alter table public.service_requests add column if not exists manual_year text;
alter table public.service_requests add column if not exists manual_description text;
alter table public.service_requests add column if not exists vehicle_source text;
alter table public.service_requests add column if not exists payload_json jsonb;
alter table public.service_requests add column if not exists status text;
alter table public.service_requests add column if not exists created_at timestamptz;
alter table public.service_requests add column if not exists updated_at timestamptz;

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists created_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz;

alter table public.cars add column if not exists user_id uuid;
alter table public.cars add column if not exists vehicle_type text;
alter table public.cars add column if not exists brand text;
alter table public.cars add column if not exists model text;
alter table public.cars add column if not exists year integer;
alter table public.cars add column if not exists fuel text;
alter table public.cars add column if not exists plate_number text;
alter table public.cars add column if not exists is_primary boolean;
alter table public.cars add column if not exists created_at timestamptz;
alter table public.cars add column if not exists updated_at timestamptz;

alter table public.workshops add column if not exists owner_id uuid;
alter table public.workshops add column if not exists name text;
alter table public.workshops add column if not exists nip text;
alter table public.workshops add column if not exists phone text;
alter table public.workshops add column if not exists email text;
alter table public.workshops add column if not exists city text;
alter table public.workshops add column if not exists address text;
alter table public.workshops add column if not exists description text;
alter table public.workshops add column if not exists status text;
alter table public.workshops add column if not exists created_at timestamptz;
alter table public.workshops add column if not exists updated_at timestamptz;

alter table public.workshop_services add column if not exists workshop_id uuid;
alter table public.workshop_services add column if not exists service_name text;
alter table public.workshop_services add column if not exists created_at timestamptz;

alter table public.workshop_leads add column if not exists workshop_name text;
alter table public.workshop_leads add column if not exists nip text;
alter table public.workshop_leads add column if not exists phone text;
alter table public.workshop_leads add column if not exists email text;
alter table public.workshop_leads add column if not exists city text;
alter table public.workshop_leads add column if not exists postal_code text;
alter table public.workshop_leads add column if not exists address text;
alter table public.workshop_leads add column if not exists contact_person text;
alter table public.workshop_leads add column if not exists description text;
alter table public.workshop_leads add column if not exists message text;
alter table public.workshop_leads add column if not exists status text;
alter table public.workshop_leads add column if not exists created_at timestamptz;
alter table public.workshop_leads add column if not exists updated_at timestamptz;

alter table public.service_requests alter column status set default 'new';
alter table public.service_requests alter column created_at set default now();
alter table public.service_requests alter column updated_at set default now();
update public.service_requests set status = 'new' where status is null;
update public.service_requests set created_at = now() where created_at is null;
update public.service_requests set updated_at = now() where updated_at is null;

alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column updated_at set default now();
alter table public.profiles alter column role set default 'client';
update public.profiles set created_at = now() where created_at is null;
update public.profiles set updated_at = now() where updated_at is null;
update public.profiles set role = 'client' where role is null;
alter table public.profiles alter column email drop not null;
alter table public.profiles alter column role drop not null;

alter table public.cars alter column is_primary set default false;
alter table public.cars alter column created_at set default now();
alter table public.cars alter column updated_at set default now();
update public.cars set is_primary = false where is_primary is null;
update public.cars set created_at = now() where created_at is null;
update public.cars set updated_at = now() where updated_at is null;

alter table public.workshops alter column status set default 'pending';
alter table public.workshops alter column created_at set default now();
alter table public.workshops alter column updated_at set default now();
update public.workshops set status = 'pending' where status is null;
update public.workshops set created_at = now() where created_at is null;
update public.workshops set updated_at = now() where updated_at is null;

alter table public.workshop_services alter column created_at set default now();
update public.workshop_services set created_at = now() where created_at is null;

alter table public.workshop_leads alter column status set default 'nowe_zgloszenie';
alter table public.workshop_leads alter column created_at set default now();
alter table public.workshop_leads alter column updated_at set default now();
update public.workshop_leads set status = 'nowe_zgloszenie' where status is null;
update public.workshop_leads set created_at = now() where created_at is null;
update public.workshop_leads set updated_at = now() where updated_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cars_user_id_fkey'
      and conrelid = 'public.cars'::regclass
  ) then
    alter table public.cars
      add constraint cars_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- =========================================================
-- 3) INDEXES
-- =========================================================

create index if not exists idx_cars_user_id on public.cars(user_id);
create index if not exists idx_cars_user_primary on public.cars(user_id, is_primary);
create index if not exists idx_service_requests_created_at on public.service_requests(created_at desc);
create index if not exists idx_service_requests_status on public.service_requests(status);
create index if not exists idx_service_requests_city on public.service_requests(city);
create index if not exists idx_service_requests_vehicle_type on public.service_requests(vehicle_type);
create index if not exists idx_workshops_owner_id on public.workshops(owner_id);
create index if not exists idx_workshops_status on public.workshops(status);
create index if not exists idx_workshops_owner_status on public.workshops(owner_id, status);
create index if not exists idx_workshop_services_workshop_id on public.workshop_services(workshop_id);
create index if not exists idx_workshop_leads_created_at on public.workshop_leads(created_at desc);
create index if not exists idx_workshop_leads_status on public.workshop_leads(status);
create index if not exists idx_workshop_leads_city on public.workshop_leads(city);

-- =========================================================
-- 4) RLS
-- =========================================================

alter table public.service_requests enable row level security;
alter table public.profiles enable row level security;
alter table public.cars enable row level security;
alter table public.workshops enable row level security;
alter table public.workshop_services enable row level security;
alter table public.workshop_leads enable row level security;

-- service_requests
drop policy if exists "service_requests_insert_anon" on public.service_requests;
create policy "service_requests_insert_anon"
on public.service_requests
for insert
to anon
with check (true);

drop policy if exists "service_requests_insert_authenticated" on public.service_requests;
create policy "service_requests_insert_authenticated"
on public.service_requests
for insert
to authenticated
with check (true);

drop policy if exists "service_requests_select_authenticated" on public.service_requests;
create policy "service_requests_select_authenticated"
on public.service_requests
for select
to authenticated
using (true);

drop policy if exists "service_requests_update_authenticated" on public.service_requests;
create policy "service_requests_update_authenticated"
on public.service_requests
for update
to authenticated
using (true)
with check (true);

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using (auth.uid() = id);

-- cars
drop policy if exists "cars_select_own" on public.cars;
create policy "cars_select_own"
on public.cars
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "cars_insert_own" on public.cars;
create policy "cars_insert_own"
on public.cars
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "cars_update_own" on public.cars;
create policy "cars_update_own"
on public.cars
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "cars_delete_own" on public.cars;
create policy "cars_delete_own"
on public.cars
for delete
to authenticated
using (auth.uid() = user_id);

-- workshops
drop policy if exists "workshops_select_own" on public.workshops;
create policy "workshops_select_own"
on public.workshops
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "workshops_insert_own" on public.workshops;
create policy "workshops_insert_own"
on public.workshops
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "workshops_update_own" on public.workshops;
create policy "workshops_update_own"
on public.workshops
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "workshops_delete_own" on public.workshops;
create policy "workshops_delete_own"
on public.workshops
for delete
to authenticated
using (auth.uid() = owner_id);

-- workshop_services
drop policy if exists "workshop_services_select_own" on public.workshop_services;
create policy "workshop_services_select_own"
on public.workshop_services
for select
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "workshop_services_insert_own" on public.workshop_services;
create policy "workshop_services_insert_own"
on public.workshop_services
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "workshop_services_delete_own" on public.workshop_services;
create policy "workshop_services_delete_own"
on public.workshop_services
for delete
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and w.owner_id = auth.uid()
  )
);

-- workshop_leads (hard reset policies on this table)
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workshop_leads'
  loop
    execute format('drop policy if exists %I on public.workshop_leads', p.policyname);
  end loop;
end $$;

create policy "workshop_leads_insert_anon"
on public.workshop_leads
for insert
to anon
with check (true);

create policy "workshop_leads_insert_authenticated"
on public.workshop_leads
for insert
to authenticated
with check (true);

grant usage on schema public to anon, authenticated;
grant insert on table public.workshop_leads to anon, authenticated;

-- =========================================================
-- 5) FUNCTIONS + TRIGGERS
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_cars_updated_at on public.cars;
create trigger trg_cars_updated_at
before update on public.cars
for each row
execute function public.set_updated_at();

drop trigger if exists trg_service_requests_updated_at on public.service_requests;
create trigger trg_service_requests_updated_at
before update on public.service_requests
for each row
execute function public.set_updated_at();

drop trigger if exists trg_workshops_updated_at on public.workshops;
create trigger trg_workshops_updated_at
before update on public.workshops
for each row
execute function public.set_updated_at();

drop trigger if exists trg_workshop_leads_updated_at on public.workshop_leads;
create trigger trg_workshop_leads_updated_at
before update on public.workshop_leads
for each row
execute function public.set_updated_at();

-- =========================================================
-- 6) AUTH USER -> PROFILE TRIGGER
-- =========================================================

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists handle_new_user on auth.users;

drop function if exists public.create_profile_for_new_user();
drop function if exists public.handle_new_user_profile();
drop function if exists public.handle_new_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  insert into public.profiles (id, first_name, last_name, email, phone)
  values (
    new.id,
    nullif(coalesce(meta ->> 'first_name', ''), ''),
    nullif(coalesce(meta ->> 'last_name', ''), ''),
    new.email,
    nullif(coalesce(meta ->> 'phone', ''), '')
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.profiles (id, first_name, last_name, email, phone, created_at, updated_at)
select
  u.id,
  nullif(coalesce(u.raw_user_meta_data ->> 'first_name', ''), ''),
  nullif(coalesce(u.raw_user_meta_data ->> 'last_name', ''), ''),
  u.email,
  nullif(coalesce(u.raw_user_meta_data ->> 'phone', ''), ''),
  now(),
  now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '')
  and u.email is not null;

commit;

-- =========================================================
-- 7) CONTROL CHECKS
-- =========================================================

select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select tgname, tgrelid::regclass as table_name, tgenabled
from pg_trigger
where not tgisinternal
order by tgrelid::regclass::text, tgname;

select relname, relrowsecurity
from pg_class
where relname in ('profiles', 'cars', 'service_requests', 'workshops', 'workshop_services', 'workshop_leads')
order by relname;
