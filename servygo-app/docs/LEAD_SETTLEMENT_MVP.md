# Rozliczenie leadów — MVP (ServyGo)

Krótka dokumentacja warstwy rozliczeniowej leadów bez płatności online i bez faktur.

## Kiedy lead jest płatny (rozliczalny)

W modelu MVP lead staje się **rozliczalny** (`settlement_status = billable`), gdy jednocześnie:

- rezerwacja została **zakończona** przez warsztat (`bookings.status = completed`),
- powiązany rekord rozliczenia ma **`test_mode = false`** (koniec okresu testowego / produkcja),
- brak ścieżki „niepłatny” (anulowanie, no-show, spór itd.).

Do momentu wyłączenia trybu testowego domyślnie obowiązuje **`waived_test`**: lead jest **wartościowy**, ale **bez opłaty** — system pokazuje wartość (`lead_fee_amount`, zwykle 5 PLN) w raporcie.

## Kiedy lead nie jest płatny

Status rozliczenia **`not_billable`** między innymi gdy:

- warsztat **nie odpowiedział** / rezerwacja wygasła (status końcowy anulowania),
- warsztat **odrzucił** rezerwację,
- **klient anulował**,
- **klient odrzucił wycenę** (ścieżki kończące rezerwację),
- klient **nie przyjechał** — akcja **no-show** (`bookings.status = no_show`, powód `not_eligible_reason = no_show`),
- sprawa jest **sporna** (`disputed`) — do wyjaśnienia; nie jest traktowana jako rozliczalna w sensie opłaty.

Automatycznie, dla rekordów w stanie **`pending`**, przy przejściu rezerwacji w wybrane statusy końcowe (anulowanie, odrzucenie, `service_not_completed`) ustawiane jest **`not_billable`** (jeśli wcześniej nie było rozliczenia pozytywnego).

## Znaczenie `waived_test`

**`waived_test`** = lead spełnia warunki wartościowej wizyty (zakończona), ale **w okresie testowym** **nie naliczamy opłaty** — pokazujemy **wartość testową** (np. 5 PLN) w panelu i w raporcie (`test_value_pln`).

## Pierwszy miesiąc testowy

Domyślnie **`test_mode = true`** dla nowych rekordów rozliczenia. **Wyłączenie testu** (np. po pierwszym miesiącu) to osobna decyzja biznesowa — w tej iteracji **nie** dodano harmonogramu automatycznego; po zmianie `test_mode` na `false` kolejne zakończone wizyty dostają **`billable`** zamiast **`waived_test`**.

## Statusy `settlement_status`

| Status         | Znaczenie |
|----------------|-----------|
| `pending`      | Jeszcze nie wiadomo, czy lead będzie płatny. |
| `billable`     | Rozliczalny (produkcja, `test_mode = false`). |
| `not_billable` | Nie do rozliczenia / niepłatny. |
| `disputed`     | Spór — wymaga decyzji (poza zakresem MVP). |
| `invoiced`     | Zarezerwowane pod przyszłe faktury / zestawienia. |
| `waived_test`  | Wartościowy lead w teście — wartość liczona, opłata zdjęta. |

## Jak admin czyta raport „Rozliczenie leadów MVP”

W panelu admina (**Rozliczenie leadów MVP**) widać **zbiorczo per warsztat i miesiąc**:

- liczby rezerwacji i statusów wizyt (potwierdzone, zakończone, no-show, anulowane),
- liczbę leadów testowych (`waived_test`) i płatnych (`billable`),
- spory (`disputed`),
- **wartość testową PLN** (`test_value_pln`) oraz **szacowaną kwotę do zapłaty PLN** (`estimated_amount_pln` dla `billable`).

**Uwaga:** widok agreguje po miesiącu z dat powiązanych z rezerwacją lub zdarzeniami rozliczenia — szczegóły w migracji SQL `supabase-49-lead-settlement-mvp.sql`.

## RPC (Supabase)

- `ensure_booking_lead_settlement(booking_id)` — utwórz rekord rozliczenia, jeśli brak.
- `mark_booking_visit_completed(booking_id)` — zakończ wizytę, ustaw settlement (`waived_test` lub `billable`), komunikat systemowy do klienta.
- `mark_booking_no_show(booking_id, reason)` — no-show, settlement `not_billable`.
- `mark_booking_settlement_disputed(booking_id, reason)` — spór.

Admin nadzoruje przez **`admin_users`** (role `admin` / `owner`) — ten sam wzorzec co w innych tabelach.
