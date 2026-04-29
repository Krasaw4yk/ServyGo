-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-13-workshop-leads-columns-public-visibility.sql
--
-- Do czego służy:
-- - rozszerza zgłoszenia warsztatów o URL Map Google oraz pole tekstowe z usługami;
-- - rozszerza tabelę warsztatów o URL Map i podsumowanie usług z leada;
-- - udostępnia publicznie (anon + zalogowany) odczyt warsztatów w statusach aktywnych
--   oraz powiązanych usług (tylko dla widocznych warsztatów);
-- - przy akceptacji leada tworzy warsztat ze statusem `active`, kopiuje mapę i usługi,
--   zapisuje usługi do `workshop_services` na podstawie tekstu z leada;
-- - blokuje akceptację leadów już rozstrzygniętych (w tym zarchiwizowanych).
--
-- Jakie obiekty zmienia:
-- - `workshop_leads`: kolumny `google_maps_url`, `services`; domyślny `status` = `pending`;
-- - `workshops`: kolumny `google_maps_url`, `services_summary`;
-- - funkcja `public.admin_approve_workshop_lead(uuid)`;
-- - polityki RLS: `workshops_select_public_active`, `workshop_services_select_public_active`;
-- - uprawnienia `SELECT` dla `anon` na `workshops` i `workshop_services`.
--
-- Wymagany: tak dla pełnego przepływu formularz → lead → akceptacja → widoczność publiczna.
--
-- Czy można uruchomić wielokrotnie: tak (`add column if not exists`, `drop policy if exists`, `create or replace`).
--
-- Kiedy uruchomić: po `supabase-12-workshop-leads-archive-status.sql` (nadpisuje tę samą funkcję RPC).
-- =============================================================================

begin;

-- --- Kolumny leadów i warsztatów ------------------------------------------------

alter table public.workshop_leads add column if not exists google_maps_url text;
alter table public.workshop_leads add column if not exists services text;

alter table public.workshops add column if not exists google_maps_url text;
alter table public.workshops add column if not exists services_summary text;

comment on column public.workshop_leads.google_maps_url is 'Opcjonalny link do lokalizacji w Google Maps podany w formularzu zgłoszeniowym.';
comment on column public.workshop_leads.services is 'Lista / opis usług z formularza (tekst), przed migracją do workshop_services po akceptacji.';
comment on column public.workshops.google_maps_url is 'Link Map Google przeniesiony ze zgłoszenia lub uzupełniony w panelu.';
comment on column public.workshops.services_summary is 'Skrócony opis usług ze zgłoszenia (tekst z leada).';

alter table public.workshop_leads alter column status set default 'pending';

-- --- Publiczny odczyt warsztatów i usług (tylko „opublikowane”) -----------------

grant select on table public.workshops to anon;
grant select on table public.workshop_services to anon;

drop policy if exists "workshops_select_public_active" on public.workshops;
create policy "workshops_select_public_active"
on public.workshops
for select
to anon, authenticated
using (
  lower(trim(coalesce(status, ''))) in ('active', 'approved', 'aktywny')
);

drop policy if exists "workshop_services_select_public_active" on public.workshop_services;
create policy "workshop_services_select_public_active"
on public.workshop_services
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and lower(trim(coalesce(w.status, ''))) in ('active', 'approved', 'aktywny')
  )
);

-- --- Akceptacja leada: warsztat active + usługi z tekstu ------------------------

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
  svc_piece text;
  parts text[];
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
    null,
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
$$;

commit;
