-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-15-workshop-owner-access.sql
--
-- Do czego służy:
-- - dodaje kolumnę `owner_user_id` jako pole wyliczane (GENERATED) z `owner_id`,
--   aby w dokumentacji i API jasno wskazać powiązanie warsztatu z `auth.users`;
-- - zmienia RPC `admin_approve_workshop_lead`: wymaga UUID właściciela (Auth) i
--   zapisuje go w `workshops.owner_id` przy tworzeniu warsztatu;
-- - rozszerza `bookings`: statusy `completed`, `rejected`, opcjonalne `car_id`;
--   przed zmianą CHECK normalizuje znane statusy legacy (np. `new`/`done`), żeby
--   migracja nie padała na istniejących wierszach (błąd 23514);
-- - RLS: właściciel warsztatu widzi i aktualizuje rezerwacje swojego warsztatu;
-- - RLS: właściciel może czytać profile i auta klientów powiązanych z rezerwacją;
-- - trigger: właściciel (bez roli admin) nie może zmieniać `status` warsztatu.
--
-- Jakie obiekty zmienia:
-- - `public.workshops` (kolumna `owner_user_id`, trigger, funkcja triggera);
-- - `public.bookings` (kolumna `car_id`, normalizacja statusów przed CHECK, constraint statusu);
-- - funkcja `public.admin_approve_workshop_lead(uuid, uuid)`;
-- - polityki: `bookings_select_workshop_owner`, `bookings_update_workshop_owner`,
--   `profiles_select_workshop_booking_counterparty`, `cars_select_workshop_booking_counterparty`.
--
-- Wymagany: tak dla onboarding właściciela + panelu `/workshop-panel` oraz API akceptacji.
--
-- Czy można uruchomić wielokrotnie: tak (idempotentnie w zakresie `drop/create`).
--
-- Kiedy uruchomić: po `supabase-14-workshops-admin-manage.sql`.
--
-- Uwaga: szablony e-mail (zaproszenie / reset hasła) konfigurujesz w Supabase Auth
-- (Dashboard → Authentication → Email). Nie wysyłamy hasła z aplikacji.
-- =============================================================================

begin;

-- --- owner_user_id: alias wyliczany z owner_id (jedno źródło prawdy: owner_id) ----
do $m$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workshops'
      and column_name = 'owner_user_id'
  ) then
    alter table public.workshops
      add column owner_user_id uuid generated always as (owner_id) stored;
  end if;
end
$m$;

comment on column public.workshops.owner_user_id is
  'UUID użytkownika Auth będącego właścicielem warsztatu (zsynchronizowane z owner_id).';

-- --- Rezerwacje: auto + szerszy status -----------------------------------------
alter table public.bookings add column if not exists car_id uuid references public.cars(id) on delete set null;

-- Istniejące bazy: dopasuj statusy przed nowym CHECK (np. `new`/`done` z migracji 18
-- uruchomionej przed 15, lub inne legacy spoza listy poniżej — inaczej ADD CONSTRAINT
-- kończy się błędem 23514 „violated by some row”).
update public.bookings b
set status = v.mapped
from (
  values
    ('new', 'pending'),
    ('done', 'completed'),
    ('pending_quote', 'pending'),
    ('quote_sent', 'confirmed'),
    ('quote_rejected', 'rejected'),
    ('awaiting_reschedule', 'pending'),
    ('awaiting_quote', 'pending'),
    ('quote_accepted', 'confirmed'),
    ('cancelled_by_client', 'cancelled'),
    ('cancelled_by_workshop', 'cancelled'),
    ('cancelled_by_system', 'cancelled')
) as v(legacy, mapped)
where lower(trim(coalesce(b.status, ''))) = v.legacy;

update public.bookings
set status = 'pending'
where lower(trim(coalesce(status, ''))) not in ('pending', 'confirmed', 'cancelled', 'completed', 'rejected');

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'rejected'));

