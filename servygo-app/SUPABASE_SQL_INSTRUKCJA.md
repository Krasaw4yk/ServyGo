# ServyGo – instrukcja SQL dla Supabase

Ten dokument porządkuje uruchamianie SQL w projekcie ServyGo.

## TL;DR — po co ten plik i czego **nie** robi sam z siebie

- **Supabase to Twoja baza w chmurze.** Żaden plik w repozytorium Git **nie uruchamia się tam automatycznie** po `git push`. Skrypty z `supabase/sql/` musisz **Ty** (lub skrypt CI, który sam skonfigurujesz) wkleić i odpalić w **Supabase → SQL Editor** na **Twoim** projekcie. Ja nie mam dostępu do Twojego konta Supabase, więc **nie mogę** „kliknąć Run” za Ciebie ani dodać `SUPABASE_SERVICE_ROLE_KEY` na hosting — to fizycznie po Twojej stronie.
- **Ta instrukcja to mapa:** jaka jest **zalecana kolejność** plików, co robi każdy etap, oraz osobno (**K.01–K.07**) co wpisać w **`.env.local` / env na hostingu** i co ustawić w **Authentication** w dashboardzie. Nie musisz jej „wykonywać” jak zadania domowego codziennie — tylko gdy stawiasz **nowe środowisko** (np. drugi projekt Supabase), **deploy na nowy hosting**, albo coś się wysypuje i szukasz „co powinno było być już na bazie”.
- **Masz ~58 plików SQL, a „pierwsze 15” działają?** Świetnie — to jest rdzeń pod wczesny ServyGo. Kolejne numery to **kolejne funkcje** (rezerwacje sloty, wyceny, analityka itd.). Odpalasz je **wtedy, gdy korzystasz z tych części aplikacji** albo wg kolejności z sekcji poniżej, żeby uniknąć błędów typu „brakuje tabeli / funkcji”. Jeśli czegoś nie używasz, część migracji może chwilowo nie być potrzebna — ale wtedy i tak mogą pojawić się błędy w kodzie, który już zakłada nowszy schemat.
- **Krótko:** instrukcja **nie zastępuje** Twojego jednego kliknięcia w Supabase ani wpisania sekretów na hostingu — **uporządkuje**, żebyś nie zgadywał kolejności i nie szukał kluczy „gdzie indziej niż trzeba”.

## Zasady dla kolejnych plików SQL

1. **Nowe skrypty tylko w `supabase/sql/`** — każda nowa logika jako osobny plik `supabase-NN-opis.sql`. Nie dopisuj nowego kodu do starych, „pomieszanych” plików w katalogu głównym projektu (legacy).
2. **Numeracja** — kolejny plik ma numer **o jeden większy** niż najwyższy już istniejący w `supabase/sql/` (np. po `supabase-12-…` następny to `supabase-13-…`).
3. **Nagłówek po polsku** w każdym nowym pliku: cel, zmieniane tabele/funkcje/polityki, czy wymagany, idempotencja, kiedy uruchomić.
4. **Ten dokument** — po dodaniu pliku dopisz go tutaj z krótkim opisem i w **zalecanej kolejności uruchamiania**.

## Gdzie są pliki docelowe

Używaj plików z katalogu:

- `supabase/sql/`

Pliki w katalogu głównym (`SQL_DLA_SUPABASE.sql`, `supabase-admin-users.sql`, `supabase-bookings.sql`, `supabase-admin-approve-lead.sql`) są traktowane jako **legacy / historyczne źródła**.

## Co wpisać i skonfigurować (ServyGo ↔ Supabase)

Tu zbieramy **wszystko, co musisz uzupełnić poza samym SQL** — numeracja **K.01, K.02, …** jest robocza; kolejne ważne punkty dopisujemy na końcu jako **K.08**, **K.09** itd. (nie myl tego z numerami plików `supabase-NN-*.sql`).

### K.01 — `NEXT_PUBLIC_SUPABASE_URL`

- **Gdzie wpisać:** plik `.env.local` w katalogu **`servygo-app`** (obok `package.json`), albo zmienne środowiskowe na hostingu.
- **Skąd wartość:** Supabase → *Project Settings* → *API* → **Project URL**.
- **Po zmianie:** zrestartuj proces Node (`npm run dev` / redeploy).

### K.02 — `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- **Gdzie wpisać:** to samo co K.01 (`.env.local` / hosting).
- **Skąd wartość:** *Project Settings* → *API* → **anon public** key.
- **Uwaga:** ten klucz jest w bundle klienta — to normalne dla Supabase w przeglądarce.

