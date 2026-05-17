-- ServyGo — zdjęcia warsztatu (tylko warsztat i admin wg aplikacji).
-- Po tym pliku uruchom: supabase-61-workshop-photos-storage.sql (RLS uploadu do Storage).
-- Bucket „workshop-photos”: utwórz ręcznie w Dashboard → Storage → Public bucket.

begin;

create table if not exists public.workshop_photos (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  storage_path text not null,
  public_url text null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  uploaded_by_role text null,
  caption text null,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workshop_photos_workshop_idx on public.workshop_photos (workshop_id, sort_order, created_at);

alter table public.workshop_photos enable row level security;

drop policy if exists "workshop_photos_public_select_active" on public.workshop_photos;
create policy "workshop_photos_public_select_active"
on public.workshop_photos
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "workshop_photos_owner_manage" on public.workshop_photos;
create policy "workshop_photos_owner_manage"
on public.workshop_photos
for all
to authenticated
using (
  exists (
    select 1 from public.workshops w
    where w.id = workshop_photos.workshop_id and w.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workshops w
    where w.id = workshop_photos.workshop_id and w.owner_id = auth.uid()
  )
);

drop policy if exists "workshop_photos_admin_all" on public.workshop_photos;
create policy "workshop_photos_admin_all"
on public.workshop_photos
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

drop trigger if exists trg_workshop_photos_updated_at on public.workshop_photos;
create trigger trg_workshop_photos_updated_at
before update on public.workshop_photos
for each row execute function public.set_updated_at();

commit;
