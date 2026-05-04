-- =============================================================================
-- ServyGo — supabase-48-booking-quotes-model.sql
-- Historia wycen (booking_quotes), jedna aktywna na rezerwację, current_quote_id.
-- Nadpisuje send_booking_quote / respond_booking_quote / expire_booking_quotes / cancel_booking.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Tabela booking_quotes
-- -----------------------------------------------------------------------------
create table if not exists public.booking_quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  currency text not null default 'PLN',
  status text not null check (status in ('active', 'replaced', 'accepted', 'rejected', 'cancelled')),
  message text,
  created_at timestamptz not null default now(),
  replaced_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz
);

create index if not exists idx_booking_quotes_booking_id on public.booking_quotes(booking_id);
create index if not exists idx_booking_quotes_booking_created on public.booking_quotes(booking_id, created_at desc);

drop index if exists public.booking_quotes_one_active_per_booking;
create unique index booking_quotes_one_active_per_booking
  on public.booking_quotes(booking_id)
  where status = 'active';

comment on table public.booking_quotes is 'Historia wycen; dokładnie jeden wiersz status=active na booking_id.';
comment on column public.booking_quotes.user_id is 'Klient (właściciel rezerwacji).';

-- -----------------------------------------------------------------------------
-- 2. Kolumny na bookings
-- -----------------------------------------------------------------------------
alter table public.bookings
  add column if not exists quoted_price numeric,
  add column if not exists current_quote_id uuid;

comment on column public.bookings.quoted_price is 'Kwota z aktualnej (ostatnio wysłanej) wyceny — synchronizowana z aktywnym wierszem booking_quotes.';
comment on column public.bookings.current_quote_id is 'Wskaźnik na aktywną wycenę (booking_quotes.status = active).';

alter table public.bookings drop constraint if exists bookings_current_quote_id_fkey;
alter table public.bookings
  add constraint bookings_current_quote_id_fkey
  foreign key (current_quote_id) references public.booking_quotes(id)
  on delete set null
  deferrable initially deferred;

-- -----------------------------------------------------------------------------
-- 3. RLS booking_quotes
-- -----------------------------------------------------------------------------
alter table public.booking_quotes enable row level security;

revoke all on table public.booking_quotes from anon;
grant select on table public.booking_quotes to authenticated;

drop policy if exists "booking_quotes_select_participants" on public.booking_quotes;
create policy "booking_quotes_select_participants"
on public.booking_quotes
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_quotes.booking_id
      and b.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    join public.workshops w on w.id = b.workshop_id
    where b.id = booking_quotes.booking_id
      and w.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and lower(coalesce(au.role, '')) in ('admin', 'owner')
  )
);

-- Brak insert/update dla authenticated — tylko RPC (security definer).

-- -----------------------------------------------------------------------------
-- 4. Status rezerwacji: awaiting_new_quote + constraint overlap
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
      'service_not_completed'
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
    and status in (
      'pending_quote',
      'quote_sent',
      'quote_rejected',
      'awaiting_new_quote',
      'awaiting_reschedule',
      'confirmed'
    )
    and booking_date is not null
    and start_time is not null
    and end_time is not null
  );

-- -----------------------------------------------------------------------------
-- 5. cancel_booking — anuluj aktywną wycenę
-- -----------------------------------------------------------------------------
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

  update public.booking_quotes q
  set status = 'cancelled',
      replaced_at = coalesce(q.replaced_at, now())
  where q.booking_id = p_booking_id
    and q.status = 'active';

  update public.bookings
  set status = 'cancelled',
      cancelled_by = v_cancelled_by,
      cancelled_at = now(),
      cancellation_reason = v_reason,
      cancel_reason = v_reason,
      current_quote_id = null,
      quoted_price = null
  where id = p_booking_id;

  return 'cancelled';
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 6. expire_booking_quotes
-- -----------------------------------------------------------------------------
create or replace function public.expire_booking_quotes()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer := 0;
begin
  update public.booking_quotes q
  set status = 'cancelled',
      replaced_at = coalesce(q.replaced_at, now())
  from public.bookings b
  where q.booking_id = b.id
    and q.status = 'active'
    and b.status in ('pending_quote', 'quote_sent')
    and b.quote_expires_at is not null
    and b.quote_expires_at < now();

  update public.bookings
  set status = 'cancelled',
      cancelled_by = 'system',
      cancelled_at = now(),
      cancellation_reason = coalesce(cancellation_reason, 'Wycena wygasła automatycznie.'),
      cancel_reason = coalesce(cancel_reason, 'Wycena wygasła automatycznie.'),
      current_quote_id = null,
      quoted_price = null
  where status in ('pending_quote', 'quote_sent')
    and quote_expires_at is not null
    and quote_expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 7. send_booking_quote
