-- =============================================================================
-- ServyGo — supabase-38-user-notifications-reminders-reviews.sql
--
-- Cel (bez DROP/TRUNCATE danych, bez usuwania kolumn):
-- - Powiadomienia aplikacyjne (user_notifications) + log przypomnień (booking_reminders)
-- - Opinie wewnętrzne (service_reviews)
-- - Rozszerzenie bookings o pola zakończenia / zgłoszenia niewykonania
-- - Status service_not_completed + RPC dla klienta (potwierdzenie / zgłoszenie)
--
-- Idempotentnie: tak (IF NOT EXISTS, DROP CONSTRAINT IF EXISTS przed CHECK).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) bookings — dodatkowe pola
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists completed_confirmed_at timestamptz,
  add column if not exists completion_feedback_status text,
  add column if not exists not_completed_reason text,
  add column if not exists not_completed_note text,
  add column if not exists not_completed_reported_at timestamptz,
  add column if not exists review_requested_at timestamptz,
  add column if not exists service_review_id uuid;

comment on column public.bookings.completed_confirmed_at is 'Klient potwierdził wykonanie usługi.';
comment on column public.bookings.completion_feedback_status is 'Np. pending_rating | rated | skipped.';
comment on column public.bookings.not_completed_reason is 'Kod powodu zgłoszenia niewykonania.';
comment on column public.bookings.not_completed_note is 'Dopisek klienta przy zgłoszeniu.';
comment on column public.bookings.not_completed_reported_at is 'Czas zgłoszenia niewykonania.';
comment on column public.bookings.review_requested_at is 'Czas wyświetlenia prośby o ocenę.';
comment on column public.bookings.service_review_id is 'Powiązana opinia ServyGo (jeśli dodana).';

alter table public.workshops
  add column if not exists google_place_id text;

comment on column public.workshops.google_place_id is 'Opcjonalny Google Place ID (np. pod link „Oceń w Google”).';

-- Rozszerzenie statusów rezerwacji
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
      'done',
      'service_not_completed'
    )
  );

-- ---------------------------------------------------------------------------
-- 2) service_reviews
-- ---------------------------------------------------------------------------
create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  rating integer not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint service_reviews_rating_check check (rating between 1 and 5),
  constraint service_reviews_booking_unique unique (booking_id)
);

create index if not exists service_reviews_workshop_id_idx on public.service_reviews(workshop_id);
create index if not exists service_reviews_user_id_idx on public.service_reviews(user_id);

alter table public.bookings drop constraint if exists bookings_service_review_id_fkey;

alter table public.bookings
  add constraint bookings_service_review_id_fkey
  foreign key (service_review_id) references public.service_reviews(id) on delete set null;

alter table public.service_reviews enable row level security;

drop policy if exists "service_reviews_select_own" on public.service_reviews;
create policy "service_reviews_select_own"
on public.service_reviews
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "service_reviews_select_workshop_owner" on public.service_reviews;
create policy "service_reviews_select_workshop_owner"
on public.service_reviews
for select
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_id
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "service_reviews_insert_own_booking" on public.service_reviews;
create policy "service_reviews_insert_own_booking"
on public.service_reviews
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and b.user_id = auth.uid()
      and b.status = 'completed'
  )
);

revoke all on public.service_reviews from anon;
grant select, insert on public.service_reviews to authenticated;

-- ---------------------------------------------------------------------------
-- 3) booking_reminders — log / deduplikacja
-- ---------------------------------------------------------------------------
create table if not exists public.booking_reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reminder_type text not null,
  channel text not null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent',
  error text
);

create unique index if not exists booking_reminders_booking_type_channel_uidx
  on public.booking_reminders(booking_id, reminder_type, channel);

create index if not exists booking_reminders_booking_id_idx on public.booking_reminders(booking_id);

alter table public.booking_reminders enable row level security;

-- Brak polityk dla authenticated — tylko service_role / backend.

revoke all on public.booking_reminders from anon;
revoke all on public.booking_reminders from authenticated;

