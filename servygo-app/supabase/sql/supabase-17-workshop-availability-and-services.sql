-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-17-workshop-availability-and-services.sql
--
-- Do czego służy:
-- - dodaje tabelę wyjątków dostępności `workshop_availability_exceptions` (dzień, zamknięcie, godziny, notatka);
-- - rozbudowuje `workshop_services` o pola cennikowe i sterujące publikacją
--   (`service_key`, `category`, `description`, `price_from`, `duration_minutes`,
--   `is_active`, `is_custom`, `updated_at`);
-- - dodaje RLS dla właściciela warsztatu i admina do wyjątków dostępności;
-- - dopina UPDATE policy dla `workshop_services` (właściciel + admin);
-- - zawęża publiczny odczyt usług do usług aktywnych (`is_active = true`)
--   dla warsztatów publicznych (`status = active`).
--
-- Jakie obiekty zmienia:
-- - `public.workshop_availability_exceptions` (nowa tabela + indeks + trigger + RLS);
-- - `public.workshop_services` (nowe kolumny i polityki);
-- - polityka `workshop_services_select_public_active`.
--
-- Wymagany: tak dla rozbudowanego kalendarza i sekcji „Usługi i ceny” w panelu warsztatu.
--
-- Czy można uruchomić wielokrotnie: tak.
--
-- Kiedy uruchomić: po `supabase-16-admin-notification-badges.sql`.
-- =============================================================================

begin;

create table if not exists public.workshop_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  date date not null,
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_availability_exceptions_unique_day unique (workshop_id, date)
);

alter table public.workshop_availability_exceptions add column if not exists workshop_id uuid;
alter table public.workshop_availability_exceptions add column if not exists date date;
alter table public.workshop_availability_exceptions add column if not exists is_closed boolean;
alter table public.workshop_availability_exceptions add column if not exists open_time time;
alter table public.workshop_availability_exceptions add column if not exists close_time time;
alter table public.workshop_availability_exceptions add column if not exists note text;
alter table public.workshop_availability_exceptions add column if not exists created_at timestamptz;
alter table public.workshop_availability_exceptions add column if not exists updated_at timestamptz;

alter table public.workshop_availability_exceptions alter column is_closed set default false;
alter table public.workshop_availability_exceptions alter column created_at set default now();
alter table public.workshop_availability_exceptions alter column updated_at set default now();
update public.workshop_availability_exceptions set is_closed = false where is_closed is null;
update public.workshop_availability_exceptions set created_at = now() where created_at is null;
update public.workshop_availability_exceptions set updated_at = now() where updated_at is null;

create unique index if not exists idx_workshop_availability_exceptions_unique_day
  on public.workshop_availability_exceptions(workshop_id, date);
create index if not exists idx_workshop_availability_exceptions_workshop
  on public.workshop_availability_exceptions(workshop_id);
create index if not exists idx_workshop_availability_exceptions_date
  on public.workshop_availability_exceptions(date);

drop trigger if exists trg_workshop_availability_exceptions_updated_at on public.workshop_availability_exceptions;
create trigger trg_workshop_availability_exceptions_updated_at
before update on public.workshop_availability_exceptions
for each row
execute function public.set_updated_at();

alter table public.workshop_availability_exceptions enable row level security;

drop policy if exists "workshop_availability_exceptions_select_owner" on public.workshop_availability_exceptions;
create policy "workshop_availability_exceptions_select_owner"
on public.workshop_availability_exceptions
for select
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_availability_exceptions.workshop_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "workshop_availability_exceptions_upsert_owner" on public.workshop_availability_exceptions;
create policy "workshop_availability_exceptions_upsert_owner"
on public.workshop_availability_exceptions
for all
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_availability_exceptions.workshop_id
      and w.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_availability_exceptions.workshop_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "workshop_availability_exceptions_admin" on public.workshop_availability_exceptions;
create policy "workshop_availability_exceptions_admin"
on public.workshop_availability_exceptions
for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

alter table public.workshop_services add column if not exists service_key text;
alter table public.workshop_services add column if not exists category text;
alter table public.workshop_services add column if not exists description text;
alter table public.workshop_services add column if not exists price_from numeric;
alter table public.workshop_services add column if not exists duration_minutes integer;
alter table public.workshop_services add column if not exists is_active boolean;
alter table public.workshop_services add column if not exists is_custom boolean;
alter table public.workshop_services add column if not exists updated_at timestamptz;

alter table public.workshop_services alter column is_active set default true;
alter table public.workshop_services alter column is_custom set default false;
alter table public.workshop_services alter column updated_at set default now();
update public.workshop_services set is_active = true where is_active is null;
update public.workshop_services set is_custom = false where is_custom is null;
update public.workshop_services set updated_at = now() where updated_at is null;

create index if not exists idx_workshop_services_service_key on public.workshop_services(service_key);
create index if not exists idx_workshop_services_category on public.workshop_services(category);
create index if not exists idx_workshop_services_active on public.workshop_services(is_active);

drop trigger if exists trg_workshop_services_updated_at on public.workshop_services;
create trigger trg_workshop_services_updated_at
before update on public.workshop_services
for each row
execute function public.set_updated_at();

drop policy if exists "workshop_services_update_own" on public.workshop_services;
create policy "workshop_services_update_own"
on public.workshop_services
for update
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and w.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "workshop_services_update_admin" on public.workshop_services;
create policy "workshop_services_update_admin"
on public.workshop_services
for update
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "workshop_services_select_public_active" on public.workshop_services;
create policy "workshop_services_select_public_active"
on public.workshop_services
for select
to anon, authenticated
using (
  coalesce(workshop_services.is_active, true)
  and exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and lower(trim(coalesce(w.status, ''))) = 'active'
  )
);

notify pgrst, 'reload schema';

commit;
