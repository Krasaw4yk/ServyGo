-- =====================================================
-- LEGACY / ARCHIWUM
-- Plik historyczny: supabase-admin-approve-lead.sql
-- Status: przestarzały (zastąpiony przez supabase/sql/supabase-09-admin-approval-functions.sql
-- oraz supabase/sql/supabase-10-seed-test-workshop-lead.sql).
-- Instrukcja: SUPABASE_SQL_INSTRUKCJA.md
-- =====================================================
-- ServyGo: admin może przeglądać wszystkie warsztaty oraz akceptować zgłoszenie (lead → wpis w workshops).
-- Uruchom w Supabase SQL Editor po supabase-admin-users.sql.

begin;

-- Admin widzi wszystkie rekordy workshops (do panelu „Warsztaty”).
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

-- Akceptacja: tworzy warsztat (status aktywny) i ustawia lead na approved.
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

-- Przykładowe zgłoszenie do testów UI (tylko dla admin_users).
create or replace function public.admin_seed_test_workshop_lead()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  suffix text := substr(md5(random()::text), 1, 8);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    raise exception 'Forbidden';
  end if;

  insert into public.workshop_leads (
    workshop_name,
    email,
    city,
    phone,
    address,
    postal_code,
    description,
    message,
    contact_person,
    nip,
    status
  )
  values (
    'Testowy warsztat ServyGo (panel admina)',
    'test-warsztat-' || suffix || '@example.test',
    'Bielsko-Biała',
    '+48 123 456 789',
    'ul. Testowa 1',
    '43-300',
    'Przykładowy opis utworzony z panelu administratora do testów listy zgłoszeń.',
    'Wiadomość testowa z przycisku „Dodaj testowe zgłoszenie”.',
    'Jan Tester (dane fikcyjne)',
    '0000000000',
    'pending'
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.admin_seed_test_workshop_lead() to authenticated;

commit;
