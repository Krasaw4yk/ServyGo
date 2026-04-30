# Testy Etapy 1-5 + Dodatki Etap 6

Ten plik jest prostym notatnikiem testowym do odklikania recznie.
Cel: miec w jednym miejscu wszystkie testy po zmianach Etap 1-5 oraz liste dodatkow z Etapu 6.

---

## Jak korzystac z tego notatnika

- Kazdy test ma:
  - **Co testujemy**
  - **Dlaczego to testujemy**
  - **Kroki testowe**
  - **Oczekiwany wynik**
  - **Status** (uzupelnij: `OK` / `NOK` / `DO POPRAWY`)
- Testuj najlepiej na 3 kontach:
  - klient
  - wlasciciel warsztatu
  - admin
- Przy `NOK` dopisz blad i miejsce (np. `workshop-panel`, `internal_messages`, `RPC`).

---

## Etap 1 - Nowy flow rezerwacji i wyceny

### 1.1 Tworzenie rezerwacji jako `awaiting_quote`
- **Co testujemy:** klient po wyborze terminu tworzy booking ze statusem oczekiwania na wycene.
- **Dlaczego:** to fundament nowego procesu (nie od razu `confirmed`).
- **Kroki:**
  1. Zaloguj sie jako klient.
  2. Wejdz w warsztat i wybierz usluge + termin.
  3. Potwierdz rezerwacje.
- **Oczekiwany wynik:**
  - booking ma status `awaiting_quote`
  - ustawione `quote_expires_at` (ok. 5h od utworzenia)
  - wyslane wiadomosci systemowe (do klienta i warsztatu)
- **Status:** [ ]

### 1.2 Blokada slotu po utworzeniu rezerwacji
- **Co testujemy:** zajety termin nie moze byc wybrany przez innego klienta.
- **Dlaczego:** unikamy podwojnych rezerwacji.
- **Kroki:**
  1. Klient A tworzy booking na konkretny slot.
  2. Klient B probuje ten sam slot.
- **Oczekiwany wynik:** slot niedostepny lub blad kolizji (`SLOT_CONFLICT` / brak godziny na liscie).
- **Status:** [ ]

### 1.3 Wysylka wyceny przez warsztat
- **Co testujemy:** warsztat wpisuje cene i wysyla wycene.
- **Dlaczego:** kluczowy moment procesu handlowego.
- **Kroki:**
  1. Zaloguj sie jako warsztat.
  2. Otworz rezerwacje `awaiting_quote`.
  3. Wpisz cene i kliknij "Wyslij wycene".
- **Oczekiwany wynik:**
  - status `quote_sent`
  - zapisane `final_price`, `quote_sent_at`
  - klient dostaje wiadomosc systemowa + email
- **Status:** [ ]

### 1.4 Nadpisanie poprzedniej wyceny
- **Co testujemy:** kolejna wycena zastępuje poprzednia.
- **Dlaczego:** ma liczyc sie zawsze ostatnia oferta.
- **Kroki:**
  1. Wyslij wycene 1.
  2. Wyslij wycene 2 dla tej samej rezerwacji.
- **Oczekiwany wynik:** booking ma dane z wyceny 2 (`final_price`, `quote_sent_at`).
- **Status:** [ ]

### 1.5 Akceptacja wyceny przez klienta
- **Co testujemy:** przycisk "Akceptuje wycene" w skrzynce klienta.
- **Dlaczego:** finalizacja procesu do potwierdzenia terminu.
- **Kroki:**
  1. Klient otwiera wiadomosc typu wycena.
  2. Kliknij "Akceptuje wycene".
- **Oczekiwany wynik:**
  - status `confirmed` (przez `respond_booking_quote`)
  - warsztat dostaje wiadomosc systemowa + email
- **Status:** [ ]

### 1.6 Odrzucenie wyceny przez klienta
- **Co testujemy:** przycisk "Odrzucam wycene".
- **Dlaczego:** klient musi miec mozliwosc negocjacji/odrzucenia.
- **Kroki:**
  1. Klient otwiera wiadomosc wyceny.
  2. Kliknij "Odrzucam wycene".
