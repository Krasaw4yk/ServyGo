-- Supabase migration 20
-- Rozszerza auta uzytkownika o VIN i miasto oraz dopina wsparcie wielu aut.

begin;

alter table public.cars
  add column if not exists vin text;

alter table public.cars
  add column if not exists city text;

create index if not exists idx_cars_user_vin on public.cars(user_id, vin);

-- Zapewnia co najwyzej jedno auto glowne na uzytkownika.
create unique index if not exists idx_cars_one_primary_per_user
  on public.cars(user_id)
  where is_primary = true;

-- Usuwa potencjalne stare ograniczenie "jedno auto na user_id", jesli istnialo.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'cars'
      and con.contype = 'u'
      and array_length(con.conkey, 1) = 1
      and con.conkey[1] = (
        select attnum
        from pg_attribute
        where attrelid = 'public.cars'::regclass
          and attname = 'user_id'
          and not attisdropped
        limit 1
      )
  loop
    execute format('alter table public.cars drop constraint %I', c.conname);
  end loop;
end $$;

commit;
