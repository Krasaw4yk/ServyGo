-- ServyGo — anulowanie pending_quote bez odpowiedzi warsztatu (wersja testowa: 24h).
-- Wywołanie przez właściciela warsztatu lub administratora (cron nie jest wymagany).

begin;

create or replace function public.expire_pending_bookings_workshop_response_timeout(p_hours integer default 24)
returns table(booking_id uuid, client_user_id uuid, workshop_id uuid)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_hours integer := greatest(coalesce(p_hours, 24), 1);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  with cand as (
    select b.id, b.user_id as cid, b.workshop_id as wid
    from public.bookings b
    join public.workshops w on w.id = b.workshop_id
    where b.status = 'pending_quote'
      and b.quote_sent_at is null
      and b.created_at < now() - make_interval(hours => v_hours)
      and (
        w.owner_id = auth.uid()
        or exists (
          select 1 from public.admin_users au
          where au.user_id = auth.uid()
            and lower(coalesce(au.role, '')) in ('admin', 'owner')
        )
      )
  ),
  upd as (
    update public.bookings b
    set status = 'cancelled',
        cancelled_by = 'system',
        cancelled_at = now(),
        cancellation_reason = coalesce(b.cancellation_reason, 'workshop_response_timeout'),
        cancel_reason = coalesce(b.cancel_reason, 'Brak odpowiedzi warsztatu w wymaganym czasie.'),
        updated_at = now()
    from cand c
    where b.id = c.id
    returning b.id, b.user_id, b.workshop_id
  )
  select upd.id, upd.user_id, upd.workshop_id from upd;
end;
$fn$;

grant execute on function public.expire_pending_bookings_workshop_response_timeout(integer) to authenticated;

comment on function public.expire_pending_bookings_workshop_response_timeout(integer) is
  'Anuluje pending_quote starsze niż p_hours bez quote_sent_at; tylko owner warsztatu lub admin. Nie usuwa historii.';

commit;
