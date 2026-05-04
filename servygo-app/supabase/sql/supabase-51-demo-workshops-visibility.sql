-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-51-demo-workshops-visibility.sql
--
-- Cel:
-- - bezpieczne oznaczanie profili demo (`is_demo`) i kontrola publicznej widoczności
--   (`visibility_status`) bez ruszania dotychczasowego pola `status`;
-- - zacieśnienie publicznych polityk RLS do: status=active + visibility_status=active;
-- - domyślnie demo nie jest odróżniane w API SQL, ale można je oznaczać i filtrować
--   po stronie aplikacji (np. sitemap produkcyjna).
-- =============================================================================

begin;

alter table public.workshops
  add column if not exists is_demo boolean not null default false;

alter table public.workshops
  add column if not exists visibility_status text not null default 'hidden';

update public.workshops
set visibility_status = case
  when lower(trim(coalesce(status, ''))) = 'active' then 'active'
  when lower(trim(coalesce(status, ''))) = 'pending' then 'pending'
  when lower(trim(coalesce(status, ''))) = 'archived' then 'archived'
  else 'hidden'
end
where visibility_status is null
   or trim(visibility_status) = '';

alter table public.workshops
  drop constraint if exists workshops_visibility_status_check;

alter table public.workshops
  add constraint workshops_visibility_status_check
  check (visibility_status in ('hidden', 'pending', 'active', 'archived'));

comment on column public.workshops.is_demo is
  'Profil demonstracyjny/testowy. Musi być oznaczony publicznie jako demo w UI.';

comment on column public.workshops.visibility_status is
  'Publiczna widoczność profilu: hidden/pending/active/archived.';

-- Wszystkie warsztaty istniejące przed pozyskaniem prawdziwych partnerów
-- oznaczamy jako demo, ponieważ służą do testów MVP.
update public.workshops
set
  is_demo = true,
  visibility_status = 'active',
  updated_at = now()
where true;

create index if not exists idx_workshops_visibility_status
  on public.workshops (visibility_status);

create index if not exists idx_workshops_public_visibility
  on public.workshops (status, visibility_status);

create index if not exists idx_workshops_demo_visibility
  on public.workshops (is_demo, visibility_status);

drop policy if exists "workshops_select_public_active" on public.workshops;
create policy "workshops_select_public_active"
on public.workshops
for select
to anon, authenticated
using (
  lower(trim(coalesce(status, ''))) = 'active'
  and lower(trim(coalesce(visibility_status, 'hidden'))) = 'active'
);

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
      and lower(trim(coalesce(w.visibility_status, 'hidden'))) = 'active'
  )
);

drop policy if exists "workshop_service_vehicle_prices_select_public_active" on public.workshop_service_vehicle_prices;
drop policy if exists "wsvp_select_public_active" on public.workshop_service_vehicle_prices;
create policy "wsvp_select_public_active"
on public.workshop_service_vehicle_prices
for select
to anon, authenticated
using (
  coalesce(workshop_service_vehicle_prices.is_active, true)
  and exists (
    select 1
    from public.workshops w
    where w.id = workshop_service_vehicle_prices.workshop_id
      and lower(trim(coalesce(w.status, ''))) = 'active'
      and lower(trim(coalesce(w.visibility_status, 'hidden'))) = 'active'
  )
);

drop policy if exists "workshop_photos_public_select_active" on public.workshop_photos;
create policy "workshop_photos_public_select_active"
on public.workshop_photos
for select
to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.workshops w
    where w.id = workshop_photos.workshop_id
      and lower(trim(coalesce(w.status, ''))) = 'active'
      and lower(trim(coalesce(w.visibility_status, 'hidden'))) = 'active'
  )
);

notify pgrst, 'reload schema';

commit;
