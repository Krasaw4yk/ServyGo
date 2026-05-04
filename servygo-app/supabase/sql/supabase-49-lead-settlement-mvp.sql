-- =============================================================================
-- ServyGo — MVP rozliczania leadów (bez płatności online / faktur)
-- =============================================================================
-- Tabele: booking_lead_settlements, booking_status_events
-- RPC: ensure_booking_lead_settlement, mark_booking_visit_completed,
--      mark_booking_no_show, mark_booking_settlement_disputed
-- Widok: workshop_monthly_lead_metrics
-- Admin: public.admin_users (role admin/owner) — ten sam wzorzec co w innych RLS.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Rozszerzenie statusu rezerwacji o no_show (legacy statusy bez zmian)
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
      'no_show'
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Tabele
-- -----------------------------------------------------------------------------
create table if not exists public.booking_lead_settlements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid,
  settlement_status text not null default 'pending',
  lead_fee_amount numeric(10, 2) not null default 5.00,
  currency text not null default 'PLN',
  test_mode boolean not null default true,
  eligible_at timestamptz,
  not_eligible_at timestamptz,
  not_eligible_reason text,
  disputed_at timestamptz,
  dispute_reason text,
  invoiced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_lead_settlements_status_check
    check (
      settlement_status in (
        'pending',
        'billable',
        'not_billable',
        'disputed',
        'invoiced',
        'waived_test'
      )
    )
);

create index if not exists booking_lead_settlements_workshop_id_idx
  on public.booking_lead_settlements(workshop_id);

create index if not exists booking_lead_settlements_settlement_status_idx
  on public.booking_lead_settlements(settlement_status);

drop trigger if exists trg_booking_lead_settlements_updated_at on public.booking_lead_settlements;
create trigger trg_booking_lead_settlements_updated_at
before update on public.booking_lead_settlements
for each row execute function public.set_updated_at();

