-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-03-workshops.sql
-- Cel: tabela zaakceptowanych warsztatów + RLS właściciela.
-- Do czego służy:
-- - przechowuje aktywne i oczekujące warsztaty
-- - wiąże warsztat z kontem użytkownika (owner_id)
-- Kiedy uruchomić: po supabase-02-admin-users.sql.
-- Wymagany: tak.
-- Dane testowe: nie.
-- Idempotencja: tak.
-- =====================================================

begin;

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  nip text,
  phone text,
  email text,
  city text,
  address text,
  description text,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.workshops add column if not exists owner_id uuid;
alter table public.workshops add column if not exists name text;
alter table public.workshops add column if not exists nip text;
alter table public.workshops add column if not exists phone text;
alter table public.workshops add column if not exists email text;
alter table public.workshops add column if not exists city text;
alter table public.workshops add column if not exists address text;
alter table public.workshops add column if not exists description text;
alter table public.workshops add column if not exists status text;
alter table public.workshops add column if not exists created_at timestamptz;
alter table public.workshops add column if not exists updated_at timestamptz;

alter table public.workshops alter column status set default 'pending';
alter table public.workshops alter column created_at set default now();
alter table public.workshops alter column updated_at set default now();
update public.workshops set status = 'pending' where status is null;
update public.workshops set created_at = now() where created_at is null;
update public.workshops set updated_at = now() where updated_at is null;

create index if not exists idx_workshops_owner_id on public.workshops(owner_id);
create index if not exists idx_workshops_status on public.workshops(status);
create index if not exists idx_workshops_owner_status on public.workshops(owner_id, status);

alter table public.workshops enable row level security;

drop policy if exists "workshops_select_own" on public.workshops;
create policy "workshops_select_own"
on public.workshops
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "workshops_insert_own" on public.workshops;
create policy "workshops_insert_own"
on public.workshops
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "workshops_update_own" on public.workshops;
create policy "workshops_update_own"
on public.workshops
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "workshops_delete_own" on public.workshops;
create policy "workshops_delete_own"
on public.workshops
for delete
to authenticated
using (auth.uid() = owner_id);

drop trigger if exists trg_workshops_updated_at on public.workshops;
create trigger trg_workshops_updated_at
before update on public.workshops
for each row
execute function public.set_updated_at();

commit;
