-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-30-workshop-service-vehicle-prices.sql
--
-- Cel:
-- - dodanie warstwy cen uslug per konkretne auto (wariant pojazdu);
-- - zachowanie starego systemu cen ogolnych (workshop_services) jako fallback;
-- - RLS: owner zarzadza tylko swoimi rekordami, publiczny odczyt tylko aktywnych cen
--   aktywnych warsztatow.
-- =============================================================================

begin;

create table if not exists public.workshop_service_vehicle_prices (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  service_id uuid null references public.workshop_services(id) on delete set null,
  service_name text not null,
  vehicle_type text not null,
  brand text null,
  model text null,
  year_from int null,
  year_to int null,
  engine text null,
  fuel text null,
  transmission text null,
  price_from numeric null,
  price_to numeric null,
  duration_minutes int null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_service_vehicle_prices_year_range_chk
    check (year_from is null or year_to is null or year_from <= year_to)
);

create index if not exists workshop_service_vehicle_prices_workshop_idx
  on public.workshop_service_vehicle_prices(workshop_id);
create index if not exists workshop_service_vehicle_prices_service_name_idx
  on public.workshop_service_vehicle_prices(lower(service_name));
create index if not exists workshop_service_vehicle_prices_vehicle_idx
  on public.workshop_service_vehicle_prices(
    lower(coalesce(vehicle_type, '')),
    lower(coalesce(brand, '')),
    lower(coalesce(model, ''))
  );

drop trigger if exists trg_workshop_service_vehicle_prices_updated_at on public.workshop_service_vehicle_prices;
create trigger trg_workshop_service_vehicle_prices_updated_at
before update on public.workshop_service_vehicle_prices
for each row execute procedure public.set_updated_at();

alter table public.workshop_service_vehicle_prices enable row level security;

drop policy if exists "workshop_service_vehicle_prices_select_own" on public.workshop_service_vehicle_prices;
create policy "workshop_service_vehicle_prices_select_own"
on public.workshop_service_vehicle_prices
for select
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_service_vehicle_prices.workshop_id
      and (w.owner_id = auth.uid() or w.owner_user_id = auth.uid())
  )
);

drop policy if exists "workshop_service_vehicle_prices_insert_own" on public.workshop_service_vehicle_prices;
create policy "workshop_service_vehicle_prices_insert_own"
on public.workshop_service_vehicle_prices
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_service_vehicle_prices.workshop_id
      and (w.owner_id = auth.uid() or w.owner_user_id = auth.uid())
  )
);

drop policy if exists "workshop_service_vehicle_prices_update_own" on public.workshop_service_vehicle_prices;
create policy "workshop_service_vehicle_prices_update_own"
on public.workshop_service_vehicle_prices
for update
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_service_vehicle_prices.workshop_id
      and (w.owner_id = auth.uid() or w.owner_user_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_service_vehicle_prices.workshop_id
      and (w.owner_id = auth.uid() or w.owner_user_id = auth.uid())
  )
);

drop policy if exists "workshop_service_vehicle_prices_delete_own" on public.workshop_service_vehicle_prices;
create policy "workshop_service_vehicle_prices_delete_own"
on public.workshop_service_vehicle_prices
for delete
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_service_vehicle_prices.workshop_id
      and (w.owner_id = auth.uid() or w.owner_user_id = auth.uid())
  )
);

drop policy if exists "workshop_service_vehicle_prices_admin_all" on public.workshop_service_vehicle_prices;
create policy "workshop_service_vehicle_prices_admin_all"
on public.workshop_service_vehicle_prices
for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "workshop_service_vehicle_prices_select_public_active" on public.workshop_service_vehicle_prices;
create policy "workshop_service_vehicle_prices_select_public_active"
on public.workshop_service_vehicle_prices
for select
to anon, authenticated
using (
  coalesce(workshop_service_vehicle_prices.is_active, true)
  and exists (
    select 1
    from public.workshops w
    where w.id = workshop_service_vehicle_prices.workshop_id
      and lower(trim(coalesce(w.status, ''))) in ('active', 'approved')
  )
);

notify pgrst, 'reload schema';

commit;