### K.03 — `SUPABASE_SERVICE_ROLE_KEY`

- **Gdzie wpisać:** to samo co K.01 — **wyłącznie** po stronie serwera.
- **Skąd wartość:** *Project Settings* → *API* → **service_role** (sekret).
- **Uwagi:** **nigdy** nie dodawaj prefiksu `NEXT_PUBLIC_`. Bez tej zmiennej **nie zadziała** akceptacja zgłoszenia warsztatu z zaproszeniem do Auth (`/api/admin/approve-workshop-lead`, `lib/supabaseAdmin.ts`).
- **Po zmianie:** zrestartuj serwer deweloperski / hosting.

### K.04 — `NEXT_PUBLIC_SITE_URL` (zalecane w prod, opcjonalne lokalnie)

- **Gdzie wpisać:** `.env.local` / hosting.
- **Po co:** stabilny **bazowy URL** w redirectach z maili (zaproszenie / reset hasła). Kod bierze go w pierwszej kolejności (`lib/siteOrigin.ts`); jeśli puste, używa nagłówka żądania (`Host` / `X-Forwarded-Host`).
- **Przykład lokalnie:** `http://localhost:3000`
- **Przykład produkcja:** `https://twoja-domena.pl` (bez końcowego `/`)

### K.05 — Supabase Dashboard → Authentication

1. **Redirect URLs** — muszą zawierać adresy postaci `{origin}/auth/callback` (np. `http://localhost:3000/auth/callback` oraz URL produkcyjny). Inaczej link z maila po **zaproszeniu** lub **resecie hasła** może zostać odrzucony przez Supabase.
2. **Site URL** — ustaw zgodnie z głównym adresem aplikacji (często jak K.04 w produkcji).
3. **E-mail:** domyślny nadawca Supabase wystarczy do testów; na produkcji rozważ **własny SMTP** (*Authentication* → *SMTP Settings*).

### K.06 — SQL pod przycisk „Akceptuj” (warsztat + właściciel Auth)

- **Minimum:** wykonaj w *SQL Editor* łańcuch migracji z sekcji **„Kolejność uruchamiania (zalecana)”** (poniżej) **od początku listy „Wymagane”** aż do pliku **`supabase/sql/supabase-15-workshop-owner-access.sql`** (w kolejności zależności z tej sekcji — m.in. przed 15 muszą być 00–14 i odpowiednia kolejność względem pliku 11).
- Ten plik definiuje m.in. **`admin_approve_workshop_lead(p_lead_id, p_owner_user_id)`** — bez niego aplikacja nie dokończy tworzenia warsztatu po stronie bazy.

### K.07 — Szybka weryfikacja (akceptacja zgłoszenia z e-mailem warsztatu)

1. Są ustawione **K.01–K.03**, zrestartowany dev / deploy.
2. W Auth dopisane **Redirect URL** dla `/auth/callback` (K.05).
3. W bazie wgrany łańcug SQL **do migracji 15** (K.06).
4. W panelu `/admin` → *Zgłoszenia warsztatowe* → *Akceptuj*: backend (`app/api/admin/approve-workshop-lead/route.ts`) z **service role** szuka użytkownika Auth po e-mailu; jeśli **nie ma** — wywołuje **`inviteUserByEmail`** (link ustawienia hasła); jeśli **jest** — **`resetPasswordForEmail`** z kluczem anon. Potem z Twoją sesją admina wywoływane jest RPC **`admin_approve_workshop_lead`**, które tworzy warsztat i przypisuje **`owner_id`**.

Jeśli brakuje tylko K.03, API zwraca **503** z czytelną listą brakujących zmiennych (komunikat z `describeMissingEnvForAdminSupabaseApis` w `lib/supabaseAdmin.ts`).

### K.08 — Zdjęcia warsztatu (upload w `/workshop-panel`)

**Aplikacja** wgrywa pliki przez `POST /api/workshop/photos/upload` (service role po stronie serwera) — wymaga **K.03** (`SUPABASE_SERVICE_ROLE_KEY` w `.env.local`).

**Ty w Supabase Dashboard:**

1. **Storage** → bucket **`workshop-photos`** (jeśli brak) → **Public bucket**.
2. **SQL Editor** → `supabase-45-workshop-photos.sql` (tabela + RLS). Opcjonalnie `supabase-61-workshop-photos-storage.sql` (bezpośredni upload z przeglądarki).
3. Zrestartuj `npm run dev` po zmianie `.env.local`.

## Kolejność uruchamiania (zalecana)

### Wymagane

