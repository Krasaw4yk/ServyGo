-- ServyGo — internal_messages: pozwól na wpisy systemowe w kontekście bookingu
-- dla uczestników rezerwacji (klient <-> właściciel warsztatu), nie tylko admina.

begin;

drop policy if exists "internal_messages_insert_context_only" on public.internal_messages;
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
    and (
      exists (
        select 1
        from public.admin_users au
        where au.user_id = auth.uid()
          and lower(coalesce(au.role, '')) in ('admin', 'owner')
      )
      or exists (
        select 1
        from public.bookings b
        join public.workshops w on w.id = b.workshop_id
        where b.id = related_booking_id
          and (
            (b.user_id = auth.uid() and recipient_id in (b.user_id, w.owner_id))
            or
            (w.owner_id = auth.uid() and recipient_id in (b.user_id, w.owner_id))
          )
      )
    )
    and (related_booking_id is null or exists (select 1 from public.bookings b where b.id = related_booking_id))
    and (service_request_id is null or exists (select 1 from public.service_requests sr where sr.id = service_request_id))
  )
);

notify pgrst, 'reload schema';

commit;
