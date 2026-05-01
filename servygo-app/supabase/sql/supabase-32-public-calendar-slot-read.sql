-- ServyGo — publiczny kalendarz rezerwacji (strona /warsztat/[id])
-- Problem: anon i klient nie widzieli pracowników / wyjątków (RLS tylko owner/admin)
-- oraz bookings: revoke dla anon + brak odczytu cudzych rezerwacji → brak nakładek slotów.
-- Rozwiązanie: SELECT dla employee + exceptions (warsztat active); SECURITY DEFINER RPC
-- zwraca wyłącznie przedziały minut (employee_id nullable = wpis dotyczy dowolnego slotu).

begin;

grant select on public.workshop_employees to anon, authenticated;
grant select on public.workshop_availability_exceptions to anon, authenticated;

drop policy if exists "workshop_employees_select_public_active" on public.workshop_employees;
create policy "workshop_employees_select_public_active"
on public.workshop_employees
for select
to anon, authenticated
using (
  coalesce(workshop_employees.is_active, true)
  and exists (
    select 1
    from public.workshops w
    where w.id = workshop_employees.workshop_id
      and lower(trim(coalesce(w.status, ''))) = 'active'
  )
);

drop policy if exists "workshop_availability_exceptions_select_public_active" on public.workshop_availability_exceptions;
create policy "workshop_availability_exceptions_select_public_active"
on public.workshop_availability_exceptions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_availability_exceptions.workshop_id
      and lower(trim(coalesce(w.status, ''))) = 'active'
  )
);

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
        'awaiting_quote',
        'quote_sent',
        'quote_accepted',
        'awaiting_reschedule',
        'confirmed',
        'new'
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

comment on function public.list_booking_slot_blocks_public(uuid, date) is
  'Zajęte przedziały (minuty od północy) dla kalendarza publicznego; bez PII klienta.';

grant execute on function public.list_booking_slot_blocks_public(uuid, date) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