comment on column public.bookings.car_id is 'Opcjonalne powiązanie z autem klienta (cars).';

-- --- Właściciel nie zmienia statusu warsztatu (tylko admin / polityki admina) ---
create or replace function public.workshops_block_owner_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if coalesce(trim(new.status), '') is not distinct from coalesce(trim(old.status), '') then
    return new;
  end if;
  if old.owner_id = auth.uid()
     and not exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  then
    raise exception 'Tylko administrator może zmienić status warsztatu.';
  end if;
  return new;
end;
$f$;

drop trigger if exists trg_workshops_block_owner_status on public.workshops;
create trigger trg_workshops_block_owner_status
before update on public.workshops
for each row
execute function public.workshops_block_owner_status_change();

-- --- Akceptacja leada z przypisaniem właściciela (Auth user id) -----------------
drop function if exists public.admin_approve_workshop_lead(uuid);

create or replace function public.admin_approve_workshop_lead(
  p_lead_id uuid,
  p_owner_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r public.workshop_leads%rowtype;
  new_id uuid;
  combined_address text;
  st text;
  svc_piece text;
  parts text[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    raise exception 'Forbidden';
  end if;

  if p_owner_user_id is null then
    raise exception 'owner_user_id is required';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_owner_user_id) then
    raise exception 'owner_user_id not found in auth.users';
  end if;

  select * into r from public.workshop_leads where id = p_lead_id;
  if not found then
    raise exception 'Lead not found';
  end if;

  st := lower(trim(coalesce(r.status, '')));
  if st in ('approved', 'rejected', 'odmowil', 'aktywny', 'umowa_podpisana', 'archived', 'active') then
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
    status,
    google_maps_url,
    services_summary
  )
  values (
    p_owner_user_id,
    r.workshop_name,
    r.nip,
    r.phone,
    r.email,
    r.city,
    combined_address,
    r.description,
    'active',
    nullif(trim(r.google_maps_url), ''),
    nullif(trim(r.services), '')
  )
  returning id into new_id;

  if coalesce(trim(r.services), '') <> '' then
    parts := string_to_array(
      replace(replace(replace(coalesce(r.services, ''), E'\r', ''), E'\n', ','), ';', ','),
      ','
    );
    foreach svc_piece in array parts
    loop
      svc_piece := trim(svc_piece);
      if length(svc_piece) > 0 then
        insert into public.workshop_services (workshop_id, service_name)
        values (new_id, svc_piece);
      end if;
    end loop;
  end if;

  update public.workshop_leads
  set status = 'approved', updated_at = now()
  where id = p_lead_id;

  return new_id;
end;
$fn$;

grant execute on function public.admin_approve_workshop_lead(uuid, uuid) to authenticated;

-- --- RLS: właściciel warsztatu — rezerwacje ------------------------------------
drop policy if exists "bookings_select_workshop_owner" on public.bookings;
create policy "bookings_select_workshop_owner"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = bookings.workshop_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "bookings_update_workshop_owner" on public.bookings;
create policy "bookings_update_workshop_owner"
on public.bookings
for update
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = bookings.workshop_id
      and w.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workshops w
    where w.id = bookings.workshop_id
      and w.owner_id = auth.uid()
  )
);

-- --- RLS: profil klienta (kontekst rezerwacji u właściciela warsztatu) ----------
drop policy if exists "profiles_select_workshop_booking_counterparty" on public.profiles;
create policy "profiles_select_workshop_booking_counterparty"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.workshops w on w.id = b.workshop_id
    where b.user_id = profiles.id
      and w.owner_id = auth.uid()
  )
);

-- --- RLS: auta klientów z rezerwacją u tego warsztatu ---------------------------
drop policy if exists "cars_select_workshop_booking_counterparty" on public.cars;
create policy "cars_select_workshop_booking_counterparty"
on public.cars
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.workshops w on w.id = b.workshop_id
    where b.user_id = cars.user_id
      and w.owner_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
