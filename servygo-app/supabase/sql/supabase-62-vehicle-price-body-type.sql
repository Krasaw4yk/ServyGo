begin;

alter table public.workshop_service_vehicle_prices
  add column if not exists body_type text null;

comment on column public.workshop_service_vehicle_prices.body_type is
  'Typ nadwozia (hatchback / sedan_liftback / kombi / suv_crossover / mpv_van / coupe_cabrio). NULL = dotyczy konkretnego auta (marka+model).';

create index if not exists workshop_service_vehicle_prices_body_type_idx
  on public.workshop_service_vehicle_prices(body_type)
  where body_type is not null;

commit;