-- ---------------------------------------------------------------------------
-- 4) user_notifications
-- ---------------------------------------------------------------------------
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  booking_id uuid references public.bookings(id) on delete cascade,
  workshop_id uuid references public.workshops(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications(user_id, is_read, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own"
on public.user_notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_notifications_update_own" on public.user_notifications;
create policy "user_notifications_update_own"
on public.user_notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on public.user_notifications from anon;
grant select, update on public.user_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 5) RPC — klient: potwierdzenie wykonania
-- ---------------------------------------------------------------------------
create or replace function public.client_confirm_service_completed(p_booking_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_row public.bookings%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_row.user_id <> v_uid then
    raise exception 'Forbidden';
  end if;
  if v_row.status is distinct from 'confirmed' then
    raise exception 'Rezerwacja nie jest w stanie potwierdzonym';
  end if;

  update public.bookings
  set
    status = 'completed',
    completed_confirmed_at = now(),
    completion_feedback_status = coalesce(completion_feedback_status, 'pending_rating'),
    review_requested_at = coalesce(review_requested_at, now()),
    updated_at = now()
  where id = p_booking_id;

  update public.user_notifications
  set is_read = true
  where booking_id = p_booking_id
    and user_id = v_uid
    and notification_type = 'completion_check';

  return 'completed';
end;
$fn$;

revoke all on function public.client_confirm_service_completed(uuid) from public;
grant execute on function public.client_confirm_service_completed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) RPC — klient: zgłoszenie niewykonania
-- ---------------------------------------------------------------------------
create or replace function public.client_report_service_not_completed(
  p_booking_id uuid,
  p_reason text,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_row public.bookings%rowtype;
  v_owner uuid;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  adm record;
  v_title text := 'Klient zgłosił niewykonanie usługi';
  v_body text;
  v_admin_title text := 'Sprawdź zgłoszenie niewykonanej usługi';
  v_admin_body text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_reason is null then
    raise exception 'Powód jest wymagany';
  end if;

  select * into v_row from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if v_row.user_id <> v_uid then
    raise exception 'Forbidden';
  end if;
  if v_row.status is distinct from 'confirmed' then
    raise exception 'Rezerwacja nie jest w stanie potwierdzonym';
  end if;

  select w.owner_id into v_owner
  from public.workshops w
  where w.id = v_row.workshop_id;

  update public.bookings
  set
    status = 'service_not_completed',
    not_completed_reason = v_reason,
    not_completed_note = v_note,
    not_completed_reported_at = now(),
    updated_at = now()
  where id = p_booking_id;

  update public.user_notifications
  set is_read = true
  where booking_id = p_booking_id
    and user_id = v_uid
    and notification_type = 'completion_check';

  v_body := format(
    'Rezerwacja %s — warsztat %s — usługa %s. Powód: %s.',
    p_booking_id,
    coalesce(v_row.workshop_name, '—'),
    coalesce(v_row.service_name, '—'),
    v_reason
  );

  if v_owner is not null then
    insert into public.user_notifications (user_id, notification_type, title, body, booking_id, workshop_id, payload)
    values (
      v_owner,
      'service_not_completed',
      v_title,
      v_body,
      p_booking_id,
      v_row.workshop_id,
      jsonb_build_object('reason', v_reason, 'client_note', v_note)
    );
  end if;

  v_admin_body := format('Booking %s — klient %s — warsztat %s.', p_booking_id, v_uid, coalesce(v_row.workshop_name, '—'));

  for adm in
    select au.user_id as uid
    from public.admin_users au
    where lower(coalesce(au.role, '')) in ('admin', 'owner')
  loop
    insert into public.user_notifications (user_id, notification_type, title, body, booking_id, workshop_id, payload)
    values (
      adm.uid,
      'service_not_completed_admin',
      v_admin_title,
      v_admin_body,
      p_booking_id,
      v_row.workshop_id,
      jsonb_build_object('reason', v_reason, 'client_note', v_note)
    );
  end loop;

  return 'reported';
end;
$fn$;

revoke all on function public.client_report_service_not_completed(uuid, text, text) from public;
grant execute on function public.client_report_service_not_completed(uuid, text, text) to authenticated;

commit;
