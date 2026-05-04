-- =============================================================================
-- ServyGo — ustawienia rozliczeń leadów per warsztat (MVP)
-- =============================================================================
-- Cel:
-- - dodać na public.workshops konfigurację leadów:
--   * lead_test_mode (czy warsztat jest w okresie testowym)
--   * lead_fee_amount (stawka leadów dla warsztatu)
--   * lead_test_ended_at (kiedy test zakończono)
-- - sprawić, żeby NOWE booking_lead_settlements dziedziczyły te wartości z workshops
--   (bez psucia istniejących settlementów)
-- - dać adminowi bezpieczną akcję zakończenia testu (RPC)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Kolumny konfiguracyjne na warsztacie
-- -----------------------------------------------------------------------------
alter table public.workshops
  add column if not exists lead_test_mode boolean not null default true;

alter table public.workshops
  add column if not exists lead_fee_amount numeric(10, 2) not null default 5.00;

alter table public.workshops
  add column if not exists lead_test_ended_at timestamptz;

comment on column public.workshops.lead_test_mode is
  'Czy warsztat jest w okresie testowym rozliczeń leadów (true = test, false = produkcja).';

comment on column public.workshops.lead_fee_amount is
  'Stawka leada dla warsztatu (PLN) — używana do nowych booking_lead_settlements.';

comment on column public.workshops.lead_test_ended_at is
  'Data zakończenia okresu testowego (ustawiane przez admina).';

-- Uzupełnij brakujące wartości w istniejących warsztatach (idempotentnie).
update public.workshops
set lead_test_mode = true
where lead_test_mode is null;

update public.workshops
set lead_fee_amount = 5.00
where lead_fee_amount is null;

-- -----------------------------------------------------------------------------
-- 2) Upewnij się, że ensure + trigger w migracji 49 dziedziczą ustawienia warsztatu
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
  v_test boolean;
  v_fee numeric(10, 2);
begin
  if p_booking_id is null then
    return;
  end if;

  select b.workshop_id, b.user_id
  into v_ws, v_user
  from public.bookings b
  where b.id = p_booking_id;

  if v_ws is null then
    return;
  end if;

  select w.lead_test_mode, w.lead_fee_amount
  into v_test, v_fee
  from public.workshops w
  where w.id = v_ws;

  insert into public.booking_lead_settlements (
    booking_id, workshop_id, user_id, settlement_status, lead_fee_amount, currency, test_mode
  )
  values (
    p_booking_id,
    v_ws,
    v_user,
    'pending',
    coalesce(v_fee, 5.00),
    'PLN',
    coalesce(v_test, true)
  )
  on conflict (booking_id) do nothing;
end;
$fn$;

create or replace function public.trg_bookings_after_insert_lead_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_test boolean;
  v_fee numeric(10, 2);
begin
  select w.lead_test_mode, w.lead_fee_amount
  into v_test, v_fee
  from public.workshops w
  where w.id = new.workshop_id;

  insert into public.booking_lead_settlements (
    booking_id, workshop_id, user_id, settlement_status, lead_fee_amount, currency, test_mode
  )
  values (
    new.id,
    new.workshop_id,
    new.user_id,
    'pending',
    coalesce(v_fee, 5.00),
    'PLN',
    coalesce(v_test, true)
  )
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

-- -----------------------------------------------------------------------------
-- 3) RPC dla admina: zakończ test / ustaw stawkę (bez zmiany historycznych settlementów)
-- -----------------------------------------------------------------------------
drop function if exists public.admin_set_workshop_lead_billing_settings(uuid, boolean, numeric);

create or replace function public.admin_set_workshop_lead_billing_settings(
  p_workshop_id uuid,
  p_lead_test_mode boolean,
  p_lead_fee_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_fee numeric(10, 2);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    raise exception 'Forbidden';
  end if;
  if p_workshop_id is null then
    raise exception 'workshop_id is required';
  end if;

  v_fee := nullif(p_lead_fee_amount, 0);
  if v_fee is not null and v_fee < 0 then
    raise exception 'lead_fee_amount must be >= 0';
  end if;

  update public.workshops w
  set lead_test_mode = p_lead_test_mode,
      lead_fee_amount = coalesce(v_fee, w.lead_fee_amount),
      lead_test_ended_at = case when p_lead_test_mode = false then coalesce(w.lead_test_ended_at, now()) else null end,
      updated_at = now()
  where w.id = p_workshop_id;
end;
$fn$;

grant execute on function public.admin_set_workshop_lead_billing_settings(uuid, boolean, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Komunikaty systemowe + eventy dla sporu (override z migracji 49)
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
  v_client uuid;
  v_ws_name text;
  v_service text;
  v_trim text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_trim := nullif(trim(coalesce(p_reason, '')), '');
  if v_trim is null then
    raise exception 'Podaj powód sporu';
  end if;

  select w.owner_id, b.workshop_id, b.user_id, b.workshop_name, b.service_name
  into v_owner, v_ws, v_client, v_ws_name, v_service
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

  -- Komunikaty systemowe (do warsztatu i klienta)
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
  values
  (
    null,
    v_owner,
    'system',
    'workshop',
    'Lead oznaczony jako sporny',
    format(
      'Lead został oznaczony jako sporny. Warsztat: %s. Usługa: %s.%sPowód: %s',
      coalesce(nullif(trim(v_ws_name), ''), 'Twój warsztat'),
      coalesce(nullif(trim(v_service), ''), 'usługa'),
      chr(10),
      v_trim
    ),
    p_booking_id,
    v_ws,
    null,
    false
  ),
  (
    null,
    v_client,
    'system',
    'client',
    'Aktualizacja rezerwacji: spór',
    format(
      'Lead został oznaczony jako sporny. Administrator sprawdzi sprawę.%sWarsztat: %s%sPowód: %s',
      chr(10),
      coalesce(nullif(trim(v_ws_name), ''), 'Warsztat'),
      chr(10),
      v_trim
    ),
    p_booking_id,
    v_ws,
    null,
    false
  );
end;
$fn$;

notify pgrst, 'reload schema';

commit;

