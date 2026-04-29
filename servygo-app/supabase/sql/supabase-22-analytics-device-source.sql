-- Supabase migration 22
-- Rozszerza analytics_events o dane o sesji, urzadzeniu i zrodle ruchu.

begin;

alter table public.analytics_events
  add column if not exists visitor_id text;

alter table public.analytics_events
  add column if not exists session_id text;

alter table public.analytics_events
  add column if not exists device_type text;

alter table public.analytics_events
  add column if not exists browser text;

alter table public.analytics_events
  add column if not exists os text;

alter table public.analytics_events
  add column if not exists user_agent text;

alter table public.analytics_events
  add column if not exists source text;

-- referrer istnieje od migracji 21, ale zachowujemy bezpieczny fallback
alter table public.analytics_events
  add column if not exists referrer text;

create index if not exists idx_analytics_events_source
  on public.analytics_events(source);

create index if not exists idx_analytics_events_device_type
  on public.analytics_events(device_type);

create index if not exists idx_analytics_events_path
  on public.analytics_events(path);

create index if not exists idx_analytics_events_visitor_session
  on public.analytics_events(visitor_id, session_id);

commit;
