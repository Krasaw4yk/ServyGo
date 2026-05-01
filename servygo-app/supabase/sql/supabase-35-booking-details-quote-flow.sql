-- =============================================================================
-- ServyGo — supabase-35-booking-details-quote-flow.sql
--
-- DIAGNOZA (stan sprzed tej migracji):
-- 1) Szczegóły rezerwacji w panelu warsztatu pobierały tylko część kolumn bookings;
--    vehicle_data (JSON z VIN/paliwem/marką), notes, problem_description nie były
--    widoczne w UI mimo że create_booking_safe zapisuje vehicle_data i client_* .
-- 2) „Wyślij wycenę”: handler w app/workshop-panel → sendBookingQuoteAsWorkshopOwner →
--    RPC send_booking_quote ustawia final_price, quote_sent_at, status=quote_sent.
--    Panel dodatkowo wysyła sendSystemMessage do klienta oraz POST /api/notifications/email
--    (Resend jeśli skonfigurowany). Brakowało persistencji notatki wyceny i pola quote_status.
-- 3) Klient w /moje-rezerwacje widział final_price w polu „Cena” ale nie miał przycisków
--    akceptacji; respond_booking_quote istnieje w messagesApi lecz nie było UI.
-- 4) Powiadomienie dzwoneczka = nieprzeczytane internal_messages — działa po insertach systemowych.
--
-- Ta migracja: kolumny problem_description, quote_note, quote_status, service_category;
-- rozszerza create_booking_safe i send_booking_quote; respond_booking_quote ustawia quote_status.
-- =============================================================================

begin;

alter table public.bookings
  add column if not exists problem_description text,
  add column if not exists quote_note text,
  add column if not exists quote_status text,
  add column if not exists service_category text;

comment on column public.bookings.problem_description is 'Opis problemu od klienta (snapshot przy rezerwacji).';
comment on column public.bookings.quote_note is 'Wiadomość/notatka warsztatu do klienta przy wycenie.';
comment on column public.bookings.quote_status is 'Stan decyzji wyceny: pending_client_decision | accepted | rejected | cancelled';
comment on column public.bookings.service_category is 'Opcjonalna kategoria usługi (snapshot).';

update public.bookings
set quote_status = 'pending_client_decision'
where status = 'quote_sent'
  and quote_status is null;

update public.bookings
set quote_status = 'accepted'
where status in ('confirmed', 'quote_accepted')
  and quote_sent_at is not null
  and quote_status is null;

update public.bookings
set quote_status = 'rejected'
where status = 'quote_rejected'
  and quote_status is null;

update public.bookings
set quote_status = 'cancelled'
where status in ('cancelled_by_client', 'cancelled_by_workshop', 'cancelled_by_system', 'cancelled')
  and quote_sent_at is not null
  and quote_status is null;

drop function if exists public.create_booking_safe(uuid, uuid, uuid, text, jsonb, date, time, integer, text, text, text, text, uuid);
drop function if exists public.send_booking_quote(uuid, numeric);

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
    workshop_name, price, date, time,
    problem_description, service_category
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
    0, p_booking_date, to_char(p_start_time, 'HH24:MI'),
    nullif(trim(coalesce(p_problem_description, '')), ''),
    nullif(trim(coalesce(p_service_category, '')), '')
  )
  returning id into v_id;

  return v_id;
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
      quote_status = 'pending_client_decision',
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
        quote_status = 'accepted',
        cancel_reason = null
    where id = p_booking_id;
    return 'confirmed';
  end if;

  update public.bookings
  set status = 'quote_rejected',
      quote_status = 'rejected'
  where id = p_booking_id;
  return 'quote_rejected';
end;
$fn$;

grant execute on function public.create_booking_safe(
  uuid, uuid, uuid, text, jsonb, date, time, integer, text, text, text, text, text, text, uuid
) to authenticated;

grant execute on function public.send_booking_quote(uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';

commit;
