# Słownik polski — tabele i kolumny Supabase (ServyGo)

> **Nie zmieniaj nazw tabel i kolumn w Supabase. To są nazwy techniczne używane przez aplikację. Ten dokument służy tylko jako słownik i instrukcja dla administratora.**

---

## Słownik ogólnych kolumn (bardzo częste)

| Nazwa techniczna | Po polsku (znaczenie) | Uwagi |
|------------------|------------------------|-------|
| `id` | Unikalny identyfikator wiersza (UUID) | Klucz główny większości tabel. |
| `status` | Status (tekstowy kod stanu) | Znaczenie zależy od tabeli — patrz sekcje poniżej. |
| `booking_id` | Identyfikator rezerwacji | Odwołanie do `bookings.id`. |
| `workshop_id` | Identyfikator warsztatu | Odwołanie do `workshops.id`. |
| `user_id` | Identyfikator użytkownika (klient lub konto Auth) | Często klient przy rezerwacji; w rozliczeniach leadów także kopia z rezerwacji. |
| `created_at` | Data i czas utworzenia | |
| `updated_at` | Data i czas ostatniej aktualizacji | |

---

## Tabele — opis dla administratora

### `profiles`

- **Znaczenie:** Profil użytkownika aplikacji (dane osobowe, kontakt, ustawienia widoczności tam, gdzie dotyczy).
- **Do czego służy:** Lista i edycja danych użytkownika powiązanych z kontem Auth.
- **Ważniejsze kolumny:** `id` (zwykle ten sam co `auth.users.id`), imię, nazwisko, e‑mail/telefon (jeśli kolumny występują w migracji), ustawienia związane z kontem.
- **Uwagi:** Nie mylić z `workshops` — to profil osoby (klient/admin/właściciel warsztatu to role kontekstem użycia, nie osobna kolumna zawsze).

### `cars`

- **Znaczenie:** Pojazdy użytkownika.
- **Do czego służy:** Książka adresowa aut klientów pod rezerwacje i wizytówkę zamówienia.
- **Ważniejsze kolumny:** `user_id` (właściciel), marka/model/rok/tablica-rejestracyjna (zależnie od schematu).
- **Uwagi:** Rezerwacja może też mieć migawkę pojazdu w JSON (np. dane wizyty). Źródłem pojazdu w profilu jest ta tabela + powiązania.

### `workshops`

- **Znaczenie:** Rekord warsztatu na platformie — strona wizytówki, dostęp właściciela, status publikacji.
- **Do czego służy:** Tożsamość biznesowa warsztatu: nazwa, adres, miasto, godziny, link do map, właściciel (`owner_id` / powiązanie z użytkownikiem), status aktywności.
- **Ważniejsze kolumny:** `id`, `name`, `owner_id`, pola adresowe i kontaktowe, `status`, `opening_hours`.
- **Uwagi:** Lista rezerwacji i leadów filtrowana jest po `workshop_id`.

### `workshop_leads`

- **Znaczenie:** Zgłoszenie chęci zarejestrowania nowego warsztatu („lead onboardingowy”), zanim warsztat stanie się pełnym `workshops`.
- **Do czego służy:** Proces akceptacji w panelu admina, zbieranie NIP-u, adresu, opisu od zainteresowanych placówek.
- **Ważniejsze kolumny:** `status` cyklu zgłoszenia, dane placówki, opiekun kontaktu.
- **Uwagi:** To **nie** są leady rozliczeniowe z rezerwacji — te są w `booking_lead_settlements`.

### `workshop_services`

- **Znaczenie:** Katalog usług przypisanych do warsztatu (nazwa, kategoria, opis, szacunkowe ceny, czas trwania).
- **Do czego służy:** Oferta warsztatu w wyszukiwarce i przy rezerwacji.
- **Ważniejsze kolumny:** `workshop_id`, `service_name`, `category`, `price_from`, `price_to`, `duration_minutes`, `is_active`.
- **Uwagi:** W projekcie **nie ma** osobnej tabeli dokładnie o nazwie `workshop_service_prices`. Szczegółowe widełki cen mogą dodatkowo siedzieć w **`workshop_service_vehicle_prices`** (różna cena wg typu auta/marki).

