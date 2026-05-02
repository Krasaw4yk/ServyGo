-- =============================================================================
-- ServyGo — user_favorite_workshops
-- Ulubione warsztaty użytkownika (jawny zapis serduszkiem), bez automatycznego
-- dodawania z rezerwacji.
-- =============================================================================

begin;

create table if not exists public.user_favorite_workshops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_favorite_workshops_user_workshop_unique unique (user_id, workshop_id)
);

create index if not exists idx_user_favorite_workshops_user_id
  on public.user_favorite_workshops(user_id);
create index if not exists idx_user_favorite_workshops_workshop_id
  on public.user_favorite_workshops(workshop_id);

alter table public.user_favorite_workshops enable row level security;

grant select, insert, delete on public.user_favorite_workshops to authenticated;

drop policy if exists "user_favorite_workshops_select_own" on public.user_favorite_workshops;
create policy "user_favorite_workshops_select_own"
on public.user_favorite_workshops
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_favorite_workshops_insert_own" on public.user_favorite_workshops;
create policy "user_favorite_workshops_insert_own"
on public.user_favorite_workshops
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_favorite_workshops_delete_own" on public.user_favorite_workshops;
create policy "user_favorite_workshops_delete_own"
on public.user_favorite_workshops
for delete
to authenticated
using (auth.uid() = user_id);

notify pgrst, 'reload schema';

commit;
