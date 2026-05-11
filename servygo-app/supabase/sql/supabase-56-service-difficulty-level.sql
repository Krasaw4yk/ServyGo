-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-56-service-difficulty-level.sql
--
-- DEPRECATED: poziom trudności jest w `workshop_service_vehicle_prices`.
-- Użyj: supabase-57-vehicle-price-difficulty.sql (usuwa kolumnę z workshop_services).
--
-- Historia: pierwsza wersja dodawała difficulty do workshop_services — nieużywane.
-- =============================================================================

begin;

alter table public.workshop_services
  add column if not exists difficulty_level text;

update public.workshop_services
set difficulty_level = 'medium'
where difficulty_level is null
   or trim(difficulty_level) = ''
   or lower(trim(difficulty_level)) not in ('low', 'medium', 'high');

alter table public.workshop_services
  alter column difficulty_level set default 'medium';

alter table public.workshop_services
  alter column difficulty_level set not null;

alter table public.workshop_services
  drop constraint if exists workshop_services_difficulty_level_check;

alter table public.workshop_services
  add constraint workshop_services_difficulty_level_check
  check (difficulty_level in ('low', 'medium', 'high'));

comment on column public.workshop_services.difficulty_level is
  'Poziom trudności usługi: low, medium (domyślnie), high — widoczny dla klienta.';

commit;
