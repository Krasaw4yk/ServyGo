-- =============================================================================
-- ServyGo / Supabase — plik: supabase/sql/supabase-52-demo-workshops-seed.sql
--
-- Cel:
-- - zasilić środowisko testowe 5 realistycznymi profilami demo;
-- - każde demo jest jawnie oznaczone (`is_demo=true`) i ma kontrolę widoczności.
--
-- UWAGA:
-- - skrypt jest idempotentny (upsert po `slug`);
-- - można bezpiecznie uruchamiać wielokrotnie.
-- =============================================================================

begin;

with demo_workshops as (
  select *
  from (
    values
      (
        'auto-serwis-podbeskidzie',
        'Auto Serwis Podbeskidzie',
        'Bielsko-Biała',
        'ul. Warszawska 120, Bielsko-Biała',
        'Lokalny serwis mechaniczny obsługujący podstawowe naprawy, wymianę oleju, hamulce, filtry oraz diagnostykę komputerową. Profil demonstracyjny do testów ServyGo.',
        49.8321::double precision,
        19.0484::double precision,
        4.7::numeric,
        128::integer,
        'Pn-Pt 08:00-17:00, Sob 09:00-13:00'
      ),
      (
        'motofix-klimatyzacja-i-diagnostyka',
        'MotoFix Klimatyzacja i Diagnostyka',
        'Czechowice-Dziedzice',
        'ul. Legionów 85, Czechowice-Dziedzice',
        'Warsztat skoncentrowany na diagnostyce i serwisie klimatyzacji. Profil demonstracyjny do testów ServyGo.',
        49.9146::double precision,
        19.0128::double precision,
        4.6::numeric,
        93::integer,
        'Pn-Pt 08:00-17:00, Sob 09:00-13:00'
      ),
      (
        'beskid-garage',
        'Beskid Garage',
        'Bielsko-Biała',
        'ul. Żywiecka 210, Bielsko-Biała',
        'Mechanika, hamulce i zawieszenie dla samochodów osobowych. Profil demonstracyjny do testów ServyGo.',
        49.8004::double precision,
        19.0252::double precision,
        4.8::numeric,
        154::integer,
        'Pn-Pt 08:00-17:00, Sob 09:00-13:00'
      ),
      (
        'quickoil-bielsko',
        'QuickOil Bielsko',
        'Bielsko-Biała',
        'ul. Cieszyńska 62, Bielsko-Biała',
        'Szybkie usługi eksploatacyjne: olej, filtry, płyny i wycieraczki. Profil demonstracyjny do testów ServyGo.',
        49.8192::double precision,
        19.0317::double precision,
        4.5::numeric,
        76::integer,
        'Pn-Pt 08:00-17:00, Sob 09:00-13:00'
      ),
      (
        'electrocar-serwis',
        'ElectroCar Serwis',
        'Żywiec',
        'ul. Krakowska 45, Żywiec',
        'Warsztat elektromechaniczny: diagnostyka układu ładowania, akumulatora i rozrusznika. Profil demonstracyjny do testów ServyGo.',
        49.6909::double precision,
        19.2034::double precision,
        4.7::numeric,
        101::integer,
        'Pn-Pt 08:00-17:00, Sob 09:00-13:00'
      )
  ) as d(
    slug,
    name,
    city,
    address,
    description,
    latitude,
    longitude,
    rating,
    reviews_count,
    opening_hours
  )
),
demo_owner as (
  select au.user_id as owner_id
  from public.admin_users au
  order by au.created_at asc
  limit 1
),
updated as (
  update public.workshops w
  set
    owner_id = coalesce(w.owner_id, o.owner_id),
    name = d.name,
    city = d.city,
    address = d.address,
    description = d.description,
    status = case when coalesce(w.owner_id, o.owner_id) is not null then 'active' else 'hidden' end,
    visibility_status = case when coalesce(w.owner_id, o.owner_id) is not null then 'active' else 'hidden' end,
    is_demo = true,
    show_on_map = true,
    latitude = d.latitude,
    longitude = d.longitude,
    rating = d.rating,
    reviews_count = d.reviews_count,
    services_summary = 'Profil demonstracyjny ServyGo',
    opening_hours = d.opening_hours,
    updated_at = now()
  from demo_workshops d
  left join demo_owner o on true
  where w.slug = d.slug
  returning w.id, w.slug
),
inserted as (
  insert into public.workshops (
    slug,
    owner_id,
    name,
    city,
    address,
    description,
    status,
    visibility_status,
    is_demo,
    show_on_map,
    latitude,
    longitude,
    rating,
    reviews_count,
    services_summary,
    opening_hours
  )
  select
    d.slug,
    o.owner_id,
    d.name,
    d.city,
    d.address,
    d.description,
    case when o.owner_id is not null then 'active' else 'hidden' end,
    case when o.owner_id is not null then 'active' else 'hidden' end,
    true,
    true,
    d.latitude,
    d.longitude,
    d.rating,
    d.reviews_count,
    'Profil demonstracyjny ServyGo',
    d.opening_hours
  from demo_workshops d
  left join demo_owner o on true
  where not exists (
    select 1 from public.workshops w where w.slug = d.slug
  )
  returning id, slug
),
affected as (
  select id, slug from updated
  union all
  select id, slug from inserted
)
delete from public.workshop_services ws
using affected a
where ws.workshop_id = a.id;

