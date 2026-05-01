-- =============================================================================
-- ServyGo — supabase-36-booking-status-unified-flow.sql
--
-- Cel (bez DROP/TRUNCATE danych):
-- - Jedna spójna warstwa statusów: pending_quote, quote_sent, confirmed, quote_rejected,
--   cancelled (+ cancelled_by / cancelled_at / cancellation_reason), awaiting_reschedule
--   (+ reschedule_status, proposed_by).
-- - Migracja istniejących wierszy z legacy (awaiting_quote, cancelled_by_*, quote_accepted, …).
-- - RPC: create_booking_safe → pending_quote; send_booking_quote → quote_status sent;
--   respond_booking_quote → quote_decision_at; cancel_booking → cancelled + metadane;
--   expire_booking_quotes → cancelled/system; propose/respond reschedule → reschedule_status;
--   list_booking_slot_blocks_public + nakładki slotów — zsynchronizowane listy statusów.
-- =============================================================================

begin;

alter table public.bookings
  add column if not exists quote_decision_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_reason text,
  add column if not exists reschedule_status text,
  add column if not exists reschedule_note text,
  add column if not exists proposed_by text;

comment on column public.bookings.quote_decision_at is 'Czas decyzji klienta (akceptacja/odrzucenie wyceny).';
comment on column public.bookings.cancelled_at is 'Czas anulowania rezerwacji.';
comment on column public.bookings.cancelled_by is 'Kto anulował: client | workshop | system';
comment on column public.bookings.cancellation_reason is 'Powód anulowania (równolegle do cancel_reason dla kompatybilności).';
comment on column public.bookings.reschedule_status is 'Np. pending_client_decision przy propozycji zmiany terminu.';
comment on column public.bookings.reschedule_note is 'Opcjonalna notatka przy zmianie terminu.';
comment on column public.bookings.proposed_by is 'Kto zaproponował zmianę terminu: workshop | client';

update public.bookings
set cancellation_reason = cancel_reason
where cancellation_reason is null
  and cancel_reason is not null;

update public.bookings
set status = 'pending_quote'
where status in ('awaiting_quote', 'new', 'pending');

update public.bookings
set status = 'confirmed'
where status = 'quote_accepted';

update public.bookings
set
  cancelled_by = case status
    when 'cancelled_by_client' then 'client'
    when 'cancelled_by_workshop' then 'workshop'
    when 'cancelled_by_system' then 'system'
  end,
  cancelled_at = coalesce(cancelled_at, now()),
  cancellation_reason = coalesce(cancellation_reason, cancel_reason),
  status = 'cancelled'
where status in ('cancelled_by_client', 'cancelled_by_workshop', 'cancelled_by_system');

update public.bookings
set
  cancelled_by = coalesce(cancelled_by, 'client'),
  cancelled_at = coalesce(cancelled_at, now()),
  cancellation_reason = coalesce(cancellation_reason, cancel_reason)
where status = 'cancelled'
  and cancelled_by is null;

update public.bookings
set quote_status = 'sent'
where status = 'quote_sent'
  and coalesce(quote_status, '') in ('', 'pending_client_decision');

update public.bookings
set reschedule_status = 'pending_client_decision',
    proposed_by = coalesce(proposed_by, 'workshop')
where status = 'awaiting_reschedule'
  and reschedule_status is null;

update public.bookings
set reschedule_prev_status = 'confirmed'
where reschedule_prev_status = 'quote_accepted';

update public.bookings
set reschedule_prev_status = 'pending_quote'
where reschedule_prev_status in ('awaiting_quote', 'new', 'pending');

alter table public.bookings drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check
  check (
    status in (
      'pending_quote',
      'quote_sent',
      'confirmed',
      'quote_rejected',
      'cancelled',
      'completed',
      'awaiting_reschedule',
      'rejected',
      'done'
    )
  );

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
    and status in ('pending_quote', 'quote_sent', 'quote_rejected', 'awaiting_reschedule', 'confirmed')
    and booking_date is not null
    and start_time is not null
    and end_time is not null
  );

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
  v_cancelled_by text;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Powód anulowania jest wymagany';
  end if;

  select b.user_id, w.owner_id
  into v_booking_user, v_workshop_owner
  from public.bookings b
  join public.workshops w on w.id = b.workshop_id
  where b.id = p_booking_id;

  if auth.uid() = v_booking_user then
    v_cancelled_by := 'client';
  elsif auth.uid() = v_workshop_owner then
    v_cancelled_by := 'workshop';
  else
    raise exception 'Forbidden';
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_by = v_cancelled_by,
      cancelled_at = now(),
      cancellation_reason = v_reason,
      cancel_reason = v_reason
  where id = p_booking_id;

  return 'cancelled';
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
  set status = 'cancelled',
      cancelled_by = 'system',
      cancelled_at = now(),
      cancellation_reason = coalesce(cancellation_reason, 'Wycena wygasła automatycznie.'),
      cancel_reason = coalesce(cancel_reason, 'Wycena wygasła automatycznie.')
  where status in ('pending_quote', 'quote_sent')
    and quote_expires_at is not null
    and quote_expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

