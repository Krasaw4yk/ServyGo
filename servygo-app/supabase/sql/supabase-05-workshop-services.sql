-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-05-workshop-services.sql
-- Cel: tabela usług warsztatu + polityki RLS.
-- Do czego służy:
-- - przechowuje listę usług przypisanych do warsztatu
-- - właściciel warsztatu może zarządzać tylko własnymi usługami
-- Kiedy uruchomić: po supabase-03-workshops.sql.
-- Wymagany: tak (dla modułu usług/cennika).
-- Dane testowe: nie.
-- Idempotencja: tak.
-- =====================================================

begin;

create table if not exists public.workshop_services (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid references public.workshops(id) on delete cascade,
  service_name text not null,
  created_at timestamptz default now()
);

alter table public.workshop_services add column if not exists workshop_id uuid;
alter table public.workshop_services add column if not exists service_name text;
alter table public.workshop_services add column if not exists created_at timestamptz;
alter table public.workshop_services alter column created_at set default now();
update public.workshop_services set created_at = now() where created_at is null;

create index if not exists idx_workshop_services_workshop_id on public.workshop_services(workshop_id);

alter table public.workshop_services enable row level security;

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

commit;
