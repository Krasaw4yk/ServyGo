-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-06-service-requests.sql
-- Cel: tabela zapytań klientów o usługę + RLS + indeksy.
-- Do czego służy:
-- - przechowuje formularze zapytań z frontu
-- - pozwala anon/auth dodawać zgłoszenia
-- Kiedy uruchomić: po supabase-00-core-helpers.sql.
-- Wymagany: tak.
-- Dane testowe: nie.
-- Idempotencja: tak.
-- =====================================================

begin;

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

alter table public.service_requests alter column status set default 'new';
alter table public.service_requests alter column created_at set default now();
alter table public.service_requests alter column updated_at set default now();
update public.service_requests set status = 'new' where status is null;
update public.service_requests set created_at = now() where created_at is null;
update public.service_requests set updated_at = now() where updated_at is null;

create index if not exists idx_service_requests_created_at on public.service_requests(created_at desc);
create index if not exists idx_service_requests_status on public.service_requests(status);
create index if not exists idx_service_requests_city on public.service_requests(city);
create index if not exists idx_service_requests_vehicle_type on public.service_requests(vehicle_type);

alter table public.service_requests enable row level security;

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

drop trigger if exists trg_service_requests_updated_at on public.service_requests;
create trigger trg_service_requests_updated_at
before update on public.service_requests
for each row
execute function public.set_updated_at();

commit;