- **Oczekiwany wynik:**
  - status `quote_rejected`
  - slot zwolniony (ponownie widoczny w dostepnych terminach)
  - warsztat dostaje powiadomienie
- **Status:** [ ]

### 1.7 Anulowanie przez klienta i warsztat
- **Co testujemy:** oba kierunki anulacji + wymagany powod.
- **Dlaczego:** audit i komunikacja operacyjna.
- **Kroki:**
  1. Klient anuluje booking z powodem.
  2. W osobnym przypadku warsztat anuluje booking z powodem.
- **Oczekiwany wynik:**
  - status odpowiednio `cancelled_by_client` / `cancelled_by_workshop`
  - `cancel_reason` zapisany
  - druga strona dostaje wiadomosc i (jesli skonfigurowane) email
- **Status:** [ ]

### 1.8 Wygasanie wycen (timeout)
- **Co testujemy:** automatyczne wygaszenie po `quote_expires_at`.
- **Dlaczego:** nie trzymamy wiecznie zablokowanych slotow.
- **Kroki:**
  1. Ustaw testowo booking z przeszlym `quote_expires_at`.
  2. Uruchom funkcje `expire_booking_quotes()`.
- **Oczekiwany wynik:**
  - status `cancelled_by_system`
  - slot zwolniony
- **Status:** [ ]

---

## Etap 2 - System wiadomosci i komunikacji

### 2.1 RLS: odczyt tylko uczestnik rozmowy
- **Co testujemy:** user widzi tylko swoje wiadomosci.
- **Dlaczego:** prywatnosc rozmow klient-warsztat.
- **Kroki:**
  1. Zaloguj sie jako klient A, wyslij/odbierz wiadomosc.
  2. Zaloguj sie jako klient B.
  3. Sprobuj odczytac wiadomosc klienta A.
- **Oczekiwany wynik:** brak dostepu.
- **Status:** [ ]

### 2.2 RLS: update tylko `is_read`
- **Co testujemy:** niemozliwa edycja tresci, nadawcy, odbiorcy.
- **Dlaczego:** integralnosc wiadomosci.
- **Kroki:**
  1. Sprobuj zmienic `body` przez update.
  2. Sprobuj zmienic `recipient_id`.
  3. Uzyj `mark_message_as_read`.
- **Oczekiwany wynik:**
  - 1 i 2 zablokowane
  - 3 dziala
- **Status:** [ ]

### 2.3 Wysylka tylko w kontekscie booking/request
- **Co testujemy:** brak mozliwosci przypadkowego spamu.
- **Dlaczego:** ograniczenie kontaktu poza procesem domenowym.
- **Kroki:**
  1. Sprobuj wyslac wiadomosc bez `related_booking_id` i bez `service_request_id`.
  2. Sprobuj wyslac z poprawnym `related_booking_id`.
- **Oczekiwany wynik:**
  - 1 odrzucone przez RLS
  - 2 poprawne
- **Status:** [ ]

### 2.4 Watki rozmow
- **Co testujemy:** grupowanie wiadomosci po `related_booking_id` / `service_request_id`.
- **Dlaczego:** czytelna historia rozmowy.
- **Kroki:**
  1. Wyslij kilka wiadomosci dla tej samej rezerwacji.
  2. Otworz skrzynke.
- **Oczekiwany wynik:** jedna rozmowa/watek, wiadomosci w kolejnosci.
- **Status:** [ ]

### 2.5 Przeczytane / nieprzeczytane
- **Co testujemy:** badge i status po otwarciu wiadomosci.
- **Dlaczego:** UX i operacyjne SLA.
- **Kroki:**
  1. Odbierz nowa wiadomosc.
  2. Sprawdz licznik nieprzeczytanych.
  3. Otworz wiadomosc.
- **Oczekiwany wynik:** `is_read = true`, badge maleje.
- **Status:** [ ]

### 2.6 Powiadomienia email
- **Co testujemy:** email po kluczowych akcjach.
- **Dlaczego:** user moze nie byc online.
- **Kroki:**
  1. Warsztat wysyla wycene.
  2. Klient akceptuje/odrzuca.
  3. Klient/warsztat anuluje.