create or replace function public.send_booking_quote(
  p_booking_id uuid,
  p_final_price numeric,
  p_quote_note text default null
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
      quote_note = nullif(trim(coalesce(p_quote_note, '')), ''),
      quote_sent_at = now(),
      quote_expires_at = now() + interval '5 hours',
      status = 'quote_sent',
      quote_status = 'sent',
      cancel_reason = null
  where b.id = p_booking_id
    and b.status not in ('confirmed', 'completed', 'cancelled');

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
        quote_status = 'accepted',
        quote_decision_at = now(),
        cancel_reason = null
    where id = p_booking_id;
    return 'confirmed';
  end if;

  update public.bookings
  set status = 'quote_rejected',
      quote_status = 'rejected',
      quote_decision_at = now()
  where id = p_booking_id;
  return 'quote_rejected';
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
  p_problem_description text default null,
  p_service_category text default null,
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
    problem_description, service_category
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
    nullif(trim(coalesce(p_service_category, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$fn$;

create or replace function public.propose_booking_reschedule(
  p_booking_id uuid,
  p_new_booking_date date,
  p_new_start_time time,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_owner_id uuid;
  v_employee_id uuid;
  v_duration integer;
  v_end_time time;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Powód propozycji zmiany terminu jest wymagany';
  end if;

  select w.owner_id, b.employee_id, b.duration_minutes
  into v_owner_id, v_employee_id, v_duration
  from public.bookings b
  join public.workshops w on w.id = b.workshop_id
  where b.id = p_booking_id;

  if v_owner_id is distinct from auth.uid() then
    raise exception 'Forbidden';
  end if;

  if v_duration is null or v_duration <= 0 then
    raise exception 'Nieprawidłowy czas trwania rezerwacji';
  end if;

  v_end_time := (p_new_start_time + make_interval(mins => v_duration))::time;

  if exists (
    select 1
    from public.bookings b
    where b.id <> p_booking_id
      and b.employee_id = v_employee_id
      and b.booking_date = p_new_booking_date
      and b.status in ('pending_quote', 'quote_sent', 'quote_rejected', 'awaiting_reschedule', 'confirmed')
      and (p_new_start_time < b.end_time and v_end_time > b.start_time)
  ) then
    raise exception 'SLOT_CONFLICT';
  end if;

  update public.bookings
  set reschedule_prev_status = status,
      status = 'awaiting_reschedule',
      proposed_booking_date = p_new_booking_date,
      proposed_start_time = p_new_start_time,
      proposed_end_time = v_end_time,
      reschedule_reason = v_reason,
      reschedule_note = v_reason,
      reschedule_status = 'pending_client_decision',
      proposed_by = 'workshop'
  where id = p_booking_id
    and status not in ('cancelled', 'completed');
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
  v_restore text;
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
        and b.status in ('pending_quote', 'quote_sent', 'quote_rejected', 'awaiting_reschedule', 'confirmed')
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
        proposed_end_time = null,
        reschedule_status = null,
        proposed_by = null
    where id = p_booking_id;
    return 'confirmed';
  end if;

  v_restore := coalesce(nullif(v_prev_status, ''), 'confirmed');
  if v_restore = 'quote_accepted' then
    v_restore := 'confirmed';
  end if;
  if v_restore in ('awaiting_quote', 'new', 'pending') then
    v_restore := 'pending_quote';
  end if;

  update public.bookings
  set status = v_restore,
      proposed_booking_date = null,
      proposed_start_time = null,
      proposed_end_time = null,
      reschedule_status = null,
      proposed_by = null
  where id = p_booking_id;

  return 'rejected';
end;
$fn$;

create or replace function public.list_booking_slot_blocks_public(p_workshop_id uuid, p_booking_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  rec record;
  sm int;
  em int;
  arr jsonb := '[]'::jsonb;
  p1 text;
  p2 text;
begin
  if not exists (
    select 1
    from public.workshops w
    where w.id = p_workshop_id
      and lower(trim(coalesce(w.status, ''))) = 'active'
  ) then
    return '[]'::jsonb;
  end if;

  for rec in
    select
      b.employee_id,
      b.start_time,
      b.end_time,
      b.duration_minutes,
      coalesce(trim(b.time::text), '') as booking_time_txt
    from public.bookings b
    where b.workshop_id = p_workshop_id
      and b.booking_date = p_booking_date
      and lower(trim(coalesce(b.status, ''))) in (
        'pending_quote',
        'quote_sent',
        'quote_rejected',
        'awaiting_reschedule',
        'confirmed'
      )
  loop
    if rec.start_time is not null then
      sm :=
        extract(hour from rec.start_time)::int * 60
        + extract(minute from rec.start_time)::int;
    elsif length(rec.booking_time_txt) >= 4 and strpos(rec.booking_time_txt, ':') > 0 then
      p1 := split_part(rec.booking_time_txt, ':', 1);
      p2 := left(trim(split_part(rec.booking_time_txt, ':', 2)), 2);
      begin
        sm := p1::int * 60 + coalesce(nullif(trim(p2), '')::int, 0);
      exception when others then
        continue;
      end;
    else
      continue;
    end if;

    if rec.end_time is not null then
      em :=
        extract(hour from rec.end_time)::int * 60
        + extract(minute from rec.end_time)::int;
    elsif rec.duration_minutes is not null then
      em := sm + rec.duration_minutes::int;
    else
      em := sm + 60;
    end if;

    if em <= sm then
      continue;
    end if;

    arr :=
      arr
      || jsonb_build_array(
        jsonb_build_object(
          'employee_id',
          rec.employee_id,
          'start_mins',
          sm,
          'end_mins',
          em
        )
      );
  end loop;

  return coalesce(arr, '[]'::jsonb);
end;
$fn$;

grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.expire_booking_quotes() to authenticated;
grant execute on function public.send_booking_quote(uuid, numeric, text) to authenticated;
grant execute on function public.respond_booking_quote(uuid, boolean) to authenticated;
grant execute on function public.create_booking_safe(
  uuid, uuid, uuid, text, jsonb, date, time, integer, text, text, text, text, text, text, uuid
) to authenticated;
grant execute on function public.propose_booking_reschedule(uuid, date, time, text) to authenticated;
grant execute on function public.respond_booking_reschedule(uuid, boolean) to authenticated;
grant execute on function public.list_booking_slot_blocks_public(uuid, date) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
