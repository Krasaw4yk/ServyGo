-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-08-cars.sql
-- Cel: tabela samochodów użytkowników + RLS + indeksy.
-- Do czego służy:
-- - przechowuje auta użytkownika
-- - obsługuje auto główne (is_primary)
-- Kiedy uruchomić: po supabase-01-profiles.sql.
-- Wymagany: tak (dla modułu konta i aut).
-- Dane testowe: nie.
-- Idempotencja: tak.
-- =====================================================

begin;

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

alter table public.cars alter column is_primary set default false;
alter table public.cars alter column created_at set default now();
alter table public.cars alter column updated_at set default now();
update public.cars set is_primary = false where is_primary is null;
update public.cars set created_at = now() where created_at is null;
update public.cars set updated_at = now() where updated_at is null;

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

create index if not exists idx_cars_user_id on public.cars(user_id);
create index if not exists idx_cars_user_primary on public.cars(user_id, is_primary);

alter table public.cars enable row level security;

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

drop trigger if exists trg_cars_updated_at on public.cars;
create trigger trg_cars_updated_at
before update on public.cars
for each row
execute function public.set_updated_at();

commit;