- **Oczekiwany wynik:** email trafia do drugiej strony (przy poprawnej konfiguracji `RESEND_*`).
- **Status:** [ ]

---

## Etap 3 - Kalendarz i dostepnosc

### 3.1 Slot lock dla `awaiting_quote` i `quote_sent`
- **Co testujemy:** te statusy blokuja termin jak `confirmed`.
- **Dlaczego:** brak dubli w kalendarzu.
- **Kroki:**
  1. Utworz booking `awaiting_quote`.
  2. Sprawdz dostepnosc slotu u innych klientow.
  3. Wyslij wycene (`quote_sent`) i sprawdz ponownie.
- **Oczekiwany wynik:** slot nadal zablokowany.
- **Status:** [ ]

### 3.2 Zwolnienie slotu po odrzuceniu/anulacji/wygasnieciu
- **Co testujemy:** poprawne zwalnianie kalendarza.
- **Dlaczego:** efektywne wykorzystanie terminow.
- **Kroki:** odrzuc, anuluj, wygas timeout i sprawdz dostepnosc.
- **Oczekiwany wynik:** slot wraca na liste dostepnych.
- **Status:** [ ]

### 3.3 Godziny pracy warsztatu
- **Co testujemy:** brak rezerwacji poza `opening_hours`.
- **Dlaczego:** ochrona przed blednymi terminami.
- **Kroki:**
  1. Ustaw godziny np. 08:00-16:00.
  2. Sprobuj zarezerwowac 16:30.
- **Oczekiwany wynik:** odrzucenie (`OUTSIDE_OPENING_HOURS`) lub brak slotu.
- **Status:** [ ]

### 3.4 Propozycja zmiany terminu
- **Co testujemy:** warsztat -> klient (propozycja), klient -> decyzja.
- **Dlaczego:** realny scenariusz przesuniecia wizyty.
- **Kroki:**
  1. Warsztat wysyla nowa propozycje terminu.
  2. Klient akceptuje.
  3. Powtorz i klient odrzuca.
- **Oczekiwany wynik:**
  - przy akceptacji: booking aktualizuje date/godzine i status `confirmed`
  - przy odrzuceniu: wraca poprzedni status
- **Status:** [ ]

### 3.5 Kalendarz klienta
- **Co testujemy:** podstrona `Moje konto / Kalendarz`.
- **Dlaczego:** klient widzi przyszle wizyty i statusy.
- **Kroki:**
  1. Otworz kalendarz klienta.
  2. Zweryfikuj statusy i kolory.
- **Oczekiwany wynik:** kolory zgodne z zalozeniami:
  - szary `awaiting_quote`
  - pomarancz `quote_sent`
  - zielony `confirmed`
  - czerwony `cancelled*` / `quote_rejected`
- **Status:** [ ]

### 3.6 Kalendarz warsztatu
- **Co testujemy:** widok kalendarza i podsumowania.
- **Dlaczego:** operacyjne planowanie pracy.
- **Kroki:**
  1. Otworz `workshop-panel -> Kalendarz / dostepnosc`.
  2. Sprawdz podsumowania dzienne/tygodniowe i najblizsze rezerwacje.
- **Oczekiwany wynik:** dane sa spojne z bookings.
- **Status:** [ ]

---

## Etap 4 - Uslugi i ceny

### 4.1 Widełki cen w ofercie publicznej
- **Co testujemy:** pokazywanie `price_from-price_to` zamiast jednej ceny finalnej.
- **Dlaczego:** finalna cena jest po wycenie warsztatu.
- **Kroki:**
  1. Otworz `oferty`.
  2. Otworz szczegoly warsztatu.
- **Oczekiwany wynik:** wszedzie widac zakres lub "od X", nie obietnice ceny finalnej.
- **Status:** [ ]

### 4.2 Brak automatycznego `service_requests` przy samym wyszukiwaniu
- **Co testujemy:** samo szukanie ofert nie tworzy rekordow lead/request.
- **Dlaczego:** ograniczenie smieciowych rekordow i poprawna semantyka flow.
- **Kroki:**
  1. Wykonaj kilka wyszukiwan.
  2. Sprawdz czy przybylo rekordow `service_requests`.
