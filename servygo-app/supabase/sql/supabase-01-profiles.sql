-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-01-profiles.sql
-- Cel: tabela profili użytkowników + RLS + trigger updated_at.
-- Do czego służy:
-- - przechowuje dane kont użytkowników (first_name, last_name, email, phone)
-- - pozwala użytkownikowi czytać i edytować tylko własny profil
-- Kiedy uruchomić: po supabase-00-core-helpers.sql.
-- Wymagany: tak.
-- Dane testowe: nie.
-- Idempotencja: tak.
-- =====================================================

begin;

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

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists created_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz;

alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column updated_at set default now();
alter table public.profiles alter column role set default 'client';
update public.profiles set created_at = now() where created_at is null;
update public.profiles set updated_at = now() where updated_at is null;
update public.profiles set role = 'client' where role is null;
alter table public.profiles alter column email drop not null;
alter table public.profiles alter column role drop not null;

create index if not exists idx_profiles_email on public.profiles(email);

alter table public.profiles enable row level security;

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

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

commit;
