-- Supabase migration 19
-- Dodaje gorny prog ceny dla uslug warsztatu.

alter table public.workshop_services
  add column if not exists price_to numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workshop_services_price_range_check'
      and conrelid = 'public.workshop_services'::regclass
  ) then
    alter table public.workshop_services
      add constraint workshop_services_price_range_check
      check (
        price_from is null
        or price_to is null
        or price_to >= price_from
      );
  end if;
end $$;
