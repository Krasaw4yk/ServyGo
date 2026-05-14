-- =============================================================================
-- ServyGo / Supabase — supabase-60-booking-type-repair-extras.sql
--
-- Cel (MVP):
-- - booking_type: exact_time | dropoff
-- - Rozszerzenie statusów rezerwacji o etapy naprawy (bez usuwania legacy)
-- - Tabela booking_extra_quotes + RLS
-- - create_booking_safe: dropoff = krótki slot kalendarzowy (30 min), pełny
--   duration_minutes zapisany dla zakresu usług; walidacja godziny dostawy
-- - is_workshop_arrival_time_allowed: godzina dostawy w [open, close]
-- Idempotencja: tak (IF NOT EXISTS / DROP IF EXISTS tam gdzie trzeba).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. booking_type na rezerwacji
-- -----------------------------------------------------------------------------
alter table public.bookings
  add column if not exists booking_type text not null default 'exact_time';

alter table public.bookings drop constraint if exists bookings_booking_type_check;

alter table public.bookings
  add constraint bookings_booking_type_check
  check (booking_type in ('exact_time', 'dropoff'));

comment on column public.bookings.booking_type is
  'exact_time = rezerwacja godzinowa; dropoff = zostaw auto (godzina = dostarczenie).';

-- -----------------------------------------------------------------------------
-- 2. Statusy rezerwacji — dopisanie etapów naprawy (zachowanie wartości legacy)
-- -----------------------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check
  check (
    status in (
      'pending_quote',
      'quote_sent',
      'awaiting_new_quote',
      'awaiting_quote',
      'new',
      'pending',
      'quote_accepted',
      'confirmed',
      'quote_rejected',
      'cancelled',
      'completed',
      'awaiting_reschedule',
      'rejected',
      'done',
      'cancelled_by_client',
      'cancelled_by_workshop',
      'cancelled_by_system',
      'service_not_completed',
      'no_show',
      'car_delivered',
      'in_progress',
      'waiting_customer_approval',
      'ready_for_pickup'
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Walidacja godziny dostawy (bez wymogu „end <= close” dla całego serwisu)
-- -----------------------------------------------------------------------------
create or replace function public.is_workshop_arrival_time_allowed(
  p_workshop_id uuid,
  p_date date,
  p_start_time time
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_opening_raw text;
  v_opening jsonb := '{}'::jsonb;
  v_exception record;
  v_day_key text;
  v_day jsonb;
  v_is_closed boolean;
  v_open time;
  v_close time;
begin
  if p_workshop_id is null or p_date is null or p_start_time is null then
    return false;
  end if;

  select w.opening_hours into v_opening_raw
  from public.workshops w
  where w.id = p_workshop_id;

  if coalesce(trim(v_opening_raw), '') <> '' then
    begin
      v_opening := v_opening_raw::jsonb;
    exception
      when others then
        v_opening := '{}'::jsonb;
    end;
  end if;

  select e.is_closed, e.open_time, e.close_time
  into v_exception
  from public.workshop_availability_exceptions e
  where e.workshop_id = p_workshop_id
    and e.date = p_date
  limit 1;

  v_day_key := case extract(dow from p_date)
    when 0 then 'sun'
    when 1 then 'mon'
    when 2 then 'tue'
    when 3 then 'wed'
    when 4 then 'thu'
    when 5 then 'fri'
    else 'sat'
  end;

  v_day := coalesce(v_opening -> v_day_key, '{}'::jsonb);
  v_is_closed := coalesce((v_day ->> 'closed')::boolean, false);
  v_open := coalesce(nullif(v_day ->> 'open', '')::time, '08:00'::time);
  v_close := coalesce(nullif(v_day ->> 'close', '')::time, '17:00'::time);

  if found then
    if coalesce(v_exception.is_closed, false) then
      return false;
    end if;
    v_open := coalesce(v_exception.open_time, v_open);
    v_close := coalesce(v_exception.close_time, v_close);
  elsif v_is_closed then
    return false;
  end if;

  if v_close <= v_open then
    return false;
  end if;

  return p_start_time >= v_open and p_start_time <= v_close;
end;
$fn$;

grant execute on function public.is_workshop_arrival_time_allowed(uuid, date, time) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. create_booking_safe — ostatni param: p_booking_type (domyślnie exact_time)
--    Najpierw usuń starą sygnaturę (15 arg.), żeby nie zostało przeciążenia w PG.
-- -----------------------------------------------------------------------------
drop function if exists public.create_booking_safe(
  uuid, uuid, uuid, text, jsonb, date, time, integer, text, text, text, text, text, text, uuid
);

drop function if exists public.create_booking_safe(
  uuid, uuid, uuid, text, jsonb, date, time, integer, text, text, text, text, text, text, uuid, text
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
  p_problem_description text default null,
  p_service_category text default null,
  p_employee_id uuid default null,
  p_booking_type text default 'exact_time'
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
  v_kind text := lower(trim(coalesce(p_booking_type, 'exact_time')));
  v_slot_mins int;
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

  if v_kind not in ('exact_time', 'dropoff') then
    raise exception 'INVALID_BOOKING_TYPE';
  end if;

  if v_kind = 'dropoff' then
    if not public.is_workshop_arrival_time_allowed(p_workshop_id, p_booking_date, p_start_time) then
      raise exception 'OUTSIDE_OPENING_HOURS';
    end if;
    v_slot_mins := 30;
    v_end_time := (p_start_time + make_interval(mins => v_slot_mins))::time;
  else
    v_end_time := (p_start_time + make_interval(mins => p_duration_minutes))::time;
    if not public.is_within_workshop_hours(p_workshop_id, p_booking_date, p_start_time, v_end_time) then
      raise exception 'OUTSIDE_OPENING_HOURS';
    end if;
  end if;

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
          and b.status in ('pending_quote', 'quote_sent', 'quote_rejected', 'awaiting_reschedule', 'confirmed')
          and (p_start_time < b.end_time and v_end_time > b.start_time)
      )
    order by e.created_at asc
    limit 1;
  end if;

  if v_employee_id is not null and exists (
    select 1
    from public.bookings b
    where b.workshop_id = p_workshop_id
      and b.employee_id = v_employee_id
      and b.booking_date = p_booking_date
      and b.status in ('pending_quote', 'quote_sent', 'quote_rejected', 'awaiting_reschedule', 'confirmed')
      and (p_start_time < b.end_time and v_end_time > b.start_time)
  ) then
    raise exception 'SLOT_CONFLICT';
  end if;

  insert into public.bookings (
    user_id, workshop_id, service_id, service_name, vehicle_data,
    booking_date, start_time, end_time, duration_minutes, status, quote_expires_at,
    client_name, client_email, client_phone, notes, employee_id,
    workshop_name, price, date, time,
    problem_description, service_category, booking_type
  )
  values (
    p_user_id, p_workshop_id, p_service_id, p_service_name, coalesce(p_vehicle_data, '{}'::jsonb),
    p_booking_date, p_start_time, v_end_time, p_duration_minutes, 'pending_quote', now() + interval '5 hours',
    nullif(trim(coalesce(p_client_name, '')), ''),
    nullif(trim(coalesce(p_client_email, '')), ''),
    nullif(trim(coalesce(p_client_phone, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_employee_id,
    coalesce((select w.name from public.workshops w where w.id = p_workshop_id), ''),
    0, p_booking_date, to_char(p_start_time, 'HH24:MI'),
    nullif(trim(coalesce(p_problem_description, '')), ''),
    nullif(trim(coalesce(p_service_category, '')), ''),
    v_kind
  )
  returning id into v_id;

  return v_id;
end;
$fn$;

grant execute on function public.create_booking_safe(
  uuid, uuid, uuid, text, jsonb, date, time, integer, text, text, text, text, text, text, uuid, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. booking_extra_quotes
-- -----------------------------------------------------------------------------
create table if not exists public.booking_extra_quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  title text not null default 'Dodatkowe usługi',
  description text,
  items jsonb not null default '[]'::jsonb,
  extra_price numeric,
  total_price_after_accept numeric,
  extra_time_minutes integer,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint booking_extra_quotes_status_check
    check (status in ('pending', 'accepted', 'rejected'))
);

create index if not exists booking_extra_quotes_booking_id_idx
  on public.booking_extra_quotes(booking_id, created_at desc);

comment on table public.booking_extra_quotes is
  'Propozycje dodatkowych usług od warsztatu; klient akceptuje/odrzuca w ServyGo (MVP).';

alter table public.booking_extra_quotes enable row level security;

revoke all on table public.booking_extra_quotes from anon;

grant select, insert, update on table public.booking_extra_quotes to authenticated;

drop policy if exists "booking_extra_quotes_select_participants" on public.booking_extra_quotes;
create policy "booking_extra_quotes_select_participants"
on public.booking_extra_quotes
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_extra_quotes.booking_id
      and b.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    join public.workshops w on w.id = b.workshop_id
    where b.id = booking_extra_quotes.booking_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "booking_extra_quotes_insert_workshop" on public.booking_extra_quotes;
create policy "booking_extra_quotes_insert_workshop"
on public.booking_extra_quotes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.bookings b
    join public.workshops w on w.id = b.workshop_id
    where b.id = booking_extra_quotes.booking_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "booking_extra_quotes_update_participants" on public.booking_extra_quotes;
create policy "booking_extra_quotes_update_participants"
on public.booking_extra_quotes
for update
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_extra_quotes.booking_id
      and b.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    join public.workshops w on w.id = b.workshop_id
    where b.id = booking_extra_quotes.booking_id
      and w.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_extra_quotes.booking_id
      and b.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    join public.workshops w on w.id = b.workshop_id
    where b.id = booking_extra_quotes.booking_id
      and w.owner_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
