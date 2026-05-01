# Local Preview (Desktop + Mobile)

Ten dokument opisuje szybki workflow podglądu UI ServyGo lokalnie podczas pracy w Cursorze.

## 1) Uruchomienie lokalne

W katalogu `servygo-app` uruchom:

```bash
npm run dev
```

Następnie otwórz:

- `http://localhost:3000`

Dev server zostaw uruchomiony podczas pracy nad UI.

## 2) Podgląd w Cursorze (desktop + mobile)

Jeśli masz dostępny Browser/Preview w Cursorze:

- Otwórz podgląd dla `http://localhost:3000` jako **Desktop**.
- Otwórz drugi podgląd tej samej strony jako **Mobile**.
- Ustaw układ obok siebie (split), żeby widzieć oba warianty równolegle.

Praktyczny układ:

- Lewo: desktop (szeroki viewport)
- Prawo: mobile (wąski viewport)

## 3) Alternatywa: Chrome DevTools (najpewniejsza)

Gdy w Cursor Preview nie da się wygodnie zmieniać rozmiaru:

1. Otwórz `http://localhost:3000` w Chrome.
2. Otwórz DevTools (`F12` albo PPM -> Zbadaj).
3. Włącz tryb urządzenia: `Ctrl+Shift+M`.
4. Wybierz preset (np. iPhone, Samsung) lub `Responsive`.
5. Przełączaj szybko między:
   - desktop (Device Toolbar OFF),
   - mobile (Device Toolbar ON).

## 4) Szybkie testowanie responsywności po zmianach UI

Po każdej większej zmianie wizualnej sprawdź:

- `header` (układ, sticky, brak nakładania elementów)
- `hero` (czytelność tekstu, ilustracja, odstępy)
- `formularz` (kolumny desktop/mobile, odstępy, CTA)
- `dropdowny` (otwieranie, scroll na mobile, z-index)
- `menu użytkownika` (desktop dropdown + mobile bottom sheet)
- `modale` (widoczność, overflow, brak ucięć)
- brak poziomego scrolla na mobile

## 5) Minimalny smoke test (Desktop + Mobile)

### Desktop

- Otwórz `http://localhost:3000`
- Sprawdź, czy sekcje wykorzystują szerokość layoutu
- Otwórz dropdown użytkownika i dropdowny formularza
- Sprawdź hover na kartach i przyciskach

### Mobile

- Włącz tryb urządzenia (`Ctrl+Shift+M`)
- Sprawdź, czy formularz jest w jednej kolumnie
- Sprawdź przewijanie list w dropdownach
- Potwierdź brak poziomego scrolla
- Otwórz menu i modale, sprawdź czy nie wychodzą poza ekran

## 6) Wskazówki workflow

- Trzymaj stale uruchomione `npm run dev`.
- Po każdej zmianie stylu odśwież desktop + mobile.
- Grupuj poprawki (np. hero, formularz, karty) i testuj partiami.
- Jeśli coś wygląda inaczej niż oczekiwano, sprawdź najpierw:
  - klasy `max-w-*`,
  - `px-*`,
  - `overflow-x-hidden`,
  - `z-index`.
