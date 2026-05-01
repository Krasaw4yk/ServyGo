-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase-31-workshop-services-category-manual.sql
-- Cel: flaga kategorii ustawionej ręcznie (nie nadpisywać automatycznie).
-- Idempotencja: tak.
-- =====================================================

begin;

alter table public.workshop_services
  add column if not exists category_manual boolean not null default false;

commit;
