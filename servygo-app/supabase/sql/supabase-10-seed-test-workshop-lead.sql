-- =====================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-10-seed-test-workshop-lead.sql
-- Cel: testowa funkcja do dodania przykładowego zgłoszenia warsztatu.
-- Do czego służy:
-- - zasila panel admina przykładowym rekordem workshop_leads
-- - umożliwia szybki test UI akceptacji/odrzucenia
-- Kiedy uruchomić: po supabase-09-admin-approval-functions.sql.
-- Wymagany: nie (opcjonalny, tylko testy).
-- Dane testowe: tak.
-- Produkcja: nie jest wymagana.
-- Idempotencja: tak (create or replace).
-- =====================================================

begin;

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
    google_maps_url,
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
    'https://www.google.com/maps/search/?api=1&query=Bielsko-Biala+ul.+Testowa+1',
    'pending'
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.admin_seed_test_workshop_lead() to authenticated;

-- Wymuszenie odświeżenia cache schematu PostgREST.
notify pgrst, 'reload schema';

commit;
