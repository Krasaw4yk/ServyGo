-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-57-vehicle-price-difficulty.sql
--
-- Cel:
-- - poziom trudności TYLKO dla wiersza „cena dla konkretnego auta”
--   (workshop_service_vehicle_prices);
-- - usunięcie difficulty_level z workshop_services (jeśli dodano w migracji 56).
-- =============================================================================

begin;

-- --- Ceny dla aut ---
alter table public.workshop_service_vehicle_prices
  add column if not exists difficulty_level text;

update public.workshop_service_vehicle_prices
set difficulty_level = 'medium'
where difficulty_level is null
   or trim(difficulty_level) = ''
   or lower(trim(difficulty_level)) not in ('low', 'medium', 'high');

alter table public.workshop_service_vehicle_prices
  alter column difficulty_level set default 'medium';

alter table public.workshop_service_vehicle_prices
  alter column difficulty_level set not null;

alter table public.workshop_service_vehicle_prices
  drop constraint if exists workshop_service_vehicle_prices_difficulty_level_check;

alter table public.workshop_service_vehicle_prices
  add constraint workshop_service_vehicle_prices_difficulty_level_check
  check (difficulty_level in ('low', 'medium', 'high'));

comment on column public.workshop_service_vehicle_prices.difficulty_level is
  'Poziom trudności dla wariantu auta (low / medium / high).';

-- --- Cofnięcie difficulty z głównej tabeli usług (np. po supabase-56) ---
alter table public.workshop_services
  drop constraint if exists workshop_services_difficulty_level_check;

alter table public.workshop_services
  drop column if exists difficulty_level;

commit;
