-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-58-system-changelog-seen-per-user.sql
--
-- Cel:
-- - zapamiętywanie „seen” changeloga systemowego per użytkownik i per panel (workshop/admin),
--   zamiast localStorage.
-- =============================================================================

begin;

create table if not exists public.system_changelog_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null,
  signature text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, audience)
);

alter table public.system_changelog_seen
  add constraint system_changelog_seen_audience_chk
  check (audience in ('workshop', 'admin'));

create index if not exists system_changelog_seen_user_id_idx
  on public.system_changelog_seen(user_id);

alter table public.system_changelog_seen enable row level security;

drop policy if exists "system_changelog_seen_select_own" on public.system_changelog_seen;
create policy "system_changelog_seen_select_own"
on public.system_changelog_seen
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "system_changelog_seen_insert_own" on public.system_changelog_seen;
create policy "system_changelog_seen_insert_own"
on public.system_changelog_seen
for insert
to authenticated
with check (auth.uid() = user_id and audience in ('workshop', 'admin'));

drop policy if exists "system_changelog_seen_update_own" on public.system_changelog_seen;
create policy "system_changelog_seen_update_own"
on public.system_changelog_seen
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and audience in ('workshop', 'admin'));

revoke all on public.system_changelog_seen from anon;
grant select, insert, update on public.system_changelog_seen to authenticated;

drop trigger if exists trg_system_changelog_seen_updated_at on public.system_changelog_seen;
create trigger trg_system_changelog_seen_updated_at
before update on public.system_changelog_seen
for each row
execute function public.set_updated_at();

commit;

