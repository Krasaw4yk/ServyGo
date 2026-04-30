-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-26-internal-messages-rls-and-threads.sql
--
-- Cel:
-- - zaostrzenie RLS dla internal_messages;
-- - dopuszczenie UPDATE tylko dla kolumny is_read;
-- - wysyłka wiadomości tylko w kontekście booking/service_request;
-- - przygotowanie danych do wątków rozmów.
-- =============================================================================

begin;

alter table public.internal_messages
  add column if not exists service_request_id uuid references public.service_requests(id) on delete set null;

create index if not exists internal_messages_related_booking_idx
  on public.internal_messages(related_booking_id, created_at desc);

create index if not exists internal_messages_related_service_request_idx
  on public.internal_messages(service_request_id, created_at desc);

create or replace function public.can_send_internal_message(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_related_booking_id uuid,
  p_service_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_booking_user_id uuid;
  v_booking_owner_id uuid;
begin
  if p_sender_id is null or p_recipient_id is null then
    return false;
  end if;

  if p_related_booking_id is not null then
    select b.user_id, w.owner_id
      into v_booking_user_id, v_booking_owner_id
    from public.bookings b
    join public.workshops w on w.id = b.workshop_id
    where b.id = p_related_booking_id;

    if v_booking_user_id is null or v_booking_owner_id is null then
      return false;
    end if;

    return (
      (p_sender_id = v_booking_user_id and p_recipient_id = v_booking_owner_id)
      or
      (p_sender_id = v_booking_owner_id and p_recipient_id = v_booking_user_id)
    );
  end if;

  if p_service_request_id is not null then
    return exists (
      select 1
      from public.service_requests sr
      where sr.id = p_service_request_id
    );
  end if;

  return false;
end;
$fn$;

create or replace function public.internal_messages_guard_is_read_only()
returns trigger
language plpgsql
as $fn$
begin
  if new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.sender_role is distinct from old.sender_role
     or new.recipient_role is distinct from old.recipient_role
     or new.subject is distinct from old.subject
     or new.body is distinct from old.body
     or new.related_booking_id is distinct from old.related_booking_id
     or new.related_workshop_id is distinct from old.related_workshop_id
     or new.service_request_id is distinct from old.service_request_id
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Dozwolona jest wyłącznie aktualizacja kolumny is_read.';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_internal_messages_read_only on public.internal_messages;
create trigger trg_internal_messages_read_only
before update on public.internal_messages
for each row
execute function public.internal_messages_guard_is_read_only();

create or replace function public.mark_message_as_read(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.internal_messages im
  set is_read = true
  where im.id = p_message_id
    and im.recipient_id = auth.uid();

  return found;
end;
$fn$;

drop policy if exists "internal_messages_select_private_or_admin" on public.internal_messages;
create policy "internal_messages_select_private_only"
on public.internal_messages
for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
);

drop policy if exists "internal_messages_insert_authenticated" on public.internal_messages;
create policy "internal_messages_insert_context_only"
on public.internal_messages
for insert
to authenticated
with check (
  (
    sender_id = auth.uid()
    and sender_role in ('client', 'workshop', 'admin', 'owner')
    and public.can_send_internal_message(sender_id, recipient_id, related_booking_id, service_request_id)
  )
  or
  (
    sender_id is null
    and sender_role = 'system'
    and recipient_id is not null
    and exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and lower(coalesce(au.role, '')) in ('admin', 'owner')
    )
    and (related_booking_id is null or exists (select 1 from public.bookings b where b.id = related_booking_id))
    and (service_request_id is null or exists (select 1 from public.service_requests sr where sr.id = service_request_id))
  )
);

drop policy if exists "internal_messages_update_read_owner_or_admin" on public.internal_messages;
create policy "internal_messages_update_read_recipient_only"
on public.internal_messages
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

grant execute on function public.mark_message_as_read(uuid) to authenticated;
grant execute on function public.can_send_internal_message(uuid, uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