create table if not exists public.booking_status_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status text,
  to_status text,
  event_type text not null,
  source text not null default 'system',
  actor_user_id uuid,
  actor_role text,
  message text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_status_events_booking_id_idx
  on public.booking_status_events(booking_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Pomocnicze: uprawnienia warsztat / admin
-- -----------------------------------------------------------------------------
create or replace function public._servygo_is_admin_user(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = p_uid
      and lower(coalesce(au.role, '')) in ('admin', 'owner')
  );
$$;

create or replace function public._servygo_visit_slot_end_ts(
  p_booking_date date,
  p_start_time time,
  p_end_time time,
  p_duration_minutes integer
)
returns timestamptz
language plpgsql
stable
as $fn$
declare
  v_end time;
  v_local timestamp;
begin
  if p_booking_date is null then
    return null;
  end if;
  v_end := coalesce(
    p_end_time,
    case
      when p_start_time is not null and coalesce(p_duration_minutes, 0) > 0
        then (p_start_time + make_interval(mins => p_duration_minutes))::time
      else p_start_time
    end
  );
  if v_end is null then
    v_local := p_booking_date::timestamp + time '23:59:59';
  else
    v_local := p_booking_date::timestamp + v_end;
  end if;
  -- Termin rezerwacji jest interpretowany w Europe/Warsaw (kalendarz warsztatu).
  return v_local at time zone 'Europe/Warsaw';
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 4. ensure_booking_lead_settlement
-- -----------------------------------------------------------------------------
create or replace function public.ensure_booking_lead_settlement(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ws uuid;
  v_user uuid;
begin
  if p_booking_id is null then
    return;
  end if;

  select b.workshop_id, b.user_id into v_ws, v_user
  from public.bookings b
  where b.id = p_booking_id;

  if v_ws is null then
    return;
  end if;

  insert into public.booking_lead_settlements (
    booking_id, workshop_id, user_id, settlement_status, lead_fee_amount, currency, test_mode
  )
  values (p_booking_id, v_ws, v_user, 'pending', 5.00, 'PLN', true)
  on conflict (booking_id) do nothing;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 5. Trigger: po INSERT na bookings — rekord settlement (security definer)
-- -----------------------------------------------------------------------------
create or replace function public.trg_bookings_after_insert_lead_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.booking_lead_settlements (
    booking_id, workshop_id, user_id, settlement_status, lead_fee_amount, currency, test_mode
  )
  values (new.id, new.workshop_id, new.user_id, 'pending', 5.00, 'PLN', true)
  on conflict (booking_id) do nothing;

  insert into public.booking_status_events (
    booking_id, from_status, to_status, event_type, source, actor_user_id, actor_role, message, meta
  )
  values (
    new.id,
    null,
    new.status::text,
    'booking_created',
    'system',
    auth.uid(),
    case when auth.uid() = new.user_id then 'client' else null end,
    null,
    '{}'::jsonb
  );
  return new;
end;
$fn$;

drop trigger if exists trg_bookings_after_insert_lead_settlement on public.bookings;
create trigger trg_bookings_after_insert_lead_settlement
after insert on public.bookings
for each row execute function public.trg_bookings_after_insert_lead_settlement();

-- -----------------------------------------------------------------------------
-- 6. Trigger: anulowanie / odrzucenie — settlement not_billable (tylko pending)
-- -----------------------------------------------------------------------------
create or replace function public.trg_bookings_status_sync_lead_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_terminal boolean;
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  v_terminal := new.status in (
    'cancelled',
    'cancelled_by_client',
    'cancelled_by_workshop',
    'cancelled_by_system',
    'rejected',
    'quote_rejected',
    'service_not_completed'
  );

  if not v_terminal then
    return new;
  end if;

  perform public.ensure_booking_lead_settlement(new.id);

  update public.booking_lead_settlements s
  set settlement_status = 'not_billable',
      not_eligible_at = coalesce(s.not_eligible_at, now()),
      not_eligible_reason = coalesce(s.not_eligible_reason, 'booking_status:' || new.status::text),
      updated_at = now()
  where s.booking_id = new.id
    and s.settlement_status = 'pending';

  insert into public.booking_status_events (
    booking_id, from_status, to_status, event_type, source, actor_user_id, message, meta
  )
  values (
    new.id,
    old.status::text,
    new.status::text,
    'settlement_changed',
    'system',
    auth.uid(),
    'Automatycznie: rezerwacja nie rozliczalna (status)',
    jsonb_build_object('reason', 'terminal_booking_status')
  );

  return new;
end;
$fn$;

drop trigger if exists trg_bookings_status_sync_lead_settlement on public.bookings;
create trigger trg_bookings_status_sync_lead_settlement
after update of status on public.bookings
for each row execute function public.trg_bookings_status_sync_lead_settlement();

-- -----------------------------------------------------------------------------
-- 7. mark_booking_visit_completed
-- -----------------------------------------------------------------------------
create or replace function public.mark_booking_visit_completed(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_owner uuid;
  v_client uuid;
  v_ws uuid;
  v_ws_name text;
  v_service text;
  v_old text;
  v_test boolean;
  v_fee numeric(10, 2);
  v_settlement_status text;
  v_body text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select
    w.owner_id,
    b.user_id,
    b.workshop_id,
    b.workshop_name,
    b.service_name,
    b.status::text
  into v_owner, v_client, v_ws, v_ws_name, v_service, v_old
  from public.bookings b
  join public.workshops w on w.id = b.workshop_id
  where b.id = p_booking_id;

  if v_owner is null then
    raise exception 'Rezerwacja nie istnieje';
  end if;

  if v_owner is distinct from auth.uid() and not public._servygo_is_admin_user(auth.uid()) then
    raise exception 'Forbidden';
  end if;

  if v_old = 'completed' or v_old = 'done' then
    perform public.ensure_booking_lead_settlement(p_booking_id);
    return;
  end if;

  if v_old not in ('confirmed', 'quote_accepted') then
    raise exception 'Wizytę można zakończyć tylko z statusu potwierdzonego';
  end if;

  update public.bookings
  set status = 'completed',
      updated_at = now()
  where id = p_booking_id;

  perform public.ensure_booking_lead_settlement(p_booking_id);

  select s.test_mode, s.lead_fee_amount
  into v_test, v_fee
  from public.booking_lead_settlements s
  where s.booking_id = p_booking_id;

  if coalesce(v_test, true) then
    v_settlement_status := 'waived_test';
  else
    v_settlement_status := 'billable';
  end if;

  update public.booking_lead_settlements s
  set settlement_status = v_settlement_status,
      eligible_at = now(),
      not_eligible_at = null,
      not_eligible_reason = null,
      updated_at = now()
  where s.booking_id = p_booking_id;

  insert into public.booking_status_events (
    booking_id, from_status, to_status, event_type, source, actor_user_id, actor_role, message, meta
  )
  values (
    p_booking_id,
    v_old,
    'completed',
    'visit_completed',
    'system',
    auth.uid(),
    case
      when auth.uid() = v_owner then 'workshop'
      when public._servygo_is_admin_user(auth.uid()) then 'admin'
      else null
    end,
    null,
    jsonb_build_object('settlement_status', v_settlement_status, 'lead_fee_amount', v_fee)
  );

  v_body := format(
    e'Warsztat: %s\nUsługa: %s\nStatus: zakończona\n\nWizyta została oznaczona jako zakończona.',
    coalesce(nullif(trim(v_ws_name), ''), 'Warsztat'),
    coalesce(nullif(trim(v_service), ''), 'usługa')
  );

  insert into public.internal_messages (
    sender_id,
    recipient_id,
    sender_role,
    recipient_role,
    subject,
    body,
    related_booking_id,
    related_workshop_id,
    service_request_id,
    is_read
  )
  values (
    null,
    v_client,
    'system',
    'client',
    'Aktualizacja rezerwacji: wizyta zakończona',
    v_body,
    p_booking_id,
    v_ws,
    null,
    false
  );
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 8. mark_booking_no_show
-- -----------------------------------------------------------------------------
create or replace function public.mark_booking_no_show(p_booking_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_owner uuid;
  v_old text;
  v_ws uuid;
  v_client uuid;
  v_ws_name text;
  v_service text;
  v_end_ts timestamptz;
  v_is_admin boolean;
  v_booking_date date;
  v_start time;
  v_end time;
  v_dur integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_is_admin := public._servygo_is_admin_user(auth.uid());

  select
    w.owner_id,
    b.status::text,
    b.workshop_id,
    b.user_id,
    b.workshop_name,
    b.service_name,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.duration_minutes
  into v_owner, v_old, v_ws, v_client, v_ws_name, v_service, v_booking_date, v_start, v_end, v_dur
  from public.bookings b
  join public.workshops w on w.id = b.workshop_id
  where b.id = p_booking_id;

  if v_owner is null then
    raise exception 'Rezerwacja nie istnieje';
  end if;

  if v_owner is distinct from auth.uid() and not v_is_admin then
    raise exception 'Forbidden';
  end if;

  if v_old <> 'confirmed' then
    raise exception 'No-show można ustawić tylko dla potwierdzonej rezerwacji';
  end if;

  v_end_ts := public._servygo_visit_slot_end_ts(v_booking_date, v_start, v_end, v_dur);
  if not v_is_admin and v_end_ts is not null and v_end_ts > now() then
    raise exception 'Można oznaczyć no-show dopiero po zakończeniu zaplanowanego terminu';
  end if;

  update public.bookings
  set status = 'no_show',
      updated_at = now()
  where id = p_booking_id;

  perform public.ensure_booking_lead_settlement(p_booking_id);

  update public.booking_lead_settlements s
  set settlement_status = 'not_billable',
      not_eligible_at = coalesce(s.not_eligible_at, now()),
      not_eligible_reason = 'no_show',
      updated_at = now()
  where s.booking_id = p_booking_id;

  insert into public.booking_status_events (
    booking_id, from_status, to_status, event_type, source, actor_user_id, actor_role, message, meta
  )
  values (
    p_booking_id,
    v_old,
    'no_show',
    'no_show',
    'system',
    auth.uid(),
    case when auth.uid() = v_owner then 'workshop' when v_is_admin then 'admin' else null end,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object('reason', coalesce(nullif(trim(p_reason), ''), 'no_show'))
  );

  insert into public.internal_messages (
    sender_id,
    recipient_id,
    sender_role,
    recipient_role,
    subject,
    body,
    related_booking_id,
    related_workshop_id,
    service_request_id,
    is_read
  )
  values (
    null,
    v_client,
    'system',
    'client',
    format('No-show: %s', coalesce(nullif(trim(v_service), ''), 'rezerwacja')),
    format(
      e'Warsztat %s oznaczył brak stawienia się na wizytę (no-show).%s',
      coalesce(nullif(trim(v_ws_name), ''), 'Warsztat'),
      case
        when coalesce(nullif(trim(p_reason), ''), '') <> '' then chr(10) || 'Powód: ' || trim(p_reason)
        else ''
      end
    ),
    p_booking_id,
    v_ws,
    null,
    false
  );
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 9. mark_booking_settlement_disputed
-- -----------------------------------------------------------------------------
create or replace function public.mark_booking_settlement_disputed(p_booking_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_owner uuid;
  v_ws uuid;
  v_trim text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_trim := nullif(trim(coalesce(p_reason, '')), '');
  if v_trim is null then
    raise exception 'Podaj powód sporu';
  end if;

  select w.owner_id, b.workshop_id into v_owner, v_ws
  from public.bookings b
  join public.workshops w on w.id = b.workshop_id
  where b.id = p_booking_id;

  if v_owner is null then
    raise exception 'Rezerwacja nie istnieje';
  end if;

  if v_owner is distinct from auth.uid() and not public._servygo_is_admin_user(auth.uid()) then
    raise exception 'Forbidden';
  end if;

  perform public.ensure_booking_lead_settlement(p_booking_id);

  update public.booking_lead_settlements s
  set settlement_status = 'disputed',
      disputed_at = now(),
      dispute_reason = v_trim,
      updated_at = now()
  where s.booking_id = p_booking_id;

  insert into public.booking_status_events (
    booking_id, from_status, to_status, event_type, source, actor_user_id, message, meta
  )
  select
    p_booking_id,
    b.status::text,
    b.status::text,
    'settlement_changed',
    'system',
    auth.uid(),
    v_trim,
    jsonb_build_object('settlement_status', 'disputed')
  from public.bookings b
  where b.id = p_booking_id;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 10. Widok: miesięczne metryki per warsztat
-- -----------------------------------------------------------------------------
create or replace view public.workshop_monthly_lead_metrics as
with booking_months as (
  select
    b.workshop_id,
    (date_trunc('month', coalesce(b.booking_date::timestamptz, b.created_at)))::date as month,
    count(*)::bigint as total_bookings,
    count(*) filter (where b.status = 'confirmed')::bigint as confirmed_bookings,
    count(*) filter (where b.status in ('completed', 'done'))::bigint as completed_bookings,
    count(*) filter (where b.status = 'no_show')::bigint as no_show_bookings,
    count(*) filter (where b.status in (
      'cancelled',
      'cancelled_by_client',
      'cancelled_by_workshop',
      'cancelled_by_system'
    ))::bigint as cancelled_bookings
  from public.bookings b
  group by b.workshop_id, (date_trunc('month', coalesce(b.booking_date::timestamptz, b.created_at)))::date
),
settlement_months as (
  select
    s.workshop_id,
    (date_trunc('month', coalesce(s.eligible_at, s.not_eligible_at, s.disputed_at, s.created_at)))::date as month,
    count(*) filter (where s.settlement_status = 'billable')::bigint as billable_leads,
    count(*) filter (where s.settlement_status = 'waived_test')::bigint as waived_test_leads,
    count(*) filter (where s.settlement_status = 'disputed')::bigint as disputed_leads,
    count(*) filter (where s.settlement_status = 'not_billable')::bigint as not_billable_leads,
    coalesce(sum(s.lead_fee_amount) filter (where s.settlement_status = 'billable'), 0)::numeric(12, 2) as estimated_amount_pln,
    coalesce(sum(s.lead_fee_amount) filter (where s.settlement_status = 'waived_test'), 0)::numeric(12, 2) as test_value_pln
  from public.booking_lead_settlements s
  group by s.workshop_id, (date_trunc('month', coalesce(s.eligible_at, s.not_eligible_at, s.disputed_at, s.created_at)))::date
),
keys as (
  select workshop_id, month from booking_months
  union
  select workshop_id, month from settlement_months
)
select
  k.workshop_id,
  w.name as workshop_name,
  k.month,
  coalesce(bm.total_bookings, 0)::bigint as total_bookings,
  coalesce(bm.confirmed_bookings, 0)::bigint as confirmed_bookings,
  coalesce(bm.completed_bookings, 0)::bigint as completed_bookings,
  coalesce(bm.no_show_bookings, 0)::bigint as no_show_bookings,
  coalesce(bm.cancelled_bookings, 0)::bigint as cancelled_bookings,
  coalesce(sm.billable_leads, 0)::bigint as billable_leads,
  coalesce(sm.waived_test_leads, 0)::bigint as waived_test_leads,
  coalesce(sm.disputed_leads, 0)::bigint as disputed_leads,
  coalesce(sm.not_billable_leads, 0)::bigint as not_billable_leads,
  coalesce(sm.estimated_amount_pln, 0)::numeric(12, 2) as estimated_amount_pln,
  coalesce(sm.test_value_pln, 0)::numeric(12, 2) as test_value_pln
from keys k
left join public.workshops w on w.id = k.workshop_id
left join booking_months bm
  on bm.workshop_id = k.workshop_id and bm.month = k.month
left join settlement_months sm
  on sm.workshop_id = k.workshop_id and sm.month = k.month;

-- -----------------------------------------------------------------------------
-- 11. RLS
-- -----------------------------------------------------------------------------
alter table public.booking_lead_settlements enable row level security;

drop policy if exists "booking_lead_settlements_select_participants" on public.booking_lead_settlements;
create policy "booking_lead_settlements_select_participants"
on public.booking_lead_settlements
for select
to authenticated
using (
  public._servygo_is_admin_user(auth.uid())
  or user_id = auth.uid()
  or exists (
    select 1
    from public.workshops w
    where w.id = booking_lead_settlements.workshop_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "booking_lead_settlements_no_insert" on public.booking_lead_settlements;
create policy "booking_lead_settlements_no_insert"
on public.booking_lead_settlements
for insert
to authenticated
with check (false);

drop policy if exists "booking_lead_settlements_no_update" on public.booking_lead_settlements;
create policy "booking_lead_settlements_no_update"
on public.booking_lead_settlements
for update
to authenticated
using (false)
with check (false);

drop policy if exists "booking_lead_settlements_no_delete" on public.booking_lead_settlements;
create policy "booking_lead_settlements_no_delete"
on public.booking_lead_settlements
for delete
to authenticated
using (false);

alter table public.booking_status_events enable row level security;

drop policy if exists "booking_status_events_select_participants" on public.booking_status_events;
create policy "booking_status_events_select_participants"
on public.booking_status_events
for select
to authenticated
using (
  public._servygo_is_admin_user(auth.uid())
  or exists (
    select 1
    from public.bookings b
    join public.workshops w on w.id = b.workshop_id
    where b.id = booking_status_events.booking_id
      and (b.user_id = auth.uid() or w.owner_id = auth.uid())
  )
);

drop policy if exists "booking_status_events_no_insert" on public.booking_status_events;
create policy "booking_status_events_no_insert"
on public.booking_status_events
for insert
to authenticated
with check (false);

drop policy if exists "booking_status_events_no_update" on public.booking_status_events;
create policy "booking_status_events_no_update"
on public.booking_status_events
for update
to authenticated
using (false)
with check (false);

drop policy if exists "booking_status_events_no_delete" on public.booking_status_events;
create policy "booking_status_events_no_delete"
on public.booking_status_events
for delete
to authenticated
using (false);

-- -----------------------------------------------------------------------------
-- 12. Grants
-- -----------------------------------------------------------------------------
grant select on public.booking_lead_settlements to authenticated;
grant select on public.booking_status_events to authenticated;
grant select on public.workshop_monthly_lead_metrics to authenticated;

grant execute on function public.ensure_booking_lead_settlement(uuid) to authenticated;
grant execute on function public.mark_booking_visit_completed(uuid) to authenticated;
grant execute on function public.mark_booking_no_show(uuid, text) to authenticated;
grant execute on function public.mark_booking_settlement_disputed(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 13. Backfill istniejących rezerwacji
-- -----------------------------------------------------------------------------
insert into public.booking_lead_settlements (
  booking_id, workshop_id, user_id, settlement_status, lead_fee_amount, currency, test_mode
)
select b.id, b.workshop_id, b.user_id, 'pending', 5.00, 'PLN', true
from public.bookings b
where not exists (
  select 1 from public.booking_lead_settlements s where s.booking_id = b.id
)
on conflict (booking_id) do nothing;

-- -----------------------------------------------------------------------------
-- 14. Realtime
-- -----------------------------------------------------------------------------
create or replace function public._servygo_add_table_to_realtime(p_table text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if exists (
    select 1
    from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = p_table
  ) then
    return;
  end if;
  execute format('alter publication supabase_realtime add table public.%I', p_table);
exception
  when undefined_object then
    raise notice 'Publikacja supabase_realtime nie istnieje — pomijam %.', p_table;
  when undefined_table then
    raise notice 'Tabela public.% nie istnieje — pomijam.', p_table;
end;
$fn$;

select public._servygo_add_table_to_realtime('booking_lead_settlements');
select public._servygo_add_table_to_realtime('booking_status_events');

drop function if exists public._servygo_add_table_to_realtime(text);

notify pgrst, 'reload schema';

commit;
