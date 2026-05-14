-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-59-booking-selected-services.sql
-- Cel: wiele usług na jednej rezerwacji (JSONB) + tryb wyszukiwania.
-- Idempotencja: tak (IF NOT EXISTS).
-- =====================================================

begin;

alter table public.bookings
  add column if not exists selected_services jsonb not null default '[]'::jsonb;

alter table public.bookings
  add column if not exists search_mode text;

comment on column public.bookings.selected_services is 'Lista usług wybranych przez klienta (snapshot JSON).';
comment on column public.bookings.search_mode is 'Tryb wyszukiwania ofert: best_match | separate (opcjonalnie).';

commit;
