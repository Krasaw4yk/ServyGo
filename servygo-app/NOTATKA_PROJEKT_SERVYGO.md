# ServyGo — notatka projektowa (kontekst dla Claude)

Skrótowy opis `servygo-app` bez wklejania całego kodu.

---

## 1. Struktura i ważne pliki

- **`app/`** — App Router Next.js: `page.tsx` per trasa, `layout.tsx` główny, `api/` (cron, admin, konto).
- **`components/`** — wspólne UI (`ServyGoPageShell`, `ServyGoSubpageNavBar`, `InternalInbox`, mapy ofert, moduły `home/`, `workshop/`, `admin/`, `legal/`, `booking/`).
- **`lib/`** — logika domenowa: Supabase (`supabaseClient`, `supabaseAdmin`), `adminApi`, `workshopOwnerApi`, `messagesApi`, `notificationsApi`, `publicWorkshopsFromDb`, realtime, tłumaczenia, katalog usług.
- **`supabase/sql/`** — numerowane migracje SQL (źródło prawdy schematu); **`SUPABASE_SQL_INSTRUKCJA.md`** — kolejność uruchamiania.
- **Legacy w rootcie aplikacji:** `SQL_DLA_SUPABASE.sql`, inne stare `.sql` — tylko referencja; nie jako główny pakiet.

---

## 2. Technologie

- **Next.js 16** (Turbopack w dev), **React 19**, **TypeScript**, **Tailwind CSS 4**.
- **Supabase:** Auth, Postgres, RLS, RPC, Realtime.
- **Mapy:** Leaflet (`react-leaflet`) — oferty / admin.
- **E-mail / powiadomienia:** część przez API; część ścieżek nadal ze „stubem” (pkt 10).

---

## 3. Główne strony i ścieżki

| Ścieżka | Rola |
|--------|------|
| **`/`** | Landing + wyszukiwarka (`HomePageClient`, JSON-LD). |
| **`/oferty`** | Lista / filtry + mapa (`OffersPageClient`, query `city`, `service`). |
| **`/warsztat/[id]`** | Karta warsztatu; **`id` = UUID** rekordu w Supabase. |
| **`/moje-konto`** | Hub po zalogowaniu; bez sesji → redirect `/?auth=login`. |
| **`/panel-warsztatu`** | **Redirect** → **`/workshop-panel`**. |
| **`/admin`** | Panel administratora (`robots: noindex`). |

Dodatkowo: `/moje-rezerwacje`, `/moje-wiadomosci`, `/moj-kalendarz`, `/dodaj-warsztat`, `/ustawienia`, `/powiadomienia`, strony lokalne SEO (`…/bielsko-biala`), `/auth/callback`, **`/make-me-admin`** (dev — ryzyko produkcyjne).

---

## 4. Flow użytkownika (klient)

`/` lub `/oferty` → `/warsztat/[id]` → logowanie Supabase → rezerwacja (m.in. RPC `create_booking_safe`), wyceny (`booking_quotes`), wiadomości, powiadomienia, ulubione, kalendarz, auta, potwierdzenia ukończenia / opinie ServyGo.

---

## 5. Flow warsztatu

`/dodaj-warsztat` → lead → admin zatwierdza (`admin_approve_workshop_lead`, API service role) → **`owner_id`** → **`/workshop-panel`**: rezerwacje, odpowiedzi / timeouty, kalendarz, usługi i ceny, pracownicy, zdjęcia, leady i rozliczenia MVP, wiadomości; podgląd admina `?adminPreview=1&workshopId=…`.

---

## 6. Flow panelu admina

`/admin` → `getAdminRecord` (**`admin_users`**) → bez rekordu: `/moje-konto`. Zakładki: dashboard, wiadomości, zgłoszenia (warsztaty + support), warsztaty, mapa, rezerwacje, rozliczenie leadów, użytkownicy, usługi/ceny, moderacja opinii ServyGo, statystyki, ustawienia. Logika: `lib/adminApi`, `app/api/admin/*`.

---

## 7. Główne komponenty UI

`ServyGoPageShell`, `ServyGoSubpageNavBar`, `InternalInbox`, modale rezerwacji / reschedule, `home/*`, `OffersLeafletMap`, komponenty `workshop/`, `AdminServyGoMapSection`, `LegalReacceptanceModal`, `MobileBottomSheet`, `AutocompleteSelect`, `WorkshopFavoriteToggle`, `SystemChangelogModal`, notatki wewnętrzne klienta.

---

## 8. Tabele Supabase (skrót)

M.in.: `profiles`, `admin_users`, `workshops`, `workshop_leads`, `workshop_services`, `workshop_availability_exceptions`, `bookings`, `booking_quotes`, `cars`, `service_requests`, `internal_messages`, `user_notifications`, `support_reports`, `user_favorite_workshops`, `workshop_photos`, `user_calendar_events`, `workshop_servygo_reviews`, `user_consents`, `client_internal_notes`, tabele / pola analityki, rozliczenia leadów MVP. Szczegóły: nagłówki w `supabase/sql/` i **`SUPABASE_SQL_INSTRUKCJA.md`**.

---

## 9. Co wygląda na gotowe

Publiczna lista i karta warsztatu, rezerwacje (RLS + RPC), wyceny, reschedule, realtime, panel właściciela i admina (szeroki zakres), ulubione, zdjęcia, kalendarz użytkownika, powiadomienia, cron przypomnień, i18n, podstawowe SEO na głównych stronach.

---

## 10. Niedokończone / wrażliwe

- E-mail: `sendBookingNotificationEmail`, `sendBookingReminderEmail` — TODO / log zamiast pełnej produkcji.
- SEO: TODO na landingach usługowych (Bielsko).
- `/make-me-admin` — nie na produkcję bez blokady.
- `SQL_DLA_SUPABASE.sql` — przestarzały vs `supabase/sql/`.
- Środowiska bez pełnego zestawu migracji SQL — część RPC może być opcjonalna (komentarze w kodzie).

---

## 11. Pliki do obejrzenia w pierwszej kolejności

1. `SUPABASE_SQL_INSTRUKCJA.md` + `supabase/sql/supabase-03-workshops.sql`, `07-bookings.sql`, `15-workshop-owner-access.sql`, `48-booking-quotes-model.sql`
2. `lib/supabaseClient.ts`, `lib/supabaseAdmin.ts`, `lib/serverAdminAuth.ts`
3. `lib/publicWorkshopsFromDb.ts`, `lib/cachedPublicWorkshop.ts`
4. `app/HomePageClient.tsx`, `app/oferty/OffersPageClient.tsx`
5. `app/warsztat/[id]/WorkshopDetailsClient.tsx`
6. `app/workshop-panel/page.tsx` (duży — sekcje, `hasWorkshopPanelAccess`)
7. `lib/workshopOwnerApi.ts`, `lib/adminApi.ts`, `app/admin/page.tsx` (początek + `verifyAccess`)
8. `lib/messagesApi.ts`, `components/InternalInbox.tsx`, `lib/useServyGoRealtime.ts`
9. `app/api/admin/approve-workshop-lead/route.ts` (+ resend access)
10. `lib/translations.ts`

---

*Aktualizuj ten plik przy większych zmianach architektury lub routingu.*
