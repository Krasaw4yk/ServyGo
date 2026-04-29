-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-00-core-helpers.sql
-- Cel: przygotowuje wspólne rozszerzenia i funkcję triggera updated_at.
-- Do czego służy:
-- - tworzy extension pgcrypto (UUID)
-- - tworzy funkcję set_updated_at() używaną przez triggery tabel
-- Kiedy uruchomić: jako pierwszy plik SQL.
-- Wymagany: tak.
-- Dane testowe: nie.
-- Idempotencja: tak (create if not exists / create or replace).
-- =====================================================

begin;

create extension if not exists pgcrypto;

-- Wspólna funkcja do automatycznego uzupełniania updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

commit;