### `workshop_service_vehicle_prices` *(zamiennik nazwy „workshop_service_prices” z życzenia dokumentu)*

- **Uwaga nomenklaturowa:** W repozytorium ServyGo występuje tabela **`workshop_service_vehicle_prices`** — ceny usługi z uwzględnieniem typu pojazdu/marki/itp. Nie mylić ze zwykłą listą nazw usług w `workshop_services`.
- **Znaczenie:** Cennik „usługa × segment pojazdu”.
- **Do czego służy:** Bogatsze ustalanie ceny i czasu niż jedna globalna stawka w `workshop_services`.

### `bookings`

- **Znaczenie:** Rezerwacja wizyty u warsztatu (termin, usługa, klient, status procesu).
- **Do czego służy:** Rdzeń marketplace: od złożenia zamiaru po zakończenie lub anulowanie.
- **Ważniejsze kolumny:**
  - `workshop_id`, `user_id` — kto gdzie;
  - `status` — **status rezerwacji** (patrz osobna sekcja);
  - `booking_date`, `start_time`, `end_time`, `duration_minutes` — slot;
  - `service_name`, `price` — kontekst oferty;
  - **`current_quote_id`** — wskaźnik na aktywny wiersz w `booking_quotes`;
  - **`quoted_price`**, **`final_price`** — kwoty z wyceny / po decyzji (synchronizowane z logiką RPC);
  - **`quote_status`** — stan decyzji klienta względem wyceny (tekst, np. oczekiwanie / zaakceptowana / odrzucona — dokładnie zależy od wartości w kodzie migracji/aplikacji).
- **Uwagi:** Statusy są rozbudowane (w tym historyczne/legacy). Jedna rezerwacja ma co najwyżej jeden aktywny wiersz wyceny w `booking_quotes`.

### `booking_quotes`

- **Znaczenie:** Wiersze w historii **wycen** dla konkretnej rezerwacji.
- **Do czego służy:** Warsztat ustala kwotę; klient akceptuje lub odrzuca; poprzednie wyceny mogą zostać oznaczone jako nieaktualne.
- **Ważniejsze kolumny:** `booking_id`, `workshop_id`, `user_id` (klient), `amount`, `currency`, **`status`** wyceny, `message` / notatka, znaczniki czasu akceptacji/odrzucenia.
- **Uwagi:** Tylko jedna wycena **`active`** jednocześnie na dany `booking_id` (unikalny indeks częściowy).

### `booking_lead_settlements`

- **Znaczenie:** Rozliczenie **leada** (opłata informacyjna / biznesowa) powiązanego 1:1 z rezerwacją.
- **Do czego służy:** MVP rozliczeń: czy lead jest płatny, testowy, sporny itd., bez faktur w samej tabeli.
- **Ważniejsze kolumny:**
  - `booking_id` (unikalny), `workshop_id`, `user_id`;
  - **`settlement_status`** — patrz sekcja statusów rozliczenia;
  - **`lead_fee_amount`** — stawka leada (np. 5 PLN);
  - **`test_mode`** — czy prowadzisz okres informacyjny bez naliczania faktycznej opłaty;
  - `eligible_at`, `not_eligible_at`, `not_eligible_reason`, `disputed_at`, `dispute_reason`, `invoiced_at`.
- **Uwagi:** Rekord zakładany przy rezerwacji (trigger lub RPC). Nie edytować „z palca” bez znajomości skutków dla raportów.

### `booking_status_events`

- **Znaczenie:** Dziennik zdarzeń (audyt ścieżki rezerwacji i rozliczenia).
- **Do czego służy:** Analiza: kto/co zmieniło stan, jakie komunikaty systemowe (`event_type`, `meta` jako JSON).
- **Ważniejsze kolumny:** `booking_id`, `from_status`, `to_status`, `event_type`, `source`, `actor_user_id`, `message`, `meta`, `created_at`.
- **Uwagi:** Nie jest to miejsce na ręczne „naprawianie” statusów — aplikacja i RPC piszą automatycznie.