with seeded as (
  select w.id as workshop_id, w.slug
  from public.workshops w
  where w.slug in (
    'auto-serwis-podbeskidzie',
    'motofix-klimatyzacja-i-diagnostyka',
    'beskid-garage',
    'quickoil-bielsko',
    'electrocar-serwis'
  )
)
insert into public.workshop_services (
  workshop_id,
  service_name,
  price_from,
  price_to,
  duration_minutes,
  is_active,
  is_custom
)
select s.workshop_id, v.service_name, v.price_from, v.price_to, v.duration_minutes, true, true
from seeded s
join (
  values
    ('auto-serwis-podbeskidzie', 'Wymiana oleju i filtra', 120::numeric, 180::numeric, 45),
    ('auto-serwis-podbeskidzie', 'Diagnostyka komputerowa', 120::numeric, 200::numeric, 45),
    ('auto-serwis-podbeskidzie', 'Wymiana klocków hamulcowych przód', 180::numeric, 300::numeric, 90),
    ('auto-serwis-podbeskidzie', 'Wymiana filtrów', 50::numeric, 120::numeric, 45),
    ('auto-serwis-podbeskidzie', 'Serwis klimatyzacji', 180::numeric, 350::numeric, 90),

    ('motofix-klimatyzacja-i-diagnostyka', 'Diagnostyka komputerowa', 100::numeric, 180::numeric, 45),
    ('motofix-klimatyzacja-i-diagnostyka', 'Serwis klimatyzacji', 160::numeric, 320::numeric, 90),
    ('motofix-klimatyzacja-i-diagnostyka', 'Odgrzybianie klimatyzacji', 80::numeric, 150::numeric, 45),
    ('motofix-klimatyzacja-i-diagnostyka', 'Kasowanie błędów', 80::numeric, 140::numeric, 30),
    ('motofix-klimatyzacja-i-diagnostyka', 'Sprawdzenie czujników', 120::numeric, 220::numeric, 60),

    ('beskid-garage', 'Wymiana klocków hamulcowych przód', 160::numeric, 280::numeric, 90),
    ('beskid-garage', 'Naprawa zawieszenia', 180::numeric, 500::numeric, 120),
    ('beskid-garage', 'Wymiana opon komplet', 140::numeric, 240::numeric, 60),
    ('beskid-garage', 'Przegląd auta przed zakupem', 250::numeric, 450::numeric, 90),
    ('beskid-garage', 'Diagnostyka komputerowa', 120::numeric, 200::numeric, 45),

    ('quickoil-bielsko', 'Wymiana oleju i filtra', 100::numeric, 160::numeric, 35),
    ('quickoil-bielsko', 'Wymiana filtra kabinowego', 50::numeric, 90::numeric, 25),
    ('quickoil-bielsko', 'Wymiana filtra powietrza', 40::numeric, 80::numeric, 25),
    ('quickoil-bielsko', 'Kontrola płynów eksploatacyjnych', 40::numeric, 80::numeric, 20),
    ('quickoil-bielsko', 'Wymiana wycieraczek', 30::numeric, 60::numeric, 15),

    ('electrocar-serwis', 'Diagnostyka komputerowa', 120::numeric, 220::numeric, 45),
    ('electrocar-serwis', 'Sprawdzenie akumulatora', 40::numeric, 80::numeric, 20),
    ('electrocar-serwis', 'Wymiana akumulatora', 60::numeric, 120::numeric, 30),
    ('electrocar-serwis', 'Diagnostyka alternatora', 120::numeric, 250::numeric, 60),
    ('electrocar-serwis', 'Diagnostyka rozrusznika', 120::numeric, 250::numeric, 60)
) as v(slug, service_name, price_from, price_to, duration_minutes)
  on v.slug = s.slug;

commit;