- **Oczekiwany wynik:** brak nowych rekordow od samego search.
- **Status:** [ ]

---

## Etap 5 - Role i dostep

### 5.1 Centralny resolver roli
- **Co testujemy:** `resolveMessageViewerContext` jako glowny punkt okreslania roli.
- **Dlaczego:** brak rozjazdow miedzy guardami.
- **Kroki:**
  1. Wejdz jako klient, warsztat, admin.
  2. Sprawdz przekierowania i dostep do paneli.
- **Oczekiwany wynik:**
  - admin -> admin
  - workshop (aktywny) -> workshop-panel
  - klient -> moje-konto
- **Status:** [ ]

### 5.2 Guard panelu warsztatu
- **Co testujemy:** tylko wlasciciel aktywnego warsztatu ma dostep.
- **Dlaczego:** ochrona panelu operacyjnego.
- **Kroki:**
  1. Zaloguj klienta i otworz `/workshop-panel`.
  2. Zaloguj warsztat i otworz `/workshop-panel`.
- **Oczekiwany wynik:** klient odrzucony, warsztat wpuszczony.
- **Status:** [ ]

### 5.3 Guard panelu admina
- **Co testujemy:** tylko admin ma dostep do `/admin`.
- **Dlaczego:** dane i operacje krytyczne.
- **Kroki:**
  1. Klient/warsztat probuje wejsc na `/admin`.
  2. Admin wchodzi na `/admin`.
- **Oczekiwany wynik:** tylko admin ma dostep.
- **Status:** [ ]

### 5.4 Admin preview panelu warsztatu
- **Co testujemy:** admin moze podejrzec panel warsztatu w trybie read-only.
- **Dlaczego:** wsparcie i diagnostyka bez ryzyka edycji.
- **Kroki:**
  1. Admin wejdzie przez preview.
  2. Sprawdz, czy akcje edycyjne sa nieaktywne.
- **Oczekiwany wynik:** podglad dziala, modyfikacje zablokowane.
- **Status:** [ ]

### 5.5 Dostep do `/ustawienia` dla kazdego zalogowanego
- **Co testujemy:** klient/warsztat/admin.
- **Dlaczego:** wspolne ustawienia konta.
- **Kroki:** zaloguj sie kazda rola i otworz `/ustawienia`.
- **Oczekiwany wynik:** kazda zalogowana rola ma dostep.
- **Status:** [ ]

---

## Testy regresji po Etapach 1-5

### R1. Rejestracja i logowanie
- **Po co:** upewnic sie, ze nowe guardy nie psuja auth flow.
- **Status:** [ ]

### R2. Admin: akceptacja warsztatu / listy admina
- **Po co:** sprawdzic, czy zmiany w wiadomosciach i rolach nie popsuly admin panelu.
- **Status:** [ ]

### R3. Workshop panel: uslugi, pracownicy, dostepnosc
- **Po co:** sprawdzic, czy read-only preview i nowe booking flow nie popsuly starej funkcji panelu.
- **Status:** [ ]

### R4. Inbox: wysylka, odczyt, watki, odpowiedzi
- **Po co:** potwierdzenie integralnosci komunikacji.
- **Status:** [ ]

### R5. Build i TypeScript
- **Po co:** pewnosc deployowalnosci.
- **Kroki:** `npx tsc --noEmit`, `npm run build`
- **Status:** [ ]

---

## Etap 6 - Dodatki na przyszlosc (backlog)

To sa rzeczy celowo odlozone:

1. **Google / OAuth login**
   - dodac pelny flow OAuth i mapowanie profili.
2. **VIN API / katalog czesci**
   - integracja z zewnetrznym API to osobny duzy projekt.
3. **Zalaczniki w wiadomosciach**
   - zdjecia auta, dokumenty, faktury.
4. **Platnosci online**
   - osobny strumien prac: checkout, webhooki, statusy platnosci, refundy.

---

## Notatki koncowe

- Przy kazdym `NOK` dopisz:
  - etap i numer testu
  - co dokladnie nie dziala
  - konto (rola), na ktorym testowales
  - timestamp i ewentualny screenshot
- Po przejsciu wszystkich punktow oznacz:
  - `Gotowe do PR/MR`: [ ]

