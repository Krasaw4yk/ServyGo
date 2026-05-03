-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-41-workshops-map-listing.sql
--
-- Cel:
-- - pola pod mapę ServyGo (Leaflet / OSM): współrzędne, widoczność na mapie;
-- - slug publiczny, oceny, Google place_id (tylko zapis — mapa używa lat/lng);
-- - brak automatycznego włączania mapy: show_on_map domyślnie false.
--
-- Wymagany: po supabase-14-workshops-admin-manage.sql (RLS active już jest).
-- Idempotencja: tak.
-- =============================================================================

begin;

alter table public.workshops add column if not exists slug text;
alter table public.workshops add column if not exists latitude double precision;
alter table public.workshops add column if not exists longitude double precision;
alter table public.workshops add column if not exists rating numeric(3, 2) default 0;
alter table public.workshops add column if not exists reviews_count integer default 0 not null;
alter table public.workshops add column if not exists google_place_id text;
alter table public.workshops add column if not exists show_on_map boolean default false not null;

comment on column public.workshops.slug is 'Krótki identyfikator URL (opcjonalny).';
comment on column public.workshops.latitude is 'Szerokość geograficzna — mapa ServyGo (OSM), nie Google Maps.';
comment on column public.workshops.longitude is 'Długość geograficzna — mapa ServyGo (OSM).';
comment on column public.workshops.rating is 'Średnia ocena (0–5), prezentacja na liście ofert.';
comment on column public.workshops.reviews_count is 'Liczba opinii wyświetlana przy ocenie.';
comment on column public.workshops.google_place_id is 'Opcjonalny Google Place ID — zapis referencyjny.';
comment on column public.workshops.show_on_map is 'Gdy true i status active, warsztat może być pokazany na /oferty (lista + mapa). Wymaga ręcznej decyzji admina.';

create unique index if not exists idx_workshops_slug_unique on public.workshops (slug) where slug is not null and length(trim(slug)) > 0;

create index if not exists idx_workshops_show_on_map on public.workshops (show_on_map) where show_on_map = true;

commit;
