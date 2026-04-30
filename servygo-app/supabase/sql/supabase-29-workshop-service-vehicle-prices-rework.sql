-- =============================================================================
-- ServyGo / Supabase — rework cen uslug pod konkretne auta
-- Plik: supabase/sql/supabase-29-workshop-service-vehicle-prices-rework.sql
--
-- Cel:
-- - docelowa tabela cen per auto/wariant pojazdu;
-- - zachowanie legacy pol cen w workshop_services (bez usuwania danych);
-- - RLS dla owner/admin/public read aktywnych rekordow.
-- =============================================================================

begin;

create table if not exists public.workshop_service_vehicle_prices (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  workshop_service_id uuid null references public.workshop_services(id) on delete cascade,
  service_name text not null,
  vehicle_type text null,
  brand text not null,
  model text not null,
  year_from int null,
  year_to int null,
  engine text null,
  fuel text null,
  transmission text null,
  price_from numeric not null,
  price_to numeric not null,
  duration_minutes int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- kompatybilnosc, gdy tabela byla utworzona w poprzedniej migracji z nazwa service_id:
alter table public.workshop_service_vehicle_prices
  add column if not exists workshop_service_id uuid null references public.workshop_services(id) on delete cascade;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workshop_service_vehicle_prices'
      and column_name = 'service_id'
  ) then
    execute 'update public.workshop_service_vehicle_prices
             set workshop_service_id = coalesce(workshop_service_id, service_id)
             where service_id is not null';
  end if;
end $$;

create index if not exists workshop_service_vehicle_prices_workshop_idx
  on public.workshop_service_vehicle_prices(workshop_id);
create index if not exists workshop_service_vehicle_prices_workshop_service_idx
  on public.workshop_service_vehicle_prices(workshop_service_id);
create index if not exists workshop_service_vehicle_prices_service_name_idx
  on public.workshop_service_vehicle_prices(lower(service_name));
create index if not exists workshop_service_vehicle_prices_brand_model_idx
  on public.workshop_service_vehicle_prices(lower(brand), lower(model));
create index if not exists workshop_service_vehicle_prices_active_idx
  on public.workshop_service_vehicle_prices(is_active);

drop trigger if exists trg_workshop_service_vehicle_prices_updated_at on public.workshop_service_vehicle_prices;
create trigger trg_workshop_service_vehicle_prices_updated_at
before update on public.workshop_service_vehicle_prices
for each row execute procedure public.set_updated_at();

alter table public.workshop_service_vehicle_prices enable row level security;

drop policy if exists "wsvp_select_own" on public.workshop_service_vehicle_prices;
create policy "wsvp_select_own"
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

drop policy if exists "wsvp_insert_own" on public.workshop_service_vehicle_prices;
create policy "wsvp_insert_own"
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

drop policy if exists "wsvp_update_own" on public.workshop_service_vehicle_prices;
create policy "wsvp_update_own"
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

drop policy if exists "wsvp_delete_own" on public.workshop_service_vehicle_prices;
create policy "wsvp_delete_own"
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

drop policy if exists "wsvp_admin_all" on public.workshop_service_vehicle_prices;
create policy "wsvp_admin_all"
on public.workshop_service_vehicle_prices
for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "wsvp_select_public_active" on public.workshop_service_vehicle_prices;
create policy "wsvp_select_public_active"
on public.workshop_service_vehicle_prices
for select
to anon, authenticated
using (
  workshop_service_vehicle_prices.is_active = true
  and exists (
    select 1
    from public.workshops w
    where w.id = workshop_service_vehicle_prices.workshop_id
      and lower(trim(coalesce(w.status, ''))) in ('active', 'approved')
  )
);

notify pgrst, 'reload schema';

commit;