1. `supabase/sql/supabase-00-core-helpers.sql`
2. `supabase/sql/supabase-01-profiles.sql`
3. `supabase/sql/supabase-02-admin-users.sql`
4. `supabase/sql/supabase-03-workshops.sql`
5. `supabase/sql/supabase-04-workshop-leads.sql`
6. `supabase/sql/supabase-05-workshop-services.sql`
7. `supabase/sql/supabase-06-service-requests.sql`
8. `supabase/sql/supabase-07-bookings.sql`
9. `supabase/sql/supabase-08-cars.sql`
10. `supabase/sql/supabase-09-admin-approval-functions.sql`
11. `supabase/sql/supabase-12-workshop-leads-archive-status.sql` — status `archived`, indeks po statusie, pierwsza wersja aktualizacji `admin_approve_workshop_lead` (blokada zarchiwizowanych). Uruchom po pliku 09.
12. `supabase/sql/supabase-13-workshop-leads-columns-public-visibility.sql` — kolumny `google_maps_url` / `services` na leadach, `google_maps_url` / `services_summary` na warsztatach, polityki publicznego odczytu warsztatów i usług, akceptacja tworzy warsztat ze statusem `active` i zapisuje usługi z tekstu leada. Uruchom po pliku 12 (nadpisuje `admin_approve_workshop_lead`).
13. `supabase/sql/supabase-14-workshops-admin-manage.sql` — kolumna `opening_hours` na warsztatach, normalizacja starych statusów do `active`, publiczny odczyt warsztatów i usług tylko przy `status = 'active'`, RLS dla admina: odczyt/zarządzanie `workshop_services` oraz odczyt `bookings`. Uruchom po `supabase-13-workshop-leads-columns-public-visibility.sql`.
14. `supabase/sql/supabase-15-workshop-owner-access.sql` — kolumna wyliczana `owner_user_id` (= `owner_id`), RPC `admin_approve_workshop_lead(uuid, uuid)` z przypisaniem właściciela Auth, rozszerzone statusy i `car_id` w `bookings`, RLS właściciela do rezerwacji oraz odczytu profili/aut klientów, trigger blokujący zmianę `status` warsztatu przez właściciela (bez roli admin). Uruchom po pliku 14.
15. `supabase/sql/supabase-11-auth-profile-trigger.sql`
16. `supabase/sql/supabase-16-admin-notification-badges.sql` — polityka `profiles_select_admin` (RLS) dla licznika „Użytkownicy (ostatnie 24h)” w badge panelu admina. Uruchom po pliku 15.
17. `supabase/sql/supabase-17-workshop-availability-and-services.sql` — tabela `workshop_availability_exceptions` (wyjątki kalendarza), rozbudowa `workshop_services` o pola usług/cen (`service_key`, `category`, `description`, `price_from`, `duration_minutes`, `is_active`, `is_custom`) oraz polityki RLS owner/admin i publiczny odczyt tylko aktywnych usług warsztatów `active`. Uruchom po pliku 16.
18. `supabase/sql/supabase-18-bookings-duration-slots-and-employees.sql` — rozbudowa `bookings` o zakres czasu (`booking_date`, `start_time`, `end_time`, `duration_minutes`), dane klienta/auta i `employee_id`, tabela `workshop_employees`, `required_roles` na `workshop_services`, antykolizyjny constraint dla aktywnych rezerwacji (`new`, `confirmed`) oraz RPC `create_booking_safe(...)` z walidacją kolizji i automatycznym doborem pracownika. Uruchom po pliku 17.
19. `supabase/sql/supabase-19-workshop-services-price-to.sql` — dodaje kolumnę `price_to` (cena "do") do `workshop_services` i constraint spójności zakresu (`price_to >= price_from`). Uruchom po pliku 18.
20. `supabase/sql/supabase-20-cars-vin-multiple.sql` — rozszerza `cars` o `vin` i `city`, dodaje indeks VIN per użytkownik, gwarantuje maksymalnie jedno auto główne (`is_primary = true`) oraz usuwa ewentualny legacy-constraint wymuszający jedno auto na `user_id`. Uruchom po pliku 19.
21. `supabase/sql/supabase-21-analytics-events.sql` — tabela `analytics_events` (zdarzenia frontendu), indeksy pod dashboard admina i RLS: insert dla `anon`/`authenticated`, select tylko dla admina (na podstawie `admin_users`). Uruchom po pliku 20.
22. `supabase/sql/supabase-22-analytics-device-source.sql` — rozszerza `analytics_events` o: `visitor_id`, `session_id`, `device_type`, `browser`, `os`, `user_agent`, `source` (+ fallback `referrer`) i indeksy pod raporty ruchu. Uruchom po pliku 21.