-- -----------------------------------------------------------------------------
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
  v_client_id uuid;
  v_workshop_id uuid;
  v_ws_name text;
  v_service text;
  v_date_line text;
  v_note text;
  v_quote_id uuid;
  v_body text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_final_price is null or p_final_price < 0 then
    raise exception 'Cena końcowa musi być większa lub równa 0';
  end if;

  select w.owner_id, b.user_id, b.workshop_id, b.workshop_name, b.service_name,
         concat_ws(' ', b.booking_date::text, left(b.start_time::text, 5))
  into v_owner_id, v_client_id, v_workshop_id, v_ws_name, v_service, v_date_line
  from public.bookings b
  join public.workshops w on w.id = b.workshop_id
  where b.id = p_booking_id;

  if v_owner_id is distinct from auth.uid() then
    raise exception 'Forbidden';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.id = p_booking_id
      and b.status in (
        'confirmed',
        'completed',
        'cancelled',
        'cancelled_by_client',
        'cancelled_by_workshop',
        'cancelled_by_system',
        'done',
        'rejected',
        'service_not_completed'
      )
  ) then
    raise exception 'Nie można wysłać wyceny dla tej rezerwacji';
  end if;

  v_note := nullif(trim(coalesce(p_quote_note, '')), '');

  update public.booking_quotes q
  set status = 'replaced',
      replaced_at = now()
  where q.booking_id = p_booking_id
    and q.status = 'active';

  insert into public.booking_quotes (
    booking_id, workshop_id, user_id, amount, currency, status, message
  )
  values (
    p_booking_id,
    v_workshop_id,
    v_client_id,
    p_final_price,
    'PLN',
    'active',
    v_note
  )
  returning id into v_quote_id;

  update public.bookings b
  set final_price = p_final_price,
      quoted_price = p_final_price,
      current_quote_id = v_quote_id,
      quote_sent_at = now(),
      quote_expires_at = now() + interval '5 hours',
      status = 'quote_sent',
      quote_status = 'pending_client_decision',
      quote_note = v_note,
      cancel_reason = null
  where b.id = p_booking_id;

  v_body := format(
    'Warsztat %s wysłał wycenę: %s zł.%s',
    coalesce(nullif(trim(v_ws_name), ''), 'Warsztat'),
    trim(to_char(p_final_price, 'FM999999990.00')),
    case when v_note is not null then chr(10) || 'Notatka: ' || v_note else '' end
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
    v_client_id,
    'system',
    'client',
    'Nowa wycena',
    v_body,
    p_booking_id,
    v_workshop_id,
    null,
    false
  );
end;
$fn$;

-- -----------------------------------------------------------------------------
-- 8. respond_booking_quote (wymaga p_quote_id — tylko aktywna wycena)
-- -----------------------------------------------------------------------------
drop function if exists public.respond_booking_quote(uuid, boolean);