### `internal_messages`

- **Znaczenie:** Wiadomości między użytkownikami/partiami (klient ⇄ warsztat) oraz wpisy **systemowe** (np. o wycenie).
- **Do czego służy:** Skrzynka w aplikacji, powiadomienia dzwoneczka.
- **Ważniejsze kolumny:** `sender_id`, `recipient_id`, `sender_role`, `recipient_role`, `subject`, `body`, `related_booking_id`, `related_workshop_id`, `is_read`.
- **Uwagi:** Wpisy `sender_role = system` są tworzone przez funkcje RPC (np. komunikat o wycenie).

### `user_notifications`

- **Znaczenie:** Lemat powiadomień dla użytkownika (lista zdarzeń dla UI / e-mailowych powiązań, zgodnie z implementacją).
- **Do czego służy:** Skrót „co się stało” per użytkownik.
- **Ważniejsze kolumny:** `user_id`, typ lub treść, flagi przeczytania/przetworzenia (wg schematu).
- **Uwagi:** Nie mieszać z `internal_messages` — inna funkcja produktowa.

### `support_reports`

- **Znaczenie:** Zgłoszenia problemów / uwag od użytkowników (support).
- **Do czego służy:** Moderacja przez admina, status zgłoszenia.
- **Ważniejsze kolumny:** treść zgłoszenia, autor, czas utworzenia, status obsługi.
- **Uwagi:** Oddzielne od sporów finansowych (`disputed` w rozliczeniach może być paralelą biznesową, ale to inna ścieżka danych).

### `admin_users`

- **Znaczenie:** Kto ma uprawnienia administratora ServyGo w bazie (powiązanie z `auth` / e‑mailem, rola).
- **Do czego służy:** RLS polityki typu „admin widzi wszystko”.
- **Ważniejsze kolumny:** `user_id`, `email`, `role` (np. `admin`, `owner` w logice helperów SQL).
- **Uwagi:** Zmiana tej tabeli ma wpływ na bezpieczeństwo — tylko świadomie.

---

## Widoki

### `workshop_monthly_lead_metrics` *(widok, nie tabela)*

- **Znaczenie:** Zestawienie **miesięcznych** liczb dla danego warsztatu: rezerwacje (wg statusów) oraz agregacja rozliczeń leadów (płatne, testowe, spory itd.).
- **Do czego służy:** Raport dla admina i panel „Leady i rozliczenia” u warsztatu (po RLS warsztat widzi tylko siebie).

**Kluczowe kolumny raportowe:**

| Kolumna techniczna | Znaczenie po polsku |
|--------------------|----------------------|
| `workshop_id` | Id warsztatu |
| `workshop_name` | Nazwa warsztatu (dla czytelności) |
| **`month`** | Pierwszy dzień miesiąca (okres zestawienia); agregacja zależy od logiki widoku |
| **`total_bookings`** | Liczba rezerwacji w miesiącu (wg dat wizyty/utworzenia — implementacja widoku) |
| **`confirmed_bookings`** | Rezerwacje ze statusem „potwierdzona” w tym miesiącu |
| **`completed_bookings`** | Zakończone wizyty (`completed` / `done`) |
| **`no_show_bookings`** | Brak stawienia się klienta (`no_show`) |
| **`cancelled_bookings`** | Anulowane (`cancelled` i warianty `cancelled_by_*`) |
| **`billable_leads`** | Liczba leadów w statusie rozliczenia **„płatny”** w danym miesiącu (wg dat zdarzenia rozliczenia) |
| **`waived_test_leads`** | Liczba leadów **testowych wartościowych** (bez opłaty z powodu okresu testowego) |
| **`disputed_leads`** | Spory rozliczeniowe |
| **`not_billable_leads`** | Leady świadomie **nie rozliczalne** |
| **`estimated_amount_pln`** | Szacunkowa **gotówka** z leadów rozliczalnych (PLN) — suma stawek `billable` |
| **`test_value_pln`** | **Informacyjna wartość** leadów testowych (PLN) — suma stawek `waived_test` |

