-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-27-booking-reschedule-flow.sql
--
-- Cel:
-- - Etap 3: propozycje zmiany terminu przez warsztat;
-- - status `awaiting_reschedule`;
-- - RPC do proponowania i akceptacji/odrzucenia nowego terminu.
-- =============================================================================

begin;

alter table public.bookings
  add column if not exists proposed_booking_date date,
  add column if not exists proposed_start_time time,
  add column if not exists proposed_end_time time,
  add column if not exists reschedule_reason text,
  add column if not exists reschedule_prev_status text;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (
    status in (
      'awaiting_quote',
      'quote_sent',
      'quote_accepted',
      'quote_rejected',
      'awaiting_reschedule',
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
    and status in ('awaiting_quote', 'quote_sent', 'quote_accepted', 'awaiting_reschedule', 'confirmed', 'new')
    and booking_date is not null
    and start_time is not null
    and end_time is not null
  );

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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
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
      and b.status in ('awaiting_quote', 'quote_sent', 'quote_accepted', 'awaiting_reschedule', 'confirmed', 'new')
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
      reschedule_reason = trim(p_reason)
  where id = p_booking_id
    and status not in ('cancelled_by_client', 'cancelled_by_workshop', 'cancelled_by_system', 'completed');
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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select user_id, reschedule_prev_status
  into v_user_id, v_prev_status
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

grant execute on function public.propose_booking_reschedule(uuid, date, time, text) to authenticated;
grant execute on function public.respond_booking_reschedule(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
