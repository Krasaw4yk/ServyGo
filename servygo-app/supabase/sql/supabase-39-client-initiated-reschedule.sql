-- =============================================================================
-- ServyGo — supabase-39-client-initiated-reschedule.sql
--
-- Wymaga: user_notifications (np. supabase-38), cancel_booking, is_within_workshop_hours
--
-- Cel:
-- - Klient: anulacja wizyty z powiadomieniem do warsztatu
-- - Klient: propozycja nowego terminu (pending_workshop_decision, proposed_by = client)
-- - Warsztat: akceptacja / odrzucenie propozycji klienta + powiadomienie do klienta
--
-- Bez DROP/TRUNCATE danych.
-- =============================================================================

begin;

create or replace function public.client_cancel_visit_with_notice(
  p_booking_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_booking_user uuid;
  v_reason text;
  v_owner uuid;
  v_wid uuid;
  v_wsname text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select b.user_id, b.workshop_id, b.workshop_name
  into v_booking_user, v_wid, v_wsname
  from public.bookings b
  where b.id = p_booking_id;

  if v_booking_user is null then
    raise exception 'Booking not found';
  end if;
  if v_booking_user is distinct from v_uid then
    raise exception 'Forbidden';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null then
    v_reason := 'Rezygnacja klienta';
  end if;

  perform public.cancel_booking(p_booking_id, v_reason);

  select w.owner_id into v_owner
  from public.workshops w
  where w.id = v_wid;

  if v_owner is not null then
    insert into public.user_notifications (user_id, notification_type, title, body, booking_id, workshop_id, payload)
    values (
      v_owner,
      'visit_cancelled_client',
      'Klient zrezygnował z wizyty',
      format(
        'Klient zrezygnował z wizyty w warsztacie %s. Powód: %s.',
        coalesce(nullif(trim(v_wsname), ''), 'Twoim warsztacie'),
        v_reason
      ),
      p_booking_id,
      v_wid,
      jsonb_build_object('reason', v_reason)
    );
  end if;
end;
$fn$;

revoke all on function public.client_cancel_visit_with_notice(uuid, text) from public;
grant execute on function public.client_cancel_visit_with_notice(uuid, text) to authenticated;


create or replace function public.client_propose_booking_reschedule(
  p_booking_id uuid,
  p_new_booking_date date,
  p_new_start_time time,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_booking_user uuid;
  v_wid uuid;
  v_emp uuid;
  v_dur integer;
  v_end_time time;
  v_status text;
  v_rs text;
  v_owner uuid;
  v_note text;
  v_wsname text;
  v_service text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select
    b.user_id,
    b.workshop_id,
    b.employee_id,
    b.duration_minutes,
    b.status,
    b.reschedule_status,
    b.workshop_name,
    b.service_name
  into
    v_booking_user,
    v_wid,
    v_emp,
    v_dur,
    v_status,
    v_rs,
    v_wsname,
    v_service
  from public.bookings b
  where b.id = p_booking_id
  for update;

  if v_booking_user is null then
    raise exception 'Booking not found';
  end if;
  if v_booking_user is distinct from v_uid then
    raise exception 'Forbidden';
  end if;

  if lower(trim(coalesce(v_status, ''))) not in ('confirmed', 'quote_sent') then
    raise exception 'Rezerwacja nie pozwala na zmianę terminu w tym stanie';
  end if;

  if lower(trim(coalesce(v_status, ''))) = 'awaiting_reschedule' then
    raise exception 'Masz aktywną propozycję zmiany terminu od warsztatu';
  end if;

  if lower(trim(coalesce(v_rs, ''))) = 'pending_workshop_decision' then
    raise exception 'Propozycja zmiany terminu oczekuje już na decyzję warsztatu';
  end if;

  v_dur := greatest(coalesce(v_dur, 60), 15);
  v_end_time := (p_new_start_time + make_interval(mins => v_dur))::time;

  if not public.is_within_workshop_hours(v_wid, p_new_booking_date, p_new_start_time, v_end_time) then
    raise exception 'OUTSIDE_OPENING_HOURS';
  end if;

  if v_emp is not null then
    if exists (
      select 1
      from public.bookings b
      where b.id <> p_booking_id
        and b.employee_id = v_emp
        and b.booking_date = p_new_booking_date
        and b.status in ('pending_quote', 'quote_sent', 'quote_rejected', 'awaiting_reschedule', 'confirmed')
        and b.start_time is not null
        and b.end_time is not null
        and (p_new_start_time < b.end_time and v_end_time > b.start_time)
    ) then
      raise exception 'SLOT_CONFLICT';
    end if;
  else
    if exists (
      select 1
      from public.bookings b
      where b.id <> p_booking_id
        and b.workshop_id = v_wid
        and b.booking_date = p_new_booking_date
        and b.status in ('pending_quote', 'quote_sent', 'quote_rejected', 'awaiting_reschedule', 'confirmed')
        and b.start_time is not null
        and b.end_time is not null
        and (p_new_start_time < b.end_time and v_end_time > b.start_time)
    ) then
      raise exception 'SLOT_CONFLICT';
    end if;
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');

  update public.bookings
  set
    proposed_booking_date = p_new_booking_date,
    proposed_start_time = p_new_start_time,
    proposed_end_time = v_end_time,
    reschedule_reason = v_note,
    reschedule_note = coalesce(v_note, reschedule_note),
    reschedule_status = 'pending_workshop_decision',
    proposed_by = 'client'
  where id = p_booking_id;

  select w.owner_id into v_owner from public.workshops w where w.id = v_wid;

  if v_owner is not null then
    insert into public.user_notifications (user_id, notification_type, title, body, booking_id, workshop_id, payload)
    values (
      v_owner,
      'client_reschedule_request',
      'Klient prosi o przeniesienie wizyty',
      format(
        'Klient chce przenieść wizytę (%s). Nowy termin: %s o %s.',
        coalesce(nullif(trim(v_service), ''), 'usługa'),
        to_char(p_new_booking_date, 'YYYY-MM-DD'),
        to_char(p_new_start_time, 'HH24:MI')
      ),
      p_booking_id,
      v_wid,
      jsonb_build_object(
        'new_date', to_char(p_new_booking_date, 'YYYY-MM-DD'),
        'new_time', to_char(p_new_start_time, 'HH24:MI'),
        'note', v_note
      )
    );
  end if;
end;
$fn$;

revoke all on function public.client_propose_booking_reschedule(uuid, date, time, text) from public;
grant execute on function public.client_propose_booking_reschedule(uuid, date, time, text) to authenticated;


create or replace function public.workshop_respond_client_reschedule(
  p_booking_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_client uuid;
  v_wid uuid;
  v_emp uuid;
  v_rs text;
  v_pb text;
  v_new_date date;
  v_new_start time;
  v_new_end time;
  v_service text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select
    w.owner_id,
    b.user_id,
    b.workshop_id,
    b.employee_id,
    b.reschedule_status,
    b.proposed_by,
    b.proposed_booking_date,
    b.proposed_start_time,
    b.proposed_end_time,
    b.service_name
  into
    v_owner,
    v_client,
    v_wid,
    v_emp,
    v_rs,
    v_pb,
    v_new_date,
    v_new_start,
    v_new_end,
    v_service
  from public.bookings b
  join public.workshops w on w.id = b.workshop_id
  where b.id = p_booking_id
  for update;

  if v_owner is null then
    raise exception 'Booking not found';
  end if;

  if v_owner is distinct from v_uid then
    raise exception 'Forbidden';
  end if;

  if lower(trim(coalesce(v_rs, ''))) is distinct from 'pending_workshop_decision'
     or lower(trim(coalesce(v_pb, ''))) is distinct from 'client' then
    raise exception 'Brak aktywnej propozycji zmiany terminu od klienta';
  end if;

  if v_new_date is null or v_new_start is null or v_new_end is null then
    raise exception 'Brak proponowanego terminu';
  end if;

  if p_accept then
    if not public.is_within_workshop_hours(v_wid, v_new_date, v_new_start, v_new_end) then
      raise exception 'OUTSIDE_OPENING_HOURS';
    end if;

    if v_emp is not null then
      if exists (
        select 1
        from public.bookings b
        where b.id <> p_booking_id
          and b.employee_id = v_emp
          and b.booking_date = v_new_date
          and b.status in ('pending_quote', 'quote_sent', 'quote_rejected', 'awaiting_reschedule', 'confirmed')
          and b.start_time is not null
          and b.end_time is not null
          and (v_new_start < b.end_time and v_new_end > b.start_time)
      ) then
        raise exception 'SLOT_CONFLICT';
      end if;
    else
      if exists (
        select 1
        from public.bookings b
        where b.id <> p_booking_id
          and b.workshop_id = v_wid
          and b.booking_date = v_new_date
          and b.status in ('pending_quote', 'quote_sent', 'quote_rejected', 'awaiting_reschedule', 'confirmed')
          and b.start_time is not null
          and b.end_time is not null
          and (v_new_start < b.end_time and v_new_end > b.start_time)
      ) then
        raise exception 'SLOT_CONFLICT';
      end if;
    end if;

    update public.bookings
    set
      booking_date = proposed_booking_date,
      start_time = proposed_start_time,
      end_time = proposed_end_time,
      date = proposed_booking_date,
      time = to_char(proposed_start_time, 'HH24:MI'),
      proposed_booking_date = null,
      proposed_start_time = null,
      proposed_end_time = null,
      reschedule_status = 'accepted',
      proposed_by = null,
      reschedule_reason = null,
      reschedule_note = null
    where id = p_booking_id;

    insert into public.user_notifications (user_id, notification_type, title, body, booking_id, workshop_id, payload)
    values (
      v_client,
      'reschedule_accepted',
      'Warsztat zaakceptował zmianę terminu',
      format(
        'Twój nowy termin wizyty (%s): %s o %s.',
        coalesce(nullif(trim(v_service), ''), 'usługa'),
        to_char(v_new_date, 'YYYY-MM-DD'),
        to_char(v_new_start, 'HH24:MI')
      ),
      p_booking_id,
      v_wid,
      '{}'::jsonb
    );

    return 'accepted';
  end if;

  update public.bookings
  set
    proposed_booking_date = null,
    proposed_start_time = null,
    proposed_end_time = null,
    reschedule_status = 'rejected',
    proposed_by = null,
    reschedule_reason = null,
    reschedule_note = null
  where id = p_booking_id;

  insert into public.user_notifications (user_id, notification_type, title, body, booking_id, workshop_id, payload)
  values (
    v_client,
    'reschedule_rejected',
    'Warsztat odrzucił zmianę terminu',
    format(
      'Warsztat nie przyjął prośby o zmianę terminu wizyty (%s). Obowiązuje pierwotny termin.',
      coalesce(nullif(trim(v_service), ''), 'usługa')
    ),
    p_booking_id,
    v_wid,
    '{}'::jsonb
  );

  return 'rejected';
end;
$fn$;

revoke all on function public.workshop_respond_client_reschedule(uuid, boolean) from public;
grant execute on function public.workshop_respond_client_reschedule(uuid, boolean) to authenticated;

commit;