### Opcjonalne / testowe

- **Opc. 1** — `supabase/sql/supabase-10-seed-test-workshop-lead.sql` — funkcja testowa do szybkiego tworzenia przykładowego zgłoszenia warsztatu z panelu admina. Uruchom **po** wymaganym łańcuchu (gdy reszta schematu już jest na bazie); nie jest konieczny do produkcji.

## Mapa tabel ServyGo

- `profiles` — dane profilu użytkownika.
- `admin_users` — lista administratorów panelu (`owner` / `admin`).
- `workshops` — zaakceptowane warsztaty; `owner_id` / `owner_user_id` → `auth.users` (właściciel panelu warsztatu, migracja 15); statusy biznesowe: `active`, `suspended`, `hidden` (po migracji 14 publicznie widoczne są tylko `active`; legacy `approved` / `aktywny` są mapowane do `active`); pola `google_maps_url`, `services_summary`, `opening_hours` (po migracjach 13–14).
- `workshop_leads` — zgłoszenia z formularza (status m.in. `pending`, `approved`, `rejected`, `archived`); pola `services`, `google_maps_url` (po migracji 13).
- `workshop_services` — usługi przypisane do warsztatu; po migracjach 17 i 19: `service_key`, `category`, `description`, `price_from`, `price_to`, `duration_minutes`, `is_active`, `is_custom`.
- `workshop_employees` — pracownicy warsztatu, role/specjalizacje, aktywność.
- `workshop_availability_exceptions` — wyjątki dostępności na konkretne dni (`date`, `is_closed`, `open_time`, `close_time`, `note`).
- `service_requests` — zapytania klientów o usługę.
- `bookings` — rezerwacje terminów; po migracji 18: `booking_date`, `start_time`, `end_time`, `duration_minutes`, `employee_id`, dane klienta/auta + statusy operacyjne (`new`, `confirmed`, `cancelled`, `rejected`, `done`).
- `cars` — auta użytkowników (po migracji 20 także: `vin`, `city`; nadal wiele aut na użytkownika + jedno opcjonalne `is_primary`).
- `analytics_events` — zdarzenia analityczne (np. `page_view`, `search_submit`, `workshop_click`, `booking_start`, `booking_confirm`) wykorzystywane przez dashboard admina.

## Jak dodać siebie jako admina

1. Zaloguj się kontem, które ma być adminem.
2. Wejdź na `/make-me-admin`.
3. Jeśli tabela `admin_users` jest pusta, konto zostanie podniesione do `owner`.

Alternatywnie SQL (manualnie):

- dodaj rekord do `admin_users`, albo
- użyj funkcji `bootstrap_first_admin()` / `admin_add_user(...)`.

## Jak sprawdzić, czy wszystko działa

1. Wyślij zgłoszenie z `/dodaj-warsztat` (status `pending` w `workshop_leads`).
2. Otwórz `/admin` → `Zgłoszenia warsztatów` — widać realne rekordy z bazy.
3. `Akceptuj` — API serwera tworzy/zaprasza konto Auth, powstaje wiersz w `workshops` z `owner_id` (status `active`), usługi trafiają do `workshop_services`, lead `approved` (wymaga migracji 15 i `SUPABASE_SERVICE_ROLE_KEY` na hostingu). **Krok po kroku konfiguracja:** punkty **K.01–K.07** na początku tego pliku.
4. Otwórz `/oferty` i `/warsztat/{uuid}` — widać tylko warsztaty ze statusem `active` (po migracji 14).
5. `Odrzuć` / `Zarchiwizuj` — odpowiednie statusy leada, bez usuwania rekordu.

## Zgodność z kodem aplikacji (audyt)

Zweryfikowane nazwy używane w kodzie:

- `profiles`
- `admin_users`
- `workshops`
- `workshop_leads`
- `workshop_services`
- `service_requests`
- `bookings`
- `cars`

Nazwy tabel i kluczowe kolumny są spójne z kodem (`app/*`, `lib/adminApi.ts`, `lib/workshopApi.ts`, `lib/workshopOwnerApi.ts`, `lib/publicWorkshopsFromDb.ts`, `app/page.tsx`).

## Uwagi o bezpieczeństwie i wielokrotnym uruchamianiu

- Pliki są przygotowane w stylu idempotentnym (`create table if not exists`, `drop policy if exists`, `create or replace function`).
- Możesz uruchamiać ponownie po poprawkach.
- W pliku testowym (`supabase-10-*`) jest `notify pgrst, 'reload schema'`, co pomaga odświeżyć cache RPC.