create or replace function public.respond_booking_quote(
  p_booking_id uuid,
  p_quote_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user_id uuid;
  v_owner_id uuid;
  v_ws_id uuid;
  v_ws_name text;
  v_service text;
  v_amount numeric;
  v_q_status text;
  v_b_status text;
  v_cur uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select b.user_id, b.status, b.current_quote_id, b.workshop_id, b.workshop_name, b.service_name, w.owner_id
  into v_user_id, v_b_status, v_cur, v_ws_id, v_ws_name, v_service, v_owner_id
  from public.bookings b
  join public.workshops w on w.id = b.workshop_id
  where b.id = p_booking_id;

  if v_user_id is distinct from auth.uid() then
    raise exception 'Forbidden';
  end if;

  if v_b_status in (
    'cancelled',
    'cancelled_by_client',
    'cancelled_by_workshop',
    'cancelled_by_system',
    'confirmed',
    'completed',
    'done',
    'rejected',
    'service_not_completed'
  ) then
    raise exception 'Rezerwacja nie pozwala na decyzję o wycenie';
  end if;

  if v_cur is null or v_cur is distinct from p_quote_id then
    raise exception 'To nie jest aktualna aktywna wycena';
  end if;

  select q.status, q.amount
  into v_q_status, v_amount
  from public.booking_quotes q
  where q.id = p_quote_id
    and q.booking_id = p_booking_id;

  if v_q_status is null then
    raise exception 'Wycena nie istnieje';
  end if;

  if v_q_status <> 'active' then
    raise exception 'Wycena nie jest aktywna';
  end if;

  if p_accept then
    update public.booking_quotes
    set status = 'accepted',
        accepted_at = now()
    where id = p_quote_id;

    update public.bookings
    set status = 'confirmed',
        quote_status = 'accepted',
        quote_decision_at = now(),
        cancel_reason = null,
        final_price = v_amount,
        quoted_price = v_amount
    where id = p_booking_id;

    insert into public.internal_messages (
      sender_id, recipient_id, sender_role, recipient_role, subject, body,
      related_booking_id, related_workshop_id, service_request_id, is_read
    )
    values (
      null,
      v_owner_id,
      'system',
      'workshop',
      'Klient zaakceptował wycenę',
      format(
        'Klient zaakceptował wycenę %s zł dla usługi „%s”. Warsztat: %s.',
        trim(to_char(v_amount, 'FM999999990.00')),
        coalesce(nullif(trim(v_service), ''), 'usługa'),
        coalesce(nullif(trim(v_ws_name), ''), 'Twój warsztat')
      ),
      p_booking_id,
      v_ws_id,
      null,
      false
    );

    return 'confirmed';
  end if;

  update public.booking_quotes
  set status = 'rejected',
      rejected_at = now()
  where id = p_quote_id;

  update public.bookings
  set status = 'awaiting_new_quote',
      quote_status = 'rejected',
      quote_decision_at = now(),
      current_quote_id = null,
      quoted_price = null,
      final_price = null
  where id = p_booking_id;

  insert into public.internal_messages (
    sender_id, recipient_id, sender_role, recipient_role, subject, body,
    related_booking_id, related_workshop_id, service_request_id, is_read
  )
  values (
    null,
    v_owner_id,
    'system',
    'workshop',
    'Klient odrzucił wycenę',
    format(
      'Klient odrzucił wycenę dla usługi „%s”. Warsztat: %s.',
      coalesce(nullif(trim(v_service), ''), 'usługa'),
      coalesce(nullif(trim(v_ws_name), ''), 'Twój warsztat')
    ),
    p_booking_id,
    v_ws_id,
    null,
    false
  );

  return 'quote_rejected';
end;
$fn$;

grant execute on function public.send_booking_quote(uuid, numeric, text) to authenticated;
grant execute on function public.respond_booking_quote(uuid, uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Backfill: istniejące quote_sent bez wiersza w booking_quotes
-- -----------------------------------------------------------------------------
insert into public.booking_quotes (
  booking_id, workshop_id, user_id, amount, currency, status, message, created_at
)
select
  b.id,
  b.workshop_id,
  b.user_id,
  b.final_price,
  'PLN',
  'active',
  b.quote_note,
  coalesce(b.quote_sent_at, b.created_at)
from public.bookings b
where b.status = 'quote_sent'
  and b.final_price is not null
  and not exists (select 1 from public.booking_quotes q where q.booking_id = b.id and q.status = 'active');

update public.bookings b
set current_quote_id = q.id,
    quoted_price = q.amount
from public.booking_quotes q
where q.booking_id = b.id
  and q.status = 'active'
  and b.status = 'quote_sent'
  and b.current_quote_id is null;

-- -----------------------------------------------------------------------------
-- 10. Realtime: booking_quotes
-- -----------------------------------------------------------------------------
do $rt$
begin
  if exists (
    select 1
    from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = 'booking_quotes'
  ) then
    null;
  else
    execute 'alter publication supabase_realtime add table public.booking_quotes';
  end if;
exception
  when undefined_object then
    raise notice 'supabase_realtime: pomijam booking_quotes';
  when duplicate_object then
    null;
end
$rt$;

commit;

notify pgrst, 'reload schema';