- **Uwagi:** Widok korzysta z danych `bookings` i `booking_lead_settlements`; nie zmieniaj struktury przez „edycję widoku” w konsoli bez migracji aplikacji.

---

## Statusy rezerwacji (`bookings.status`)

Wartości dozwolone w CHECK (stan na migracji leadów MVP) — aplikacja może używać podzbioru lub starszych aliasów wizualnych:

| Status techniczny | Znaczenie (skrót) |
|-------------------|-------------------|
| `pending_quote` | Oczekiwanie na wycenę od warsztatu |
| `quote_sent` | Wycena wysłana — decyzja klienta |
| `awaiting_new_quote` | Po odrzuceniu wyceny — korektaścieżki nowej wyceny |
| `awaiting_quote` / `pending` / `new` | Legacy / wczesny etap rezerwacji |
| `quote_accepted` | Wycena zaakceptowana (czasem zbliżone do potwierdzenia — zależy od ścieżki) |
| `confirmed` | Wizyta potwierdzona |
| `quote_rejected` | Kontekst decyzji o wycenie (może współistnieć z innym stanem łańcucha) |
| `cancelled`, `cancelled_by_client`, `cancelled_by_workshop`, `cancelled_by_system` | Anulowanie (przez kogo) |
| `completed`, `done` | Wizyta zakończona |
| `no_show` | Klient się nie pojawił |
| `awaiting_reschedule` | Propozycja zmiany terminu |
| `rejected` | Odrzucona rezerwacja (warsztat / proces) |
| `service_not_completed` | Ścieżka „usługa niewykonana” (zgłoszenie/problem) |

### `expired` jako status **rezerwacji**

**W powyższym CHECK stan na bazie dla `bookings.status` nie zawiera wartości `expired`.** Wygaśnięcie terminu na wycenę jest realizowane typowo przez funkcje typu `expire_booking_quotes` i ustawienie **`cancelled`** (lub anulowanie kwot), a nie przez osobny status `expired` w `bookings`. Jeśli w UI pojawia się słowo „wygasło”, znaczenie częściej jest w logice czasu wygaśnięcia wyceny, nie osobnym ENUM.

---

## Statusy wyceny (`booking_quotes.status`)

| Status | Po polsku |
|--------|-----------|
| `active` | Aktualnie obowiązująca wycena (jedyna na daną rezerwację) |
| `replaced` | Zastąpiona nowszą wyceną |
| `accepted` | Zaakceptowana przez klienta |
| `rejected` | Odrzucona przez klienta |
| `cancelled` | Anulowana / unieważniona (np. anulowanie rezerwacji, wygaśnięcie) |

---

## Status rozliczenia leadów (`booking_lead_settlements.settlement_status`)

| Status | Po polsku | Praktyka |
|--------|-----------|---------|
| `pending` | Jeszcze nie wiadomo, czy lead będzie płatny | Stan początkowy po utworzeniu rezerwacji |
| `waived_test` | Wartościowy lead w **okresie testowym**, **bez opłaty** | Wartość informacyjna w raportach (`test_value_pln`) |
| `billable` | Lead **płatny** (rozliczalny wg zasad biznesowych) | Suma wpływa na `estimated_amount_pln` |
| `not_billable` | Nie rozliczalny / nie płaci | np. no-show, anulowanie, odrzucone ścieżki |
| `disputed` | Spór biznesowy / do wyjaśnienia | Wymaga procesu ludzkiego poza MVP |
| `invoiced` | Zastrzeżenie pod przyszły ** dokument rozliczenia / faktury** | Obecnie głównie semantyczne w MVP bez fakturowania |

Pole **`test_mode`** na wierszu rozliczenia: `true` = domyślnie model testowy (zakończenie wizyty daje zwykle `waived_test` zamiast `billable`). Po przejściu na produkcję (polityka biznesowa ustawiana poza dokumentem — zwykle zmiana `test_mode`) zakończone wizyty mogą wpadać do `billable`.

