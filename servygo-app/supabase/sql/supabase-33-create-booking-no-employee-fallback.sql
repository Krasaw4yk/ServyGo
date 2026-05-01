-- ServyGo — create_booking_safe: fallback bez przypisanego pracownika
-- Cel: jeżeli warsztat nie ma jeszcze pracowników, ale ma otwarte godziny,
-- klient może zapisać rezerwację (employee_id = null), zamiast dostawać błąd.

begin;

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

  if v_employee_id is not null and exists (
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

grant execute on function public.create_booking_safe(
  uuid, uuid, uuid, text, jsonb, date, time, integer, text, text, text, text, uuid
) to authenticated;

notify pgrst, 'reload schema';

commit;
