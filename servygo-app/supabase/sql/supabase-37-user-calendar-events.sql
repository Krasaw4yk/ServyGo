-- ServyGo — własne wydarzenia kalendarza klienta (user_calendar_events)
-- Idempotentna, bez DROP/TRUNCATE danych.

begin;

create table if not exists public.user_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid references public.cars(id) on delete set null,
  title text not null,
  event_type text not null default 'custom',
  event_date date not null,
  event_time time null,
  description text null,
  reminder_days_before integer null,
  status text not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_calendar_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.user_calendar_events
  add column if not exists car_id uuid references public.cars(id) on delete set null;

alter table public.user_calendar_events add column if not exists title text;
alter table public.user_calendar_events add column if not exists event_type text;
alter table public.user_calendar_events add column if not exists event_date date;
alter table public.user_calendar_events add column if not exists event_time time;
alter table public.user_calendar_events add column if not exists description text;
alter table public.user_calendar_events add column if not exists reminder_days_before integer;
alter table public.user_calendar_events add column if not exists status text;
alter table public.user_calendar_events add column if not exists created_at timestamptz;
alter table public.user_calendar_events add column if not exists updated_at timestamptz;

alter table public.user_calendar_events alter column event_type set default 'custom';
alter table public.user_calendar_events alter column status set default 'upcoming';
alter table public.user_calendar_events alter column created_at set default now();
alter table public.user_calendar_events alter column updated_at set default now();

update public.user_calendar_events set event_type = coalesce(nullif(trim(event_type), ''), 'custom') where event_type is null;
update public.user_calendar_events set status = coalesce(nullif(trim(status), ''), 'upcoming') where status is null;

alter table public.user_calendar_events alter column title set not null;
alter table public.user_calendar_events alter column event_date set not null;
alter table public.user_calendar_events alter column user_id set not null;

create index if not exists user_calendar_events_user_date_idx
  on public.user_calendar_events(user_id, event_date desc);

drop trigger if exists trg_user_calendar_events_updated_at on public.user_calendar_events;
create trigger trg_user_calendar_events_updated_at
before update on public.user_calendar_events
for each row
execute function public.set_updated_at();

alter table public.user_calendar_events enable row level security;

drop policy if exists "user_calendar_events_select_own" on public.user_calendar_events;
create policy "user_calendar_events_select_own"
on public.user_calendar_events for select to authenticated
using (user_id = auth.uid());

drop policy if exists "user_calendar_events_insert_own" on public.user_calendar_events;
create policy "user_calendar_events_insert_own"
on public.user_calendar_events for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_calendar_events_update_own" on public.user_calendar_events;
create policy "user_calendar_events_update_own"
on public.user_calendar_events for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_calendar_events_delete_own" on public.user_calendar_events;
create policy "user_calendar_events_delete_own"
on public.user_calendar_events for delete to authenticated
using (user_id = auth.uid());

notify pgrst, 'reload schema';

commit;
