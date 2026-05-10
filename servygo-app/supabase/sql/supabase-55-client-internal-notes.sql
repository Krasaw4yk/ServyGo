-- =============================================================================
-- ServyGo — wewnętrzne notatki o kliencie (warsztat + admin)
-- =============================================================================
-- Tabela: client_internal_notes (soft delete przez deleted_at)
-- Dostęp: wyłącznie przez SECURITY DEFINER RPC (klient bez dostępu)
-- Wymaga: supabase-07-bookings, workshops, profiles, auth.users, admin_users
--         oraz public._servygo_is_admin_user (supabase-49-lead-settlement-mvp.sql)
-- =============================================================================

begin;

create table if not exists public.client_internal_notes (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid null references public.bookings(id) on delete set null,
  workshop_id uuid null references public.workshops(id) on delete set null,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_role text not null check (author_role in ('workshop', 'admin')),
  note_type text not null default 'neutral' check (note_type in ('neutral', 'positive', 'warning', 'problem')),
  content text not null check (char_length(trim(content)) between 3 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists client_internal_notes_client_created_idx
  on public.client_internal_notes(client_user_id, created_at desc);

create index if not exists client_internal_notes_workshop_created_idx
  on public.client_internal_notes(workshop_id, created_at desc);

create index if not exists client_internal_notes_booking_idx
  on public.client_internal_notes(booking_id);

drop trigger if exists trg_client_internal_notes_updated_at on public.client_internal_notes;
create trigger trg_client_internal_notes_updated_at
before update on public.client_internal_notes
for each row execute function public.set_updated_at();

alter table public.client_internal_notes enable row level security;

drop policy if exists client_internal_notes_deny_anon_select on public.client_internal_notes;
drop policy if exists client_internal_notes_deny_authenticated_select on public.client_internal_notes;
drop policy if exists client_internal_notes_deny_authenticated_mutate_ins on public.client_internal_notes;
drop policy if exists client_internal_notes_deny_authenticated_mutate_upd on public.client_internal_notes;
drop policy if exists client_internal_notes_deny_authenticated_del on public.client_internal_notes;

-- Brak dostępu z klienta: polityki z USING(false); wyłącznie RPC SECURITY DEFINER.
create policy client_internal_notes_deny_anon_select
on public.client_internal_notes
for select to anon
using (false);

create policy client_internal_notes_deny_authenticated_select
on public.client_internal_notes
for select to authenticated
using (false);

create policy client_internal_notes_deny_authenticated_mutate_ins
on public.client_internal_notes
for insert to authenticated
with check (false);

create policy client_internal_notes_deny_authenticated_mutate_upd
on public.client_internal_notes
for update to authenticated
using (false);

create policy client_internal_notes_deny_authenticated_del
on public.client_internal_notes
for delete to authenticated
using (false);

-- -----------------------------------------------------------------------------
-- Lista notatek dla klienta (admin — wszystkie aktywne; warsztat — własny + admin global).
-- -----------------------------------------------------------------------------
create or replace function public.list_client_internal_notes(
  p_client_user_id uuid,
  p_workshop_id uuid default null
)
returns table (
  id uuid,
  client_user_id uuid,
  booking_id uuid,
  workshop_id uuid,
  author_user_id uuid,
  author_role text,
  note_type text,
  content text,
  created_at timestamptz,
  updated_at timestamptz,
  author_label text,
  workshop_name text
)
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if public._servygo_is_admin_user(auth.uid()) then
    return query
    select
      n.id,
      n.client_user_id,
      n.booking_id,
      n.workshop_id,
      n.author_user_id,
      n.author_role,
      n.note_type,
      n.content,
      n.created_at,
      n.updated_at,
      coalesce(
        nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
        p.email,
        '—'
      ) as author_label,
      w.name as workshop_name
    from public.client_internal_notes n
    left join public.profiles p on p.id = n.author_user_id
    left join public.workshops w on w.id = n.workshop_id
    where n.client_user_id = p_client_user_id
      and n.deleted_at is null
    order by n.created_at desc;
    return;
  end if;

  if p_workshop_id is null then
    raise exception 'workshop_id required for non-admin';
  end if;

  if not exists (
    select 1
    from public.workshops w
    where w.id = p_workshop_id
      and w.owner_id is not distinct from auth.uid()
  ) then
    raise exception 'Forbidden';
  end if;

  if not exists (
    select 1
    from public.bookings b
    where b.user_id = p_client_user_id
      and b.workshop_id = p_workshop_id
  ) then
    raise exception 'No booking link between client and workshop';
  end if;

  return query
  select
    n.id,
    n.client_user_id,
    n.booking_id,
    n.workshop_id,
    n.author_user_id,
    n.author_role,
    n.note_type,
    n.content,
    n.created_at,
    n.updated_at,
    coalesce(
      nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
      p.email,
      '—'
    ) as author_label,
    w.name as workshop_name
  from public.client_internal_notes n
  left join public.profiles p on p.id = n.author_user_id
  left join public.workshops w on w.id = n.workshop_id
  where n.client_user_id = p_client_user_id
    and n.deleted_at is null
    and (
      n.workshop_id is not distinct from p_workshop_id
      or (n.author_role = 'admin' and n.workshop_id is null)
    )
  order by n.created_at desc;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Dodanie notatki
-- -----------------------------------------------------------------------------
create or replace function public.add_client_internal_note(
  p_client_user_id uuid,
  p_booking_id uuid default null,
  p_workshop_id uuid default null,
  p_note_type text default 'neutral',
  p_content text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_trim text;
  v_norm_type text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_trim := trim(coalesce(p_content, ''));
  if char_length(v_trim) < 3 or char_length(v_trim) > 1000 then
    raise exception 'Invalid note length';
  end if;

  v_norm_type := lower(trim(coalesce(p_note_type, 'neutral')));
  if v_norm_type not in ('neutral', 'positive', 'warning', 'problem') then
    raise exception 'Invalid note_type';
  end if;

  if p_booking_id is not null then
    if not exists (
      select 1 from public.bookings b
      where b.id = p_booking_id
        and b.user_id is not distinct from p_client_user_id
    ) then
      raise exception 'booking does not match client';
    end if;
  end if;

  if public._servygo_is_admin_user(auth.uid()) then
    if p_booking_id is not null and p_workshop_id is not null then
      if not exists (
        select 1 from public.bookings b
        where b.id = p_booking_id
          and b.workshop_id is not distinct from p_workshop_id
      ) then
        raise exception 'booking does not match workshop';
      end if;
    end if;

    insert into public.client_internal_notes (
      client_user_id, booking_id, workshop_id, author_user_id, author_role, note_type, content
    )
    values (
      p_client_user_id,
      p_booking_id,
      p_workshop_id,
      auth.uid(),
      'admin',
      v_norm_type,
      v_trim
    )
    returning id into v_id;
    return v_id;
  end if;

  if p_workshop_id is null then
    raise exception 'workshop_id required for workshop author';
  end if;

  if not exists (
    select 1
    from public.workshops w
    where w.id = p_workshop_id
      and w.owner_id is not distinct from auth.uid()
  ) then
    raise exception 'Forbidden';
  end if;

  if not exists (
    select 1
    from public.bookings b
    where b.user_id = p_client_user_id
      and b.workshop_id = p_workshop_id
  ) then
    raise exception 'No booking link between client and workshop';
  end if;

  if p_booking_id is not null then
    if not exists (
      select 1 from public.bookings b
      where b.id = p_booking_id
        and b.user_id is not distinct from p_client_user_id
        and b.workshop_id is not distinct from p_workshop_id
    ) then
      raise exception 'booking does not match workshop context';
    end if;
  end if;

  insert into public.client_internal_notes (
    client_user_id, booking_id, workshop_id, author_user_id, author_role, note_type, content
  )
  values (
    p_client_user_id,
    p_booking_id,
    p_workshop_id,
    auth.uid(),
    'workshop',
    v_norm_type,
    v_trim
  )
  returning id into v_id;
  return v_id;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Miękkie usuwanie
-- -----------------------------------------------------------------------------
create or replace function public.soft_delete_client_internal_note(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n public.client_internal_notes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into n
  from public.client_internal_notes
  where id = p_note_id;

  if not found then
    raise exception 'Note not found';
  end if;

  if n.deleted_at is not null then
    return;
  end if;

  if public._servygo_is_admin_user(auth.uid()) then
    update public.client_internal_notes
    set deleted_at = now(), updated_at = now()
    where id = p_note_id;
    return;
  end if;

  if n.author_role = 'workshop'
     and n.author_user_id is not distinct from auth.uid()
     and n.workshop_id is not null
     and exists (
       select 1 from public.workshops w
       where w.id = n.workshop_id
         and w.owner_id is not distinct from auth.uid()
     )
  then
    update public.client_internal_notes
    set deleted_at = now(), updated_at = now()
    where id = p_note_id;
    return;
  end if;

  raise exception 'Forbidden';
end;
$fn$;

grant execute on function public.list_client_internal_notes(uuid, uuid) to authenticated;
grant execute on function public.add_client_internal_note(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.soft_delete_client_internal_note(uuid) to authenticated;

commit;
