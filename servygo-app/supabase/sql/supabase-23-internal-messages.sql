-- ServyGo: internal messaging inbox

create extension if not exists pgcrypto;

create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid null references auth.users(id) on delete set null,
  recipient_id uuid null references auth.users(id) on delete set null,
  sender_role text,
  recipient_role text,
  subject text,
  body text not null,
  related_booking_id uuid null references public.bookings(id) on delete set null,
  related_workshop_id uuid null references public.workshops(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists internal_messages_sender_id_idx on public.internal_messages(sender_id);
create index if not exists internal_messages_recipient_id_idx on public.internal_messages(recipient_id);
create index if not exists internal_messages_created_at_idx on public.internal_messages(created_at desc);
create index if not exists internal_messages_is_read_idx on public.internal_messages(is_read);

alter table public.internal_messages enable row level security;

drop policy if exists "internal_messages_select_private_or_admin" on public.internal_messages;
create policy "internal_messages_select_private_or_admin"
on public.internal_messages
for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and lower(coalesce(au.role, '')) in ('admin', 'owner')
  )
);

drop policy if exists "internal_messages_insert_authenticated" on public.internal_messages;
create policy "internal_messages_insert_authenticated"
on public.internal_messages
for insert
to authenticated
with check (
  -- user can send as self (normal flow)
  sender_id = auth.uid()
  -- or system-like writes from privileged roles
  or exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and lower(coalesce(au.role, '')) in ('admin', 'owner')
  )
);

drop policy if exists "internal_messages_update_read_owner_or_admin" on public.internal_messages;
create policy "internal_messages_update_read_owner_or_admin"
on public.internal_messages
for update
to authenticated
using (
  recipient_id = auth.uid()
  or sender_id = auth.uid()
  or exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and lower(coalesce(au.role, '')) in ('admin', 'owner')
  )
)
with check (
  recipient_id = auth.uid()
  or sender_id = auth.uid()
  or exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and lower(coalesce(au.role, '')) in ('admin', 'owner')
  )
);
