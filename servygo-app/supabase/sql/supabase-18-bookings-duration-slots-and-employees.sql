-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-18-bookings-duration-slots-and-employees.sql
--
-- Do czego służy:
-- - rozbudowuje system rezerwacji o przedziały czasu (start/end), statusy operacyjne
--   i ochronę przed nakładaniem terminów;
-- - dodaje tabelę pracowników warsztatu (`workshop_employees`) + RLS owner/admin;
-- - dodaje przypisanie pracownika do rezerwacji (`bookings.employee_id`);
-- - dodaje pola pod nowy flow rezerwacji (service_id, vehicle_data, dane klienta, notatki);
-- - dodaje RPC `create_booking_safe(...)` do bezpiecznego zapisu rezerwacji
--   z walidacją kolizji i automatycznym przypisaniem pracownika.
--
-- Jakie obiekty zmienia:
-- - `public.bookings` (kolumny + indeksy + constraints + trigger + statusy);
-- - `public.workshop_services` (kolumna `required_roles`);
-- - `public.workshop_employees` (nowa tabela + polityki RLS);
-- - funkcja `public.create_booking_safe(...)`.
--
-- Wymagany: tak (nowy silnik slotów 30 min i obsługa pracowników).
--
-- Czy można uruchomić wielokrotnie: tak (idempotentnie).
--
-- Kiedy uruchomić: po `supabase-17-workshop-availability-and-services.sql`.
-- =============================================================================

begin;

create extension if not exists btree_gist;

alter table public.bookings
  add column if not exists service_id uuid,
  add column if not exists vehicle_data jsonb,
  add column if not exists booking_date date,
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists client_name text,
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists employee_id uuid;

update public.bookings
set booking_date = coalesce(booking_date, date)
where booking_date is null and date is not null;

update public.bookings
set start_time = coalesce(start_time, nullif(time, '')::time)
where start_time is null and coalesce(time, '') ~ '^\d{2}:\d{2}$';

update public.bookings
set end_time = coalesce(end_time, (start_time + make_interval(mins => duration_minutes))::time)
where end_time is null and start_time is not null and duration_minutes is not null;

update public.bookings
set status = 'new'
where lower(trim(coalesce(status, ''))) = 'pending';

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('new', 'confirmed', 'cancelled', 'rejected', 'done', 'completed', 'pending'));

create index if not exists idx_bookings_workshop_date on public.bookings(workshop_id, booking_date);
create index if not exists idx_bookings_workshop_status on public.bookings(workshop_id, status);
create index if not exists idx_bookings_employee_date on public.bookings(employee_id, booking_date);

alter table public.workshop_services
  add column if not exists required_roles jsonb;

update public.workshop_services
set required_roles = '[]'::jsonb
where required_roles is null;

create table if not exists public.workshop_employees (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  role text not null,
  specializations jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workshop_employees_workshop on public.workshop_employees(workshop_id);
create index if not exists idx_workshop_employees_active on public.workshop_employees(workshop_id, is_active);

alter table public.bookings drop constraint if exists bookings_employee_fk;
alter table public.bookings
  add constraint bookings_employee_fk
  foreign key (employee_id) references public.workshop_employees(id) on delete set null;

alter table public.workshop_employees enable row level security;

drop policy if exists "workshop_employees_select_owner" on public.workshop_employees;
create policy "workshop_employees_select_owner"
on public.workshop_employees
for select
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_employees.workshop_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "workshop_employees_upsert_owner" on public.workshop_employees;
create policy "workshop_employees_upsert_owner"
on public.workshop_employees
for all
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_employees.workshop_id
      and w.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_employees.workshop_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "workshop_employees_admin" on public.workshop_employees;
create policy "workshop_employees_admin"
on public.workshop_employees
for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop trigger if exists trg_workshop_employees_updated_at on public.workshop_employees;
create trigger trg_workshop_employees_updated_at
before update on public.workshop_employees
for each row
execute function public.set_updated_at();

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
before update on public.bookings
for each row
execute function public.set_updated_at();

alter table public.bookings drop constraint if exists bookings_no_overlap_active;
alter table public.bookings
  add constraint bookings_no_overlap_active
  exclude using gist (
    workshop_id with =,
    employee_id with =,
    tsrange(
      (booking_date::timestamp + start_time),
      (booking_date::timestamp + end_time),
      '[)'
    ) with &&
  )
  where (
    employee_id is not null
    and status in ('new', 'confirmed')
    and booking_date is not null
    and start_time is not null
    and end_time is not null
  );

create or replace function public.create_booking_safe(
  p_workshop_id uuid,
  p_user_id uuid,
  p_service_id uuid,
  p_service_name text,
  p_vehicle_data jsonb,
  p_booking_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_notes text default null,
  p_employee_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_end_time time;
  v_employee_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if auth.uid() <> p_user_id then
    raise exception 'Forbidden';
  end if;
  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'duration_minutes musi być > 0';
  end if;

  v_end_time := (p_start_time + make_interval(mins => p_duration_minutes))::time;
  v_employee_id := p_employee_id;

  if v_employee_id is null then
    select e.id
    into v_employee_id
    from public.workshop_employees e
    where e.workshop_id = p_workshop_id
      and e.is_active = true
      and not exists (
        select 1
        from public.bookings b
        where b.workshop_id = p_workshop_id
          and b.employee_id = e.id
          and b.booking_date = p_booking_date
          and b.status in ('new', 'confirmed')
          and (p_start_time < b.end_time and v_end_time > b.start_time)
      )
    order by e.created_at asc
    limit 1;
  end if;

  if v_employee_id is null then
    raise exception 'Brak dostępnego pracownika dla tego terminu';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.workshop_id = p_workshop_id
      and b.employee_id = v_employee_id
      and b.booking_date = p_booking_date
      and b.status in ('new', 'confirmed')
      and (p_start_time < b.end_time and v_end_time > b.start_time)
  ) then
    raise exception 'SLOT_CONFLICT';
  end if;

  insert into public.bookings (
    user_id,
    workshop_id,
    service_id,
    service_name,
    vehicle_data,
    booking_date,
    start_time,
    end_time,
    duration_minutes,
    status,
    client_name,
    client_email,
    client_phone,
    notes,
    employee_id,
    workshop_name,
    price,
    date,
    time
  )
  values (
    p_user_id,
    p_workshop_id,
    p_service_id,
    p_service_name,
    coalesce(p_vehicle_data, '{}'::jsonb),
    p_booking_date,
    p_start_time,
    v_end_time,
    p_duration_minutes,
    'new',
    nullif(trim(coalesce(p_client_name, '')), ''),
    nullif(trim(coalesce(p_client_email, '')), ''),
    nullif(trim(coalesce(p_client_phone, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_employee_id,
    coalesce((select w.name from public.workshops w where w.id = p_workshop_id), ''),
    0,
    p_booking_date,
    to_char(p_start_time, 'HH24:MI')
  )
  returning id into v_id;

  return v_id;
end;
$fn$;

grant execute on function public.create_booking_safe(
  uuid, uuid, uuid, text, jsonb, date, time, integer, text, text, text, text, uuid
) to authenticated;

notify pgrst, 'reload schema';

commit;
