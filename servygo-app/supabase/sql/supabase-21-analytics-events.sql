-- Supabase migration 21
-- Zdarzenia analityczne aplikacji (strony, wyszukiwania, klikniecia, rezerwacje).

begin;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  path text,
  referrer text,
  user_id uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_name_created_at
  on public.analytics_events(event_name, created_at desc);

create index if not exists idx_analytics_events_created_at
  on public.analytics_events(created_at desc);

create index if not exists idx_analytics_events_user_id
  on public.analytics_events(user_id);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_insert_public" on public.analytics_events;
create policy "analytics_events_insert_public"
on public.analytics_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "analytics_events_select_admin" on public.analytics_events;
create policy "analytics_events_select_admin"
on public.analytics_events
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  )
);

commit;