---

## Pola cenowe i wskaźnik wyceny na rezerwacji

| Nazwa techniczna | Znaczenie |
|------------------|-----------|
| `current_quote_id` | FK do **`booking_quotes.id`** dla **aktywnej** wyceny |
| `quoted_price` | Kwota zsynchronizowana z aktualną/obowiązującą wyceną |
| `final_price` | Cena przyjęta po decyzji (np. zaakceptowana wycena) |
| `quote_status` | Stan decyzji klienta wobec procesu wyceny w `bookings` (różnica względem `booking_quotes.status` — ten ostatni opisuje wiersz kwotowy). |

---

## Najważniejsze funkcje RPC (wybór dla administratora)

Nie zmieniaj sygnatur bez przeglądu aplikacji. Nazwy są po angielsku — poniżej krótki opis PO POLSKU:

| Funkcja | Role |
|---------|------|
| `create_booking_safe` | Tworzenie rezerwacji po stronie SQL (walidacje slotu, dostępu) |
| `send_booking_quote` | Warsztat wysyła kwotę; tworzy/aktualizuje `booking_quotes`, zmienia `bookings`, wiadomość systemowa |
| `respond_booking_quote` | Klient akceptuje/odrzuca wycenę |
| `cancel_booking` | Anulowanie przez klienta lub warsztat (logika `cancelled_by`) |
| `expire_booking_quotes` | Automatyczne wygaśnięcie przeterminowanych wycen / powiązanych stanów |
| `propose_booking_reschedule` / `respond_booking_reschedule` | Zmiana terminu (warsztat lub strona inicjująca — wg migracji) |
| `workshop_respond_client_reschedule` | Decyzja warsztatu wobec prośby klienta o nowy termin |
| `expire_pending_bookings_workshop_response_timeout` | Timeout nieodpowiadania warsztatu |
| `ensure_booking_lead_settlement` | Utworzenie rekordu rozliczenia leada przy braku |
| `mark_booking_visit_completed` | Zakończenie wizyty + rozliczenie (`waived_test` lub `billable`) |
| `mark_booking_no_show` | Brak przyjęcia klienta + `not_billable` |
| `mark_booking_settlement_disputed` | Zgłoszenie sporu rozliczenia |
| `bootstrap_first_admin` / `add_admin_if_empty` | Zarządzanie pierwszym kontem admina |

---

## Jak czytać raport leadów w Supabase

Pracując z widokiem **`workshop_monthly_lead_metrics`** (np. eksport z Table Editor po filtrze `workshop_id`):

- **`billable_leads`** — ile leadów w danym miesiącu ma status rozliczenia **rozliczalny / płatny** (`billable`). To są jednostki, za które **biznesowo** nalicza się opłatę w modelu produkcyjnym (stawka z `lead_fee_amount` każdego takiego wiersza sumuje się w **`estimated_amount_pln`**).

- **`waived_test_leads`** — ile leadów w tym miesiącu ma status **wartościowy, ale zwolniony z opłaty** (`waived_test`) — typowo okres testowy. Pokazują **potencjał** bez faktury.

- **`no_show_bookings`** — ile **rezerwacji** w danym miesiącu ma status **`no_show`** (klient nie przyjechał). To licznik **wizyt**, nie leadów płatnych.

- **`estimated_amount_pln`** — **szacowana kwota do zapłaty** (w PLN) z leadów `billable` w tym miesiącu — suma pól `lead_fee_amount` dla rozliczeń w tym statusie. W MVP **bez** automatycznej faktury — to podgląd finansowy.

- **`test_value_pln`** — **łączna wartość informacyjna** leadów testowych (`waived_test`) w PLN — „gdyby były płatne, ile by wyniosło”, do edukacji warsztatu w teście.

---

*Dokument może wymagać dopisania kolumn, jeśli dodasz nowe migracje — utrzymuj go razem ze schematem w `supabase/sql/`.*
