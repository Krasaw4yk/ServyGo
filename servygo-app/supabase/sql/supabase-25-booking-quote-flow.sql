-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-25-booking-quote-flow.sql
--
-- Cel:
-- - wdrożenie flow wyceny i negocjacji dla rezerwacji;
-- - blokowanie slotów dla statusów "awaiting_quote" i "quote_sent";
-- - dodanie RPC do wysyłki wyceny, odpowiedzi klienta i anulowania;
-- - dodanie funkcji cleanup dla przeterminowanych wycen (pod CRON/Edge Function).
-- =============================================================================

begin;

alter table public.bookings
  add column if not exists final_price numeric,
  add column if not exists quote_sent_at timestamptz,
  add column if not exists quote_expires_at timestamptz,
  add column if not exists cancel_reason text;

update public.bookings
set status = 'awaiting_quote'
where lower(trim(coalesce(status, ''))) in ('pending', 'new');

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (
    status in (
      'awaiting_quote',
      'quote_sent',
      'quote_accepted',
      'quote_rejected',
      'confirmed',
      'cancelled_by_client',
      'cancelled_by_workshop',
      'cancelled_by_system',
      'completed',
      'rejected',
      'cancelled',
      'done',
      'new',
      'pending'
    )
  );

update public.bookings
set quote_expires_at = coalesce(quote_expires_at, now() + interval '5 hours')
where status = 'awaiting_quote';

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
    and status in ('awaiting_quote', 'quote_sent', 'quote_accepted', 'confirmed', 'new')
    and booking_date is not null
    and start_time is not null
    and end_time is not null
  );

create index if not exists idx_bookings_quote_expiry
  on public.bookings(quote_expires_at)
  where status in ('awaiting_quote', 'quote_sent');

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
          and b.status in ('awaiting_quote', 'quote_sent', 'quote_accepted', 'confirmed', 'new')
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
      and b.status in ('awaiting_quote', 'quote_sent', 'quote_accepted', 'confirmed', 'new')
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
    quote_expires_at,
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
    'awaiting_quote',
    now() + interval '5 hours',
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

create or replace function public.send_booking_quote(
  p_booking_id uuid,
  p_final_price numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_final_price is null or p_final_price < 0 then
    raise exception 'Cena końcowa musi być większa lub równa 0';
  end if;

  select w.owner_id
  into v_owner_id
  from public.bookings b
  join public.workshops w on w.id = b.workshop_id
  where b.id = p_booking_id;

  if v_owner_id is distinct from auth.uid() then
    raise exception 'Forbidden';
  end if;

  update public.bookings b
  set final_price = p_final_price,
      quote_sent_at = now(),
      quote_expires_at = now() + interval '5 hours',
      status = 'quote_sent',
      cancel_reason = null
  where b.id = p_booking_id
    and b.status not in ('confirmed', 'completed', 'cancelled_by_client', 'cancelled_by_workshop', 'cancelled_by_system');

  if not found then
    raise exception 'Nie można wysłać wyceny dla tej rezerwacji';
  end if;
end;
$fn$;

create or replace function public.respond_booking_quote(
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
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select b.user_id, b.status
  into v_user_id, v_status
  from public.bookings b
  where b.id = p_booking_id;

  if v_user_id is distinct from auth.uid() then
    raise exception 'Forbidden';
  end if;

  if v_status <> 'quote_sent' then
    raise exception 'Wycena nie jest aktywna';
  end if;

  if p_accept then
    update public.bookings
    set status = 'confirmed',
        cancel_reason = null
    where id = p_booking_id;
    return 'confirmed';
  end if;

  update public.bookings
  set status = 'quote_rejected'
  where id = p_booking_id;
  return 'quote_rejected';
end;
$fn$;

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_booking_user uuid;
  v_workshop_owner uuid;
  v_new_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Powód anulowania jest wymagany';
  end if;

  select b.user_id, w.owner_id
  into v_booking_user, v_workshop_owner
  from public.bookings b
  join public.workshops w on w.id = b.workshop_id
  where b.id = p_booking_id;

  if auth.uid() = v_booking_user then
    v_new_status := 'cancelled_by_client';
  elsif auth.uid() = v_workshop_owner then
    v_new_status := 'cancelled_by_workshop';
  else
    raise exception 'Forbidden';
  end if;

  update public.bookings
  set status = v_new_status,
      cancel_reason = trim(p_reason)
  where id = p_booking_id;

  return v_new_status;
end;
$fn$;

create or replace function public.expire_booking_quotes()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer := 0;
begin
  update public.bookings
  set status = 'cancelled_by_system',
      cancel_reason = 'Wycena wygasła automatycznie.'
  where status in ('awaiting_quote', 'quote_sent')
    and quote_expires_at is not null
    and quote_expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

grant execute on function public.send_booking_quote(uuid, numeric) to authenticated;
grant execute on function public.respond_booking_quote(uuid, boolean) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.expire_booking_quotes() to authenticated;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('servygo_expire_booking_quotes');
    perform cron.schedule(
      'servygo_expire_booking_quotes',
      '*/10 * * * *',
      $cron$select public.expire_booking_quotes();$cron$
    );
  end if;
exception
  when undefined_table or undefined_function then
    null;
end $do$;

notify pgrst, 'reload schema';

commit;
