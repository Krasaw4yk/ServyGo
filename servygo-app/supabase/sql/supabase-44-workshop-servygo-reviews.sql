-- ServyGo — opinie wewnętrzne (ServyGo), osobno od Google.

begin;

create table if not exists public.workshop_servygo_reviews (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid null references public.bookings(id) on delete set null,
  service_name text null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  display_name_mode text not null default 'first_initial' check (display_name_mode in ('first_initial', 'nickname')),
  display_name_snapshot text not null,
  status text not null default 'published' check (status in ('published', 'pending', 'hidden', 'reported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workshop_servygo_reviews_one_per_booking
  on public.workshop_servygo_reviews (booking_id)
  where booking_id is not null;

create index if not exists workshop_servygo_reviews_workshop_idx on public.workshop_servygo_reviews (workshop_id, created_at desc);
create index if not exists workshop_servygo_reviews_status_idx on public.workshop_servygo_reviews (status);

alter table public.workshop_servygo_reviews enable row level security;

drop policy if exists "servygo_reviews_select_published" on public.workshop_servygo_reviews;
create policy "servygo_reviews_select_published"
on public.workshop_servygo_reviews
for select
to anon, authenticated
using (
  status = 'published'
  or user_id = auth.uid()
  or exists (
    select 1 from public.workshops w
    where w.id = workshop_servygo_reviews.workshop_id and w.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid()
      and lower(coalesce(au.role, '')) in ('admin', 'owner')
  )
);

drop policy if exists "servygo_reviews_insert_authenticated" on public.workshop_servygo_reviews;
create policy "servygo_reviews_insert_authenticated"
on public.workshop_servygo_reviews
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "servygo_reviews_update_own" on public.workshop_servygo_reviews;
create policy "servygo_reviews_update_own"
on public.workshop_servygo_reviews
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "servygo_reviews_delete_own" on public.workshop_servygo_reviews;
create policy "servygo_reviews_delete_own"
on public.workshop_servygo_reviews
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "servygo_reviews_admin_update" on public.workshop_servygo_reviews;
create policy "servygo_reviews_admin_update"
on public.workshop_servygo_reviews
for update
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

drop trigger if exists trg_workshop_servygo_reviews_updated_at on public.workshop_servygo_reviews;
create trigger trg_workshop_servygo_reviews_updated_at
before update on public.workshop_servygo_reviews
for each row execute function public.set_updated_at();

commit;
