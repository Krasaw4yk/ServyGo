-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-09-admin-approval-functions.sql
-- Cel: uprawnienia admina do moderacji zgłoszeń i publikacji warsztatów.
-- Do czego służy:
-- - daje adminowi dostęp select/update do workshop_leads
-- - daje adminowi prawo update/select do workshops
-- - tworzy funkcję admin_approve_workshop_lead()
-- Kiedy uruchomić: po supabase-02, -03 i -04.
-- Wymagany: tak (dla panelu /admin).
-- Dane testowe: nie.
-- Idempotencja: tak.
-- =====================================================

begin;

alter table public.workshop_leads enable row level security;
alter table public.workshops enable row level security;

drop policy if exists "workshop_leads_select_admin_only" on public.workshop_leads;
create policy "workshop_leads_select_admin_only"
on public.workshop_leads
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

drop policy if exists "workshop_leads_update_admin_only" on public.workshop_leads;
create policy "workshop_leads_update_admin_only"
on public.workshop_leads
for update
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

drop policy if exists "workshops_update_status_admin_only" on public.workshops;
create policy "workshops_update_status_admin_only"
on public.workshops
for update
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

drop policy if exists "workshops_select_admin" on public.workshops;
create policy "workshops_select_admin"
on public.workshops
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

-- Akceptacja zgłoszenia: lead -> workshops oraz status approved.
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
  if st in ('approved', 'rejected', 'odmowil', 'aktywny', 'umowa_podpisana') then
    raise exception 'Zgłoszenie zostało już rozpatrzone';
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

grant execute on function public.admin_approve_workshop_lead(uuid) to authenticated;

commit;
