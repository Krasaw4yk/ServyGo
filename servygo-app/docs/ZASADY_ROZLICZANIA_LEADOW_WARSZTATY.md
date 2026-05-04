## Zasady rozliczania leadów (dla warsztatów) — MVP ServyGo

Ten dokument opisuje prostym językiem, jak działa rozliczanie leadów w ServyGo na etapie MVP.

### Najważniejsze założenia

- **Klient płaci za usługę bezpośrednio w warsztacie.** ServyGo na tym etapie **nie pobiera pieniędzy od klienta**.
- **ServyGo nie jest stroną usługi naprawy** (nie wykonuje usługi i nie odpowiada za jej przebieg). ServyGo dostarcza platformę do umawiania wizyt.
- Model startowy ServyGo to **rozliczenie leadowe z warsztatem** (rozliczamy wartość doprowadzonych wizyt).

---

### Czym jest „lead” w ServyGo

W ServyGo **lead** to **rezerwacja wizyty** złożona przez klienta, która trafia do warsztatu.

Lead może skończyć się różnie:
- może zostać anulowany lub odrzucony (wtedy jest niepłatny),
- może zostać potwierdzony i zakończony (wtedy jest wartościowy),
- może zostać oznaczony jako no-show (niepłatny),
- może być sporny (wymaga decyzji administratora).

---

### Lead testowy (okres testowy)

Na początku warsztat jest w **okresie testowym**:
- **koszt w teście wynosi 0 zł**, nawet jeśli lead jest wartościowy,
- wartościowe leady są **liczone informacyjnie** (żeby po miesiącu pokazać realny raport),
- w raporcie zobaczysz, ile leadów było wartościowych i jaka byłaby ich „wartość” przy stawce (np. 5 zł).

---

### Lead płatny / wartościowy

Lead jest **wartościowy** (a po zakończeniu testu także **płatny**), jeśli spełnione są warunki:

- klient zrobił rezerwację,
- warsztat potwierdził wizytę **albo** klient zaakceptował wycenę,
- klient przyjechał,
- usługa została wykonana,
- wizyta została oznaczona jako zakończona,
- nie ma sporu.

W praktyce w aplikacji jest to moment, gdy warsztat używa akcji **„Oznacz jako zakończone”**.

**Przykładowa stawka po teście:** 5 zł za zakończony wartościowy lead.

---

### Kiedy lead jest niepłatny

Lead jest **niepłatny**, gdy np.:

- warsztat nie odpowiedział w wymaganym czasie,
- warsztat odrzucił rezerwację,
- klient odrzucił wycenę,
- klient anulował rezerwację,
- klient nie przyjechał (no-show),
- usługa nie została wykonana,
- zgłoszenie było błędne / spamowe,
- sprawa została uznana za niekwalifikującą się do rozliczenia.

W aplikacji no-show oznaczasz akcją **„Klient nie przyjechał”** (dostępną po upływie terminu wizyty).

---

### Lead sporny

Lead jest **sporny**, gdy:
- warsztat albo administrator zgłasza problem z leadem,
- np. klient nie przyjechał, dane były błędne, usługa się nie odbyła, klient odwołał wizytę poza systemem,
  albo klient i warsztat mają sprzeczne wersje zdarzeń.

W sporze:
- warsztat może kliknąć **„Zgłoś spór”** i opisać powód,
- administrator sprawdza sprawę i podejmuje decyzję.

---

### Jak działa pierwszy miesiąc testowy

1. W okresie testowym warsztat otrzymuje leady jak normalnie.
2. Wartościowe leady są oznaczane jako „testowe” (bez opłaty), ale **ich wartość jest liczona**.
3. Po miesiącu warsztat dostaje raport:
   - ile było leadów wartościowych,
   - ile anulowanych / no-show,
   - jaka byłaby kwota do zapłaty poza testem.

Po zakończeniu testu nowe zakończone wizyty mogą być rozliczane jako płatne.

---

### Raport miesięczny — co pokazuje

Raport miesięczny pokazuje m.in.:
- ile było wszystkich rezerwacji,
- ile potwierdzonych, zakończonych, no-show i anulowanych,
- ile leadów testowych i płatnych,
- ile sporów,
- **wartość testową** (ile leady byłyby warte poza testem),
- **kwotę do zapłaty** (tylko leady płatne).

---

### Kiedy warsztat potencjalnie zapłaci po zakończeniu testu

Po zakończeniu okresu testowego:
- nowe **zakończone** wizyty (wartościowe leady) mogą być oznaczane jako **płatne**,
- miesięczny raport pokaże „kwotę do zapłaty” według ustalonej stawki.

W MVP ServyGo:
- nie ma jeszcze automatycznych faktur,
- nie ma płatności online,
- rozliczenie odbywa się na podstawie raportu i kontaktu z administratorem.

