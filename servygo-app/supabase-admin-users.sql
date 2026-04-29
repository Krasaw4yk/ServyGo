-- =====================================================
-- LEGACY / ARCHIWUM
-- Plik historyczny: supabase-admin-users.sql
-- Status: przestarzały (zastąpiony przez supabase/sql/supabase-02-admin-users.sql
-- oraz supabase/sql/supabase-09-admin-approval-functions.sql).
-- Instrukcja: SUPABASE_SQL_INSTRUKCJA.md
-- =====================================================
-- ServyGo: admin_users migration + access model.
-- Execute once in Supabase SQL editor (acts as migration script).

begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  unique (user_id),
  unique (email)
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_select_own_admin_row" on public.admin_users;
create policy "admin_users_select_own_admin_row"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "admin_users_no_insert_for_users" on public.admin_users;
create policy "admin_users_no_insert_for_users"
on public.admin_users
for insert
to authenticated
with check (false);

drop policy if exists "admin_users_no_update_for_users" on public.admin_users;
create policy "admin_users_no_update_for_users"
on public.admin_users
for update
to authenticated
using (false)
with check (false);

drop policy if exists "admin_users_no_delete_for_users" on public.admin_users;
create policy "admin_users_no_delete_for_users"
on public.admin_users
for delete
to authenticated
using (false);

-- Helper: first authenticated user can bootstrap owner when table is empty.
create or replace function public.bootstrap_first_admin()
returns setof public.admin_users
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if uid is null then
    return;
  end if;

  if not exists (select 1 from public.admin_users) then
    insert into public.admin_users (user_id, email, role)
    values (uid, user_email, 'owner')
    on conflict (user_id) do nothing;
  end if;

  return query
  select *
  from public.admin_users
  where user_id = uid
  limit 1;
end;
$$;

grant execute on function public.bootstrap_first_admin() to authenticated;

-- Helper required by frontend addAdmin(userId, email): works only when admin_users is empty.
create or replace function public.add_admin_if_empty(
  target_user_id uuid,
  target_email text
)
returns setof public.admin_users
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if auth.uid() <> target_user_id then
    raise exception 'Can only promote current authenticated user';
  end if;

  if exists (select 1 from public.admin_users) then
    return;
  end if;

  insert into public.admin_users (user_id, email, role)
  values (target_user_id, lower(coalesce(target_email, '')), 'owner')
  on conflict (user_id) do update
    set email = excluded.email,
        role = 'owner';

  return query
  select *
  from public.admin_users
  where user_id = target_user_id
  limit 1;
end;
$$;

grant execute on function public.add_admin_if_empty(uuid, text) to authenticated;

-- Helper: owner/admin can add another admin without direct table writes.
create or replace function public.admin_add_user(
  target_user_id uuid,
  target_email text,
  target_role text default 'admin'
)
returns setof public.admin_users
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.admin_users
    where user_id = caller_id
      and role in ('owner', 'admin')
  ) then
    raise exception 'Insufficient privileges';
  end if;

  insert into public.admin_users (user_id, email, role)
  values (target_user_id, lower(coalesce(target_email, '')), coalesce(target_role, 'admin'))
  on conflict (user_id) do update
    set email = excluded.email,
        role = excluded.role;

  return query
  select *
  from public.admin_users
  where user_id = target_user_id
  limit 1;
end;
$$;

grant execute on function public.admin_add_user(uuid, text, text) to authenticated;

-- Admin-only visibility/mutation for workshop moderation data.
alter table public.workshop_leads enable row level security;

drop policy if exists "workshop_leads_select_admin_only" on public.workshop_leads;
create policy "workshop_leads_select_admin_only"
on public.workshop_leads
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

drop policy if exists "workshop_leads_update_admin_only" on public.workshop_leads;
create policy "workshop_leads_update_admin_only"
on public.workshop_leads
for update
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

alter table public.workshops enable row level security;

drop policy if exists "workshops_update_status_admin_only" on public.workshops;
create policy "workshops_update_status_admin_only"
on public.workshops
for update
to authenticated
using (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  )
);

commit;
