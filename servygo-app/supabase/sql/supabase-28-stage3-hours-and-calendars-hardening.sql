-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-28-stage3-hours-and-calendars-hardening.sql
--
-- Cel:
-- - Etap 3: twarda walidacja godzin pracy w RPC rezerwacji;
-- - finalne zabezpieczenie akceptacji zmiany terminu przed kolizją slotów.
-- =============================================================================

begin;

create or replace function public.is_within_workshop_hours(
  p_workshop_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
)
returns boolean
language plpgsql
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
  if p_workshop_id is null or p_date is null or p_start_time is null or p_end_time is null then
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

  return p_start_time >= v_open and p_end_time <= v_close and p_end_time > p_start_time;
end;
$fn$;

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
  if not public.is_within_workshop_hours(p_workshop_id, p_booking_date, p_start_time, v_end_time) then
    raise exception 'OUTSIDE_OPENING_HOURS';
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
          and b.status in ('awaiting_quote', 'quote_sent', 'quote_accepted', 'awaiting_reschedule', 'confirmed', 'new')
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
      and b.status in ('awaiting_quote', 'quote_sent', 'quote_accepted', 'awaiting_reschedule', 'confirmed', 'new')
      and (p_start_time < b.end_time and v_end_time > b.start_time)
  ) then
    raise exception 'SLOT_CONFLICT';
  end if;

  insert into public.bookings (
    user_id, workshop_id, service_id, service_name, vehicle_data,
    booking_date, start_time, end_time, duration_minutes, status, quote_expires_at,
    client_name, client_email, client_phone, notes, employee_id,
    workshop_name, price, date, time
  )
  values (
    p_user_id, p_workshop_id, p_service_id, p_service_name, coalesce(p_vehicle_data, '{}'::jsonb),
    p_booking_date, p_start_time, v_end_time, p_duration_minutes, 'awaiting_quote', now() + interval '5 hours',
    nullif(trim(coalesce(p_client_name, '')), ''),
    nullif(trim(coalesce(p_client_email, '')), ''),
    nullif(trim(coalesce(p_client_phone, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_employee_id,
    coalesce((select w.name from public.workshops w where w.id = p_workshop_id), ''),
    0, p_booking_date, to_char(p_start_time, 'HH24:MI')
  )
  returning id into v_id;

  return v_id;
end;
$fn$;

create or replace function public.respond_booking_reschedule(
  p_booking_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user_id uuid;
  v_prev_status text;
  v_workshop_id uuid;
  v_employee_id uuid;
  v_new_date date;
  v_new_start time;
  v_new_end time;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select user_id, reschedule_prev_status, workshop_id, employee_id, proposed_booking_date, proposed_start_time, proposed_end_time
  into v_user_id, v_prev_status, v_workshop_id, v_employee_id, v_new_date, v_new_start, v_new_end
  from public.bookings
  where id = p_booking_id
    and status = 'awaiting_reschedule';

  if v_user_id is null then
    raise exception 'Brak aktywnej propozycji zmiany terminu';
  end if;
  if v_user_id is distinct from auth.uid() then
    raise exception 'Forbidden';
  end if;

  if p_accept then
    if not public.is_within_workshop_hours(v_workshop_id, v_new_date, v_new_start, v_new_end) then
      raise exception 'OUTSIDE_OPENING_HOURS';
    end if;

    if exists (
      select 1
      from public.bookings b
      where b.id <> p_booking_id
        and b.employee_id = v_employee_id
        and b.booking_date = v_new_date
        and b.status in ('awaiting_quote', 'quote_sent', 'quote_accepted', 'awaiting_reschedule', 'confirmed', 'new')
        and (v_new_start < b.end_time and v_new_end > b.start_time)
    ) then
      raise exception 'SLOT_CONFLICT';
    end if;

    update public.bookings
    set booking_date = proposed_booking_date,
        start_time = proposed_start_time,
        end_time = proposed_end_time,
        date = proposed_booking_date,
        time = to_char(proposed_start_time, 'HH24:MI'),
        status = 'confirmed',
        proposed_booking_date = null,
        proposed_start_time = null,
        proposed_end_time = null
    where id = p_booking_id;
    return 'confirmed';
  end if;

  update public.bookings
  set status = coalesce(nullif(v_prev_status, ''), 'confirmed'),
      proposed_booking_date = null,
      proposed_start_time = null,
      proposed_end_time = null
  where id = p_booking_id;

  return 'rejected';
end;
$fn$;

grant execute on function public.is_within_workshop_hours(uuid, date, time, time) to authenticated;

notify pgrst, 'reload schema';

commit;
