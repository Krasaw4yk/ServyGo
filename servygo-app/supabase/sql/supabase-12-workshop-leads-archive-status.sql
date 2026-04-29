-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-12-workshop-leads-archive-status.sql
--
-- Do czego służy:
-- - dokumentuje i wspiera status zarchiwizowanych zgłoszeń warsztatów (`archived`);
-- - blokuje akceptację (`admin_approve_workshop_lead`) dla zgłoszeń zarchiwizowanych;
-- - dodaje indeks pod filtrowanie listy po statusie (opcjonalnie przy dużej liczbie rekordów).
--
-- Jakie obiekty zmienia:
-- - kolumna `workshop_leads.status` (tylko komentarz — wartość `archived` zapisuje aplikacja);
-- - funkcja `public.admin_approve_workshop_lead(uuid)`;
-- - indeks `workshop_leads_status_norm_idx` (jeśli nie istnieje).
--
-- Wymagany: tak, jeśli panel admina ma archiwizować zgłoszenia i spójnie blokować akceptację.
--
-- Czy można uruchomić wielokrotnie: tak (`create or replace`, `create index if not exists`, `comment`).
--
-- Kiedy uruchomić: po `supabase-09-admin-approval-functions.sql` (funkcja admin już istnieje),
-- przed lub równolegle z wdrożeniem UI archiwizacji w `/admin`.
-- =============================================================================

begin;

comment on column public.workshop_leads.status is
  'Status zgłoszenia: m.in. nowe_zgloszenie, approved, rejected, archived (archiwizacja przez admina — bez usuwania rekordu).';

create index if not exists workshop_leads_status_norm_idx
  on public.workshop_leads (lower(trim(coalesce(status, ''))));

create or replace function public.admin_approve_workshop_lead(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.workshop_leads%rowtype;
  new_id uuid;
  combined_address text;
  st text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    raise exception 'Forbidden';
  end if;

  select * into r from public.workshop_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead not found';
  end if;

  st := lower(trim(coalesce(r.status, '')));
  if st in ('approved', 'rejected', 'odmowil', 'aktywny', 'umowa_podpisana', 'archived') then
    raise exception 'Zgłoszenie zostało już rozpatrzone lub zarchiwizowane';
  end if;

  combined_address := nullif(
    trim(both ' ' from concat_ws(' ', nullif(trim(r.postal_code), ''), nullif(trim(r.address), ''))),
    ''
  );

  insert into public.workshops (
    owner_id,
    name,
    nip,
    phone,
    email,
    city,
    address,
    description,
    status
  )
  values (
    null,
    r.workshop_name,
    r.nip,
    r.phone,
    r.email,
    r.city,
    combined_address,
    r.description,
    'aktywny'
  )
  returning id into new_id;

  update public.workshop_leads
  set status = 'approved', updated_at = now()
  where id = p_lead_id;

  return new_id;
end;
$$;

commit;
