-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-04-workshop-leads.sql
-- Cel: tabela zgłoszeń warsztatów (leadów) + podstawowe polityki insert.
-- Do czego służy:
-- - zbiera zgłoszenia z formularza „Dołącz jako warsztat”
-- - przechowuje dane kontaktowe do moderacji przez admina
-- Kiedy uruchomić: po supabase-03-workshops.sql.
-- Wymagany: tak.
-- Dane testowe: nie.
-- Idempotencja: tak.
-- =====================================================

begin;

create table if not exists public.workshop_leads (
  id uuid primary key default gen_random_uuid(),
  workshop_name text not null,
  nip text,
  phone text,
  email text not null,
  city text,
  postal_code text,
  address text,
  contact_person text,
  description text,
  message text,
  status text default 'nowe_zgloszenie',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.workshop_leads add column if not exists workshop_name text;
alter table public.workshop_leads add column if not exists nip text;
alter table public.workshop_leads add column if not exists phone text;
alter table public.workshop_leads add column if not exists email text;
alter table public.workshop_leads add column if not exists city text;
alter table public.workshop_leads add column if not exists postal_code text;
alter table public.workshop_leads add column if not exists address text;
alter table public.workshop_leads add column if not exists contact_person text;
alter table public.workshop_leads add column if not exists description text;
alter table public.workshop_leads add column if not exists message text;
alter table public.workshop_leads add column if not exists status text;
alter table public.workshop_leads add column if not exists created_at timestamptz;
alter table public.workshop_leads add column if not exists updated_at timestamptz;

alter table public.workshop_leads alter column status set default 'nowe_zgloszenie';
alter table public.workshop_leads alter column created_at set default now();
alter table public.workshop_leads alter column updated_at set default now();
update public.workshop_leads set status = 'nowe_zgloszenie' where status is null;
update public.workshop_leads set created_at = now() where created_at is null;
update public.workshop_leads set updated_at = now() where updated_at is null;

create index if not exists idx_workshop_leads_created_at on public.workshop_leads(created_at desc);
create index if not exists idx_workshop_leads_status on public.workshop_leads(status);
create index if not exists idx_workshop_leads_city on public.workshop_leads(city);

alter table public.workshop_leads enable row level security;

-- Czyścimy stare polityki tej tabeli i zostawiamy tylko insert z formularza.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workshop_leads'
  loop
    execute format('drop policy if exists %I on public.workshop_leads', p.policyname);
  end loop;
end $$;

create policy "workshop_leads_insert_anon"
on public.workshop_leads
for insert
to anon
with check (true);

create policy "workshop_leads_insert_authenticated"
on public.workshop_leads
for insert
to authenticated
with check (true);

grant usage on schema public to anon, authenticated;
grant insert on table public.workshop_leads to anon, authenticated;

drop trigger if exists trg_workshop_leads_updated_at on public.workshop_leads;
create trigger trg_workshop_leads_updated_at
before update on public.workshop_leads
for each row
execute function public.set_updated_at();

commit;
