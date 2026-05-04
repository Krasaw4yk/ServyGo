# Rozliczenie leadów — MVP (ServyGo)

Krótka dokumentacja warstwy rozliczeniowej leadów bez płatności online i bez faktur.

## Definicje biznesowe (skrót)

- **Lead**: rezerwacja (`bookings`) widziana jako potencjalny przychód/korzyść dla warsztatu, rozliczana przez ServyGo z warsztatem.
- **Lead wartościowy**: wizyta się odbyła i została oznaczona jako zakończona (`mark_booking_visit_completed`).
- **Lead testowy**: wartościowy lead w okresie testowym (bez opłaty), raportowany jako `waived_test`.
- **Lead płatny**: wartościowy lead poza testem, raportowany jako `billable`.

## Mapowanie statusów (techniczne → biznesowe)

### `bookings.status`

- **`pending_quote` / `awaiting_quote` / `new` / `pending`**: klient utworzył rezerwację, warsztat jeszcze nie doprowadził jej do potwierdzenia.
- **`quote_sent`**: warsztat wysłał wycenę; klient ma podjąć decyzję.
- **`awaiting_new_quote`**: klient odrzucił wycenę; warsztat może wysłać kolejną.
- **`confirmed`**: termin jest potwierdzony (warsztat potwierdził lub klient zaakceptował wycenę).
- **`completed` / `done`**: wizyta została wykonana i zakończona (lead wartościowy).
- **`no_show`**: klient nie stawił się na wizytę (lead niepłatny).
- **`cancelled` / `cancelled_by_*`**: anulowanie (lead niepłatny).
- **`rejected`**: odrzucone przez warsztat/proces (lead niepłatny).
- **`service_not_completed`**: usługa niewykonana / problem (lead niepłatny lub sporny zależnie od decyzji admina).

### `booking_quotes.status`

- **`active`**: obowiązująca (aktualna) wycena.
- **`replaced`**: zastąpiona kolejną wyceną.
- **`accepted`**: zaakceptowana przez klienta (rezerwacja zwykle przechodzi w `confirmed`).
- **`rejected`**: odrzucona przez klienta.
- **`cancelled`**: anulowana (np. anulowanie rezerwacji, wygaśnięcie, itp.).

### `booking_lead_settlements.settlement_status`

- **`pending`**: jeszcze nie wiadomo, czy lead będzie płatny (rezerwacja w toku).
- **`waived_test`**: lead wartościowy w teście — liczony informacyjnie, bez opłaty.
- **`billable`**: lead wartościowy poza testem — rozliczalny.
- **`not_billable`**: lead niepłatny (no-show, anulowanie, odrzucenie, itd.).
- **`disputed`**: lead sporny — do rozstrzygnięcia przez admina.
- **`invoiced`**: zarezerwowane pod przyszłe rozliczenie/fakturę (poza MVP faktur).

## Kiedy przechodzimy do konkretnych settlement_status

- **`pending`**: automatycznie przy utworzeniu rezerwacji (trigger) lub pierwszym RPC (ensure).
- **`waived_test`**: `mark_booking_visit_completed`, gdy settlement ma `test_mode = true` (w praktyce: warsztat ma `workshops.lead_test_mode = true` i nowe settlementy dziedziczą to ustawienie).
- **`billable`**: `mark_booking_visit_completed`, gdy settlement ma `test_mode = false`.
- **`not_billable`**:
  - `mark_booking_no_show` → `not_eligible_reason = 'no_show'`.
  - automatycznie dla settlementów `pending`, gdy rezerwacja przechodzi w status końcowy typu anulowanie/odrzucenie (`cancelled*`, `rejected`, `service_not_completed`, `quote_rejected` — wg triggera).
- **`disputed`**: `mark_booking_settlement_disputed` (warsztat lub admin) + powód.
- **`invoiced`**: tylko przyszłościowo (w MVP nie generujemy faktur) — może być użyte ręcznie przez admina w kolejnych iteracjach.

## Checklist testu ręcznego (A–F)

A. rezerwacja utworzona → settlement `pending`

B. wycena zaakceptowana / wizyta potwierdzona → settlement nadal `pending`

C. wizyta zakończona w okresie testowym → settlement `waived_test`

D. wizyta zakończona poza testem → settlement `billable`

E. klient nie przyszedł → settlement `not_billable`

F. spór → settlement `disputed`

## Raport miesięczny

Widok `workshop_monthly_lead_metrics` pokazuje per warsztat/miesiąc:

- `test_value_pln` = wartość informacyjna leadów testowych (`waived_test`)
- `estimated_amount_pln` = kwota do zapłaty (tylko leady `billable`)

## RPC (Supabase)

- `ensure_booking_lead_settlement(booking_id)` — utwórz rekord rozliczenia, jeśli brak.
- `mark_booking_visit_completed(booking_id)` — zakończ wizytę, ustaw settlement (`waived_test` lub `billable`), wpis do `booking_status_events`, komunikat systemowy.
- `mark_booking_no_show(booking_id, reason)` — no-show, settlement `not_billable`, wpis do `booking_status_events`, komunikat systemowy.
- `mark_booking_settlement_disputed(booking_id, reason)` — spór, wpis do `booking_status_events`, komunikat systemowy.
- `admin_set_workshop_lead_billing_settings(workshop_id, lead_test_mode, lead_fee_amount)` — admin: kończy test i/lub ustawia stawkę dla nowych leadów warsztatu.

## Kryteria zamknięcia punktu 4

- Istnieje definicja płatnego leada (billable) i testowego (waived_test).
- Każdy status rezerwacji ma znaczenie biznesowe (mapowanie powyżej).
- Każdy status wyceny ma znaczenie biznesowe (mapowanie powyżej).
- Każdy status settlement ma znaczenie biznesowe (mapowanie powyżej).
- Admin widzi rozliczenia i raport miesięczny.
- Warsztat widzi własne rozliczenia i raport miesięczny.
- Można oznaczyć `completed`, `no_show`, `disputed`.
- Admin może zakończyć test dla warsztatu (wpływa na nowe settlementy).
- Można policzyć miesięczny raport oraz wyeksportować go do CSV (MVP).
