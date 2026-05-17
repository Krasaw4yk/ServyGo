-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-61-workshop-photos-storage.sql
--
-- Do czego służy:
-- - polityki RLS na storage.objects dla bucketa „workshop-photos” (upload plików);
-- - uzupełnia supabase-45-workshop-photos.sql (tabela workshop_photos).
--
-- Wymagany: tak, jeśli upload zdjęć kończy się „row-level security policy”.
-- Uruchom po: supabase-45-workshop-photos.sql (oraz wcześniejszy łańcuch z workshops).
--
-- Ręcznie w Dashboard (nie da się z SQL):
-- - Storage → bucket „workshop-photos” → Public bucket (aplikacja używa getPublicUrl).
--
-- Ścieżka pliku w Storage (z lib/workshopPhotosApi.ts):
--   {workshop_id}/{uuid}-{nazwa_pliku}
-- =============================================================================

begin;

drop policy if exists "workshop_photos_storage_owner_insert" on storage.objects;
create policy "workshop_photos_storage_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'workshop-photos'
  and exists (
    select 1
    from public.workshops w
    where w.id = (split_part(name, '/', 1))::uuid
      and w.owner_id = auth.uid()
  )
);

drop policy if exists "workshop_photos_storage_admin_insert" on storage.objects;
create policy "workshop_photos_storage_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'workshop-photos'
  and exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and lower(coalesce(au.role, '')) in ('admin', 'owner')
  )
);

commit;
