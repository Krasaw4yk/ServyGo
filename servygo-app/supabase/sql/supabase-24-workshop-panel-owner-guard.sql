-- =============================================================================
-- ServyGo / Supabase
-- Plik: supabase/sql/supabase-24-workshop-panel-owner-guard.sql
--
-- Cel:
-- - doprecyzowanie relacji owner_id <-> warsztat pod panel właściciela,
-- - dopięcie relacji bookings.workshop_id -> workshops.id,
-- - walidacja statusów warsztatu.
--
-- Dlaczego:
-- Panel warsztatu ma działać tylko dla aktywnego właściciela warsztatu
-- (`workshops.owner_id = auth.uid()`), dlatego dbamy o spójność danych.
--
-- Idempotencja: tak.
-- =============================================================================

begin;

-- 1) Uzupełnij owner_id, jeżeli historycznie było puste.
update public.workshops
set owner_id = owner_user_id
where owner_id is null
  and owner_user_id is not null;

-- 2) Normalizacja historycznych statusów (żeby check nie wywalił się na starych danych).
update public.workshops
set status = lower(trim(coalesce(status, 'pending')));

update public.workshops
set status = 'approved'
where status in ('zaakceptowany', 'zaakceptowana');

update public.workshops
set status = 'active'
where status in ('aktywny', 'aktywna');

update public.workshops
set status = 'pending'
where status not in ('pending', 'active', 'approved', 'rejected', 'suspended');

-- 3) owner_id wymagane dla statusów aktywnych/zaakceptowanych.
-- Jeśli historyczny rekord był "active/approved" bez owner_id, cofamy go do "pending".
update public.workshops
set status = 'pending'
where owner_id is null
  and status in ('active', 'approved');

-- (Nie wymuszamy NOT NULL globalnie, aby nie blokować starych rekordów roboczych).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workshops_active_owner_required'
  ) then
    alter table public.workshops
      add constraint workshops_active_owner_required
      check (
        lower(coalesce(status, 'pending')) not in ('active', 'approved', 'zaakceptowany')
        or owner_id is not null
      );
  end if;
end $$;

-- 4) Ujednolicenie statusów warsztatu.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workshops_status_check_v2'
  ) then
    alter table public.workshops drop constraint if exists workshops_status_check;
    alter table public.workshops
      add constraint workshops_status_check_v2
      check (lower(coalesce(status, 'pending')) in ('pending', 'active', 'approved', 'rejected', 'suspended'));
  end if;
end $$;

-- 5) Relacja bookings -> workshops (jeśli brak).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_workshop_fk'
  ) then
    alter table public.bookings
      add constraint bookings_workshop_fk
      foreign key (workshop_id) references public.workshops(id) on delete cascade;
  end if;
end $$;

-- 6) Indeksy pod panel warsztatu.
create index if not exists idx_workshops_owner_status_panel on public.workshops(owner_id, status);
create index if not exists idx_bookings_workshop_created_panel on public.bookings(workshop_id, created_at desc);

commit;
