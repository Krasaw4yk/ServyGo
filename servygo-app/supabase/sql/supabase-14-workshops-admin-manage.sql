-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-14-workshops-admin-manage.sql
--
-- Do czego służy:
-- - dodaje pole tekstowe godzin pracy warsztatu (`opening_hours`);
-- - normalizuje statusy publiczne do łańcucha `active` (z legacy: approved, aktywny);
-- - zawęża publiczny odczyt warsztatów i usług wyłącznie do statusu `active`
--   (statusy `suspended` i `hidden` nie są widoczne dla anon / wyników publicznych);
-- - rozszerza RLS: admin może odczytywać usługi dowolnego warsztatu oraz zarządzać
--   `workshop_services` (insert/delete); admin może przeglądać rezerwacje (`bookings`).
--
-- Jakie obiekty zmienia:
-- - `public.workshops.opening_hours`;
-- - polityki: `workshops_select_public_active`, `workshop_services_select_public_active`;
-- - nowe polityki: `workshop_services_select_admin`, `workshop_services_insert_admin`,
--   `workshop_services_delete_admin`, `bookings_select_admin`.
--
-- Wymagany: tak dla panelu /admin (lista, edycja, rezerwacje warsztatu).
--
-- Czy można uruchomić wielokrotnie: tak.
--
-- Kiedy uruchomić: po `supabase-13-workshop-leads-columns-public-visibility.sql`.
-- =============================================================================

begin;

alter table public.workshops add column if not exists opening_hours text;

comment on column public.workshops.opening_hours is
  'Godziny pracy (tekst / JSON wg ustalenia zespołu), edytowalne w panelu admina.';

-- Normalizacja statusów widocznych wcześniej jako „aktywne” do jednego: active
update public.workshops
set status = 'active'
where lower(trim(coalesce(status, ''))) in ('approved', 'aktywny', 'umowa_podpisana');

-- Publicznie tylko active
drop policy if exists "workshops_select_public_active" on public.workshops;
create policy "workshops_select_public_active"
on public.workshops
for select
to anon, authenticated
using (lower(trim(coalesce(status, ''))) = 'active');

drop policy if exists "workshop_services_select_public_active" on public.workshop_services;
create policy "workshop_services_select_public_active"
on public.workshop_services
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and lower(trim(coalesce(w.status, ''))) = 'active'
  )
);

-- Admin: pełny odczyt usług (dowolny warsztat)
drop policy if exists "workshop_services_select_admin" on public.workshop_services;
create policy "workshop_services_select_admin"
on public.workshop_services
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

-- Admin: dodawanie / usuwanie usług (edycja listy w panelu)
drop policy if exists "workshop_services_insert_admin" on public.workshop_services;
create policy "workshop_services_insert_admin"
on public.workshop_services
for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

drop policy if exists "workshop_services_delete_admin" on public.workshop_services;
create policy "workshop_services_delete_admin"
on public.workshop_services
for delete
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

-- Admin: podgląd rezerwacji (np. w szczegółach warsztatu)
drop policy if exists "bookings_select_admin" on public.bookings;
create policy "bookings_select_admin"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

commit;
