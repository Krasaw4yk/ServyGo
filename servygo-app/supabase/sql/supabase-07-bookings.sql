-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-07-bookings.sql
-- Cel: tabela rezerwacji terminów + RLS.
-- Do czego służy:
-- - przechowuje rezerwacje klientów
-- - użytkownik widzi i edytuje tylko własne rezerwacje
-- Kiedy uruchomić: po supabase-03-workshops.sql.
-- Wymagany: tak (dla modułu rezerwacji).
-- Dane testowe: nie.
-- Idempotencja: tak.
-- =====================================================

begin;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workshop_id uuid not null,
  workshop_name text not null,
  service_name text not null,
  price numeric not null,
  duration_minutes integer not null,
  date date not null,
  time text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own"
on public.bookings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "bookings_insert_own" on public.bookings;
create policy "bookings_insert_own"
on public.bookings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "bookings_update_own" on public.bookings;
create policy "bookings_update_own"
on public.bookings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on table public.bookings from anon;
grant select, insert, update on table public.bookings to authenticated;

commit;
