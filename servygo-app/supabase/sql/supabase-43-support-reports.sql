-- ServyGo — zgłoszenia problemów (Serwis / platforma), nie reklamacje napraw u warsztatu.

begin;

create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  email text not null,
  report_type text not null,
  subject text not null,
  message text not null,
  booking_id uuid null references public.bookings(id) on delete set null,
  workshop_id uuid null references public.workshops(id) on delete set null,
  legal_ack boolean not null default false,
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_reports_created_idx on public.support_reports (created_at desc);
create index if not exists support_reports_status_idx on public.support_reports (status);

alter table public.support_reports enable row level security;

drop policy if exists "support_reports_insert_anon" on public.support_reports;
create policy "support_reports_insert_anon"
on public.support_reports
for insert
to anon
with check (user_id is null);

drop policy if exists "support_reports_insert_own" on public.support_reports;
create policy "support_reports_insert_own"
on public.support_reports
for insert
to authenticated
with check (
  user_id is null or user_id = auth.uid()
);

drop policy if exists "support_reports_select_own" on public.support_reports;
create policy "support_reports_select_own"
on public.support_reports
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "support_reports_admin_all" on public.support_reports;
create policy "support_reports_admin_all"
on public.support_reports
for all
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
      and lower(coalesce(au.role, '')) in ('admin', 'owner')
  )
)
with check (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
      and lower(coalesce(au.role, '')) in ('admin', 'owner')
  )
);

drop trigger if exists trg_support_reports_updated_at on public.support_reports;
create trigger trg_support_reports_updated_at
before update on public.support_reports
for each row execute function public.set_updated_at();

commit;
