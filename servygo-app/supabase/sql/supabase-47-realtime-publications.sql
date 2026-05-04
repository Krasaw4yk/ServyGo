-- =============================================================================
-- ServyGo — realtime (Supabase): tabele w publikacji supabase_realtime
-- =============================================================================
-- Po wdrożeniu klient (useServyGoRealtime) dostaje zdarzenia postgres_changes.
-- Idempotentne: pomija tabele już dodane do publikacji.
-- =============================================================================

begin;

create or replace function public._servygo_add_table_to_realtime(p_table text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if exists (
    select 1
    from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = p_table
  ) then
    return;
  end if;
  execute format('alter publication supabase_realtime add table public.%I', p_table);
exception
  when undefined_object then
    raise notice 'Publikacja supabase_realtime nie istnieje — pomijam %.', p_table;
  when undefined_table then
    raise notice 'Tabela public.% nie istnieje — pomijam.', p_table;
end;
$fn$;

select public._servygo_add_table_to_realtime('bookings');
select public._servygo_add_table_to_realtime('internal_messages');
select public._servygo_add_table_to_realtime('user_notifications');
select public._servygo_add_table_to_realtime('workshop_leads');
select public._servygo_add_table_to_realtime('support_reports');

drop function if exists public._servygo_add_table_to_realtime(text);

commit;

notify pgrst, 'reload schema';
