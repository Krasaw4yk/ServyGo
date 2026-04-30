-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-29-workshop-services-rls-hardening.sql
--
-- Cel:
-- - uszczelnienie RLS dla workshop_services;
-- - gwarancja, ze owner aktywnego warsztatu moze: select/insert/update/delete;
-- - publiczny select dalej tylko dla aktywnych uslug aktywnych warsztatow.
-- =============================================================================

begin;

alter table public.workshop_services enable row level security;

drop policy if exists "workshop_services_select_own" on public.workshop_services;
create policy "workshop_services_select_own"
on public.workshop_services
for select
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and (w.owner_id = auth.uid() or w.owner_user_id = auth.uid())
  )
);

drop policy if exists "workshop_services_insert_own" on public.workshop_services;
create policy "workshop_services_insert_own"
on public.workshop_services
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and (w.owner_id = auth.uid() or w.owner_user_id = auth.uid())
  )
);

drop policy if exists "workshop_services_update_own" on public.workshop_services;
create policy "workshop_services_update_own"
on public.workshop_services
for update
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and (w.owner_id = auth.uid() or w.owner_user_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and (w.owner_id = auth.uid() or w.owner_user_id = auth.uid())
  )
);

drop policy if exists "workshop_services_delete_own" on public.workshop_services;
create policy "workshop_services_delete_own"
on public.workshop_services
for delete
to authenticated
using (
  exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and (w.owner_id = auth.uid() or w.owner_user_id = auth.uid())
  )
);

drop policy if exists "workshop_services_update_admin" on public.workshop_services;
create policy "workshop_services_update_admin"
on public.workshop_services
for all
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "workshop_services_select_public_active" on public.workshop_services;
create policy "workshop_services_select_public_active"
on public.workshop_services
for select
to anon, authenticated
using (
  coalesce(workshop_services.is_active, true)
  and exists (
    select 1
    from public.workshops w
    where w.id = workshop_services.workshop_id
      and lower(trim(coalesce(w.status, ''))) in ('active', 'approved')
  )
);

notify pgrst, 'reload schema';

commit;
