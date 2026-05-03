/**
 * Treść regulaminu ServyGo (PL), wersja 1.0 — ustrukturyzowana pod czytelność i numerację podpunktów.
 * Kolory tekstu zależą od `isDark` (Tailwind `dark:` nie jest ustawiany globalnie na tej stronie).
 */

import { getLegalDocTypography } from "./legalDocumentTypography";

export function ServygoRegulaminDocument({ isDark }: { isDark: boolean }) {
  const { h2Class, pClass, olClass, introClass, wrapClass, mailLinkClass } = getLegalDocTypography(isDark);

  return (
    <div className={wrapClass}>
      <p className={introClass}>
        Niniejszy Regulamin określa zasady korzystania z serwisu internetowego ServyGo dostępnego pod adresem servygo.pl oraz innych adresów
        należących do właściciela serwisu.
      </p>
      <p className={pClass}>
        Regulamin został sporządzony w oparciu o obowiązujące przepisy prawa, w tym w szczególności ustawę z 18 lipca 2002 r. o świadczeniu usług
        drogą elektroniczną, ustawę z 30 maja 2014 r. o prawach konsumenta i Kodeks cywilny.
      </p>

      <h2 className={h2Class}>§ 1. Definicje</h2>
      <ol className={olClass}>
        <li>
          <strong>Serwis</strong> – internetowa platforma ServyGo, której główną funkcją jest pośredniczenie pomiędzy kierowcami poszukującymi
          usług motoryzacyjnych a warsztatami oferującymi takie usługi. Serwis umożliwia porównanie orientacyjnych cen i terminów, rezerwację
          wizyty oraz wymianę informacji pomiędzy użytkownikami. Wersja mobilna stanowi integralną część Serwisu.
        </li>
        <li>
          <strong>Usługodawca</strong> – właściciel serwisu ServyGo: Kyrylo Veremieienko, prowadzący serwis w formie projektu testowego. Adres
          korespondencyjny: ul. Grażyny 11/24, 43-330 Bielsko-Biała. Adres e-mail: servygoa@gmail.com. Usługodawca jest administratorem Serwisu i
          podmiotem świadczącym usługi drogą elektroniczną. Serwis ma charakter testowy, ale jest publicznie dostępny. Po uruchomieniu działalności
          gospodarczej w Polsce dane rejestrowe przedsiębiorcy (w tym nazwa, NIP, REGON) zostaną ujawnione w Regulaminie.
        </li>
        <li>
          <strong>Użytkownik</strong> – osoba korzystająca z Serwisu w jakikolwiek sposób. Do Użytkowników zalicza się w szczególności Kierowców,
          Warsztaty i Administratorów. Użytkownikiem może być wyłącznie osoba posiadająca zdolność do czynności prawnych umożliwiającą zawieranie
          umów (z reguły ukończone 18 lat) albo osoba działająca przez przedstawiciela ustawowego. Użytkownik może korzystać z Serwisu jako gość,
          jednak umówienie wizyty wymaga założenia Konta.
        </li>
        <li>
          <strong>Kierowca</strong> – Użytkownik będący osobą fizyczną, która poszukuje usługi motoryzacyjnej i korzysta z Serwisu w celu
          zapoznania się z ofertami warsztatów, porównania cen oraz umówienia wizyty. Kierowca posiada Konto kierowcy w Serwisie. Kierowca powinien
          podać prawdziwe dane pojazdu (marka, model, rocznik, paliwo), które są niezbędne do otrzymania poprawnej wyceny. Podanie numeru VIN jest
          dobrowolne, ale jego wskazanie pozwala warsztatowi przygotować dokładniejszą ofertę. W ramach rejestracji wymagane jest podanie co najmniej
          adresu e-mail, numeru telefonu, hasła oraz imienia. Nazwisko jest opcjonalne – użytkownik może używać pseudonimu lub inicjału. Użytkownik
          ma możliwość wyboru, czy w opiniach będzie prezentowane imię z pierwszą literą nazwiska, czy pseudonim.
        </li>
        <li>
          <strong>Warsztat</strong> – Użytkownik będący osobą fizyczną prowadzącą działalność gospodarczą albo osobą prawną, który oferuje usługi
          motoryzacyjne za pośrednictwem Serwisu. Warsztat po utworzeniu Konta warsztatu i jego zaakceptowaniu przez Administratora może określać
          ceny, terminy, dostępne usługi oraz publikować swoją lokalizację na mapie. Warsztat odpowiada za treść publikowanych informacji, jakość i
          zakres świadczonych usług oraz kontakt z Kierowcą.
        </li>
        <li>
          <strong>Administrator</strong> – uprawniony przedstawiciel Usługodawcy, który zarządza Serwisem, weryfikuje Warsztaty, decyduje o
          publikacji danych na mapie, udziela wsparcia Użytkownikom oraz może zawiesić lub usunąć Konto.
        </li>
        <li>
          <strong>Konto</strong> – zbiór zasobów w systemie teleinformatycznym Serwisu, oznaczony indywidualną nazwą (loginem) i hasłem, w którym
          gromadzone są dane podane przez Użytkownika oraz informacje o jego działaniach w Serwisie. Istnieją trzy główne typy Kont: Konto
          Kierowcy, Konto Warsztatu i Konto Administratora.
        </li>
        <li>
          <strong>Usługa</strong> – pojedyncza czynność motoryzacyjna, którą Warsztat oferuje Użytkownikowi (np. wymiana oleju, naprawa
          zawieszenia).
        </li>
        <li>
          <strong>Oferta</strong> – zestaw informacji przedstawionych przez Warsztat dotyczących orientacyjnej ceny „od – do”, dostępnych terminów
          realizacji usługi i innych warunków. Zamieszczone w Serwisie ceny mają charakter orientacyjny. Ostateczną cenę ustala Warsztat po
          weryfikacji danych pojazdu i zakresu usługi oraz przesyła Kierowcy wraz z ewentualnym komentarzem do akceptacji.
        </li>
        <li>
          <strong>Rezerwacja</strong> – zarezerwowanie przez Kierowcę w Serwisie terminu wizyty w Warsztacie. Rezerwacja następuje z chwilą
          wybrania dnia i godziny i jest tymczasowo blokowana na określony czas wskazany w Serwisie (w wersji testowej – 24 godziny). Warsztat ma
          określony czas wskazany w Serwisie na potwierdzenie rezerwacji lub zaproponowanie innego terminu. Obecnie w wersji testowej czas ten
          wynosi 24 godziny. Brak odpowiedzi Warsztatu w tym okresie skutkuje automatycznym anulowaniem Rezerwacji.
        </li>
        <li>
          <strong>Polityka prywatności</strong> – odrębny dokument określający zasady ochrony danych osobowych oraz wykorzystywania plików cookie,
          dostępny w Serwisie.
        </li>
        <li>
          <strong>Regulamin</strong> – niniejszy dokument.
        </li>
      </ol>

      <h2 className={h2Class}>§ 2. Postanowienia ogólne</h2>
      <p className={pClass}>
        Serwis działa na terytorium Rzeczypospolitej Polskiej. Obecnie jest w fazie testowej i obsługuje przede wszystkim miasto Bielsko-Biała i
        jego okolice. Użytkownik przyjmuje do wiadomości, że Serwis może być stopniowo rozwijany na inne regiony Polski.
      </p>
      <p className={pClass}>
        Korzystanie z Serwisu możliwe jest wyłącznie na zasadach i w zakresie określonym w Regulaminie. Poprzez korzystanie z Serwisu Użytkownik
        potwierdza zapoznanie się z treścią Regulaminu i akceptuje wszystkie jego postanowienia.
      </p>
      <p className={pClass}>Usługodawca świadczy usługi elektroniczne polegające na:</p>
      <ol className={olClass}>
        <li>umożliwieniu przeglądania stron internetowych Serwisu;</li>
        <li>prowadzeniu Konta Użytkownika (Kierowcy, Warsztatu lub Administratora);</li>
        <li>umożliwieniu publikacji ofert warsztatów;</li>
        <li>pośredniczeniu w rezerwacji wizyt pomiędzy Kierowcami a Warsztatami;</li>
        <li>przesyłaniu powiadomień systemowych (np. o rezerwacji, zmianie terminu lub statusu);</li>
        <li>udostępnieniu wewnętrznej skrzynki wiadomości w ramach Konta.</li>
      </ol>
      <p className={pClass}>
        Z chwilą aktywowania Konta pomiędzy Usługodawcą a Użytkownikiem zawierana jest umowa o świadczenie usług drogą elektroniczną. Umowa ta
        zostaje zawarta na czas nieokreślony i może zostać rozwiązana na zasadach określonych w Regulaminie.
      </p>
      <p className={pClass}>
        Korzystanie z Serwisu jest bezpłatne. Usługodawca zastrzega, że w przyszłości mogą zostać wprowadzone odpłatne funkcje (np. abonament dla
        warsztatów lub płatność za usługę). Użytkownicy zostaną poinformowani o takich zmianach z odpowiednim wyprzedzeniem, a korzystanie z płatnych
        funkcji będzie wymagało osobnej zgody.
      </p>
      <p className={pClass}>
        Serwis pełni rolę pośrednika. Ostateczna umowa świadczenia usług motoryzacyjnych zawierana jest pomiędzy Kierowcą a Warsztatem. Usługodawca
        nie jest stroną takiej umowy, nie odpowiada za jakość wykonania usługi, ceny, terminowość ani ewentualne szkody. Usługodawca przyjmuje i
        analizuje zgłoszenia problemów i opinii, lecz nie przeprowadza formalnej procedury reklamacyjnej w imieniu warsztatu.
      </p>
      <p className={pClass}>
        Usługodawca dokłada wszelkich starań, aby Serwis działał nieprzerwanie, jednak nie gwarantuje niezakłóconego dostępu ani braku błędów.
        Serwis może być czasowo wyłączony w celu modernizacji, konserwacji, aktualizacji, usunięcia awarii lub z innych ważnych powodów.
        Usługodawca poinformuje Użytkowników o planowanych przerwach technicznych z wyprzedzeniem, o ile będzie to możliwe.
      </p>
      <p className={pClass}>
        Usługodawca zastrzega sobie prawo do testowania nowych funkcji i zmiany sposobu działania Serwisu. Użytkownicy zostaną poinformowani o
        zmianach, jeśli będą one wpływały na zakres świadczonych usług.
      </p>

      <h2 className={h2Class}>§ 3. Warunki techniczne korzystania z Serwisu</h2>
      <p className={pClass}>Aby korzystać z Serwisu, Użytkownik powinien:</p>
      <ol className={olClass}>
        <li>dysponować urządzeniem końcowym z dostępem do Internetu;</li>
        <li>
          posiadać aktualną przeglądarkę internetową obsługującą HTML, CSS i z włączoną obsługą JavaScript (np. najnowsze wersje przeglądarek
          Chrome, Firefox, Safari, Edge). JavaScript jest niezbędny do prawidłowego działania dynamicznych elementów Serwisu, w szczególności
          formularzy, list rozwijanych, map i wiadomości;
        </li>
        <li>
          włączyć w przeglądarce obsługę plików cookie oraz technologii Local Storage (służą one wyłącznie do zapewnienia prawidłowego działania
          Serwisu);
        </li>
        <li>
          posiadać aktywne konto poczty elektronicznej (e-mail), potrzebne do rejestracji, komunikacji z Warsztatem i obsługi Rezerwacji.
        </li>
      </ol>
      <p className={pClass}>
        Użytkownik zobowiązany jest korzystać z Serwisu w sposób zgodny z przeznaczeniem, dobrymi obyczajami oraz obowiązującymi przepisami prawa. W
        szczególności zakazane jest:
      </p>
      <ol className={olClass}>
        <li>umieszczanie w Serwisie treści o charakterze bezprawnym, obraźliwym lub naruszającym prawa osób trzecich;</li>
        <li>działania mogące utrudniać lub destabilizować funkcjonowanie Serwisu;</li>
        <li>korzystanie z Serwisu w celu wysyłania spamu, podejmowania prób oszustwa lub innych nadużyć;</li>
        <li>
          wielokrotne rezerwowanie wizyt bez zamiaru skorzystania z usługi, w szczególności na szkodę Warsztatów i innych użytkowników.
        </li>
      </ol>
      <p className={pClass}>
        Usługodawca może w każdej chwili żądać potwierdzenia przez Użytkownika prawdziwości danych, które podał, a w przypadku odmowy – zablokować lub
        usunąć Konto.
      </p>

      <h2 className={h2Class}>§ 4. Rejestracja i rodzaje kont</h2>
      <p className={pClass}>
        Korzystanie z podstawowych funkcji przeglądania treści Serwisu nie wymaga założenia Konta. Umówienie wizyty w Warsztacie lub dodanie
        Warsztatu do Serwisu wymaga rejestracji Konta.
      </p>
      <p className={pClass}>
        Rejestracja Konta Kierowcy polega na wypełnieniu formularza rejestracyjnego, w którym wymagane są co najmniej: adres e-mail, numer telefonu,
        hasło oraz imię. Podanie nazwiska jest opcjonalne – użytkownik może wybrać pseudonim wyświetlany w opiniach zamiast nazwiska. Dodatkowo
        rekomendowane jest podanie danych pojazdu (marka, model, rocznik, paliwo). Wskazanie numeru VIN jest dobrowolne, lecz ułatwia warsztatowi
        przygotowanie dokładnej wyceny. Użytkownik zobowiązuje się podawać dane zgodne ze stanem faktycznym. Za podanie fałszywych danych lub danych
        niezgodnych z prawdą Użytkownik ponosi pełną odpowiedzialność.
      </p>
      <p className={pClass}>
        Konto Warsztatu tworzy Użytkownik, który po zalogowaniu się w Serwisie wypełnia formularz zgłoszeniowy obejmujący m.in.: nazwę Warsztatu,
        dane kontaktowe, adres, zakres świadczonych usług, orientacyjne ceny, godziny pracy oraz link do lokalizacji w Google Maps (opcjonalnie).
        Zgłoszenie jest weryfikowane przez Administratora w celu potwierdzenia zgodności danych z rzeczywistością i uniknięcia spamu. Po pozytywnej
        weryfikacji Administrator aktywuje Konto Warsztatu i umieszcza Warsztat na mapie Serwisu. Warsztat zobowiązany jest do aktualizowania
        danych, w szczególności w zakresie dostępnych usług, cen, terminów i godzin pracy.
      </p>
      <p className={pClass}>
        Konto Administratora jest przydzielane osobom zarządzającym Serwisem i uprawnia do wglądu i edycji ofert Warsztatów, weryfikacji nowych
        zgłoszeń, dodawania lub usuwania Warsztatów, obsługi zgłoszeń od Użytkowników oraz zarządzania treścią Serwisu.
      </p>
      <p className={pClass}>
        Użytkownik może posiadać więcej niż jedno Konto w Serwisie, jednak każde Konto wymaga oddzielnego adresu e-mail. Warsztat może posiadać
        jedno Konto obsługujące kilka lokalizacji (oddziałów), jeżeli takie rozwiązanie zostanie wprowadzone w Serwisie.
      </p>
      <p className={pClass}>
        Usługodawca może zablokować lub usunąć Konto Użytkownika lub Warsztatu bez uprzedzenia w przypadkach naruszenia Regulaminu, w szczególności w
        przypadku podawania fałszywych danych, spamowania, wielokrotnego rezerwowania bez zamiaru skorzystania z usługi, braku odpowiedzi na
        wiadomości, negatywnych opinii świadczących o oszustwach lub niskiej jakości usług. Zablokowanie Konta może mieć charakter tymczasowy
        (zawieszenie), do czasu wyjaśnienia sprawy, lub trwały (usunięcie Konta). Użytkownik zostanie poinformowany o przyczynie zawieszenia lub
        usunięcia Konta.
      </p>
      <p className={pClass}>
        Użytkownik może w każdym momencie usunąć swoje Konto z poziomu ustawień konta lub zgłaszając żądanie na adres e-mail Usługodawcy. Usunięcie
        Konta powoduje utratę dostępu do historii rezerwacji i wiadomości. Usługodawca może odmówić natychmiastowego usunięcia Konta, jeżeli
        Użytkownik ma niewykonane rezerwacje lub zobowiązania wobec Warsztatu.
      </p>
      <p className={pClass}>
        Użytkownik może w ramach swojego Konta dodawać, edytować oraz usuwać informacje o posiadanych pojazdach. Zmiana danych pojazdu po dokonaniu
        Rezerwacji może wiązać się z ponownym ustaleniem wyceny i terminu przez Warsztat.
      </p>

      <h2 className={h2Class}>§ 5. Zasady korzystania przez Kierowcę</h2>
      <p className={pClass}>
        Kierowca, korzystając z Serwisu, akceptuje, że Serwis jest pośrednikiem pomiędzy nim a Warsztatem i nie jest stroną umowy o świadczenie usług
        motoryzacyjnych. Kierowca korzysta z Serwisu na własną odpowiedzialność, w tym ponosi ryzyko doboru nieodpowiedniego Warsztatu lub usługi.
      </p>
      <p className={pClass}>
        Kierowca zobowiązany jest podać prawidłowe i kompletne dane pojazdu, aby Warsztat mógł przygotować rzetelną ofertę. Podanie błędnych danych
        może skutkować odmową realizacji usługi lub zmianą ceny w stosunku do orientacyjnej wyceny.
      </p>
      <p className={pClass}>
        W celu umówienia wizyty Kierowca wypełnia formularz, w którym określa pojazd, rodzaj usługi, opis problemu, miasto, a następnie korzysta z
        funkcji „Znajdź oferty”. Serwis wyświetla listę Warsztatów odpowiadających kryteriom oraz mapę z ich lokalizacją. Kierowca może sortować i
        filtrować wyniki (np. według ceny, odległości, oceny). Wszelka komunikacja z Warsztatem – w tym przesyłanie ostatecznej oferty, potwierdzenia
        terminu, negocjacje ceny, zadawanie pytań lub zmianę terminu – odbywa się wyłącznie poprzez wewnętrzny system wiadomości Serwisu. Kierowca
        zobowiązany jest do nieudzielania warsztatowi swoich danych kontaktowych (numeru telefonu, adresu e-mail) oraz do niekorzystania z kanałów
        zewnętrznych (telefon, SMS, e-mail, komunikatory internetowe) w celu omawiania szczegółów usługi. Wyjątkiem jest kontakt po zakończeniu
        usługi, jeśli obie strony wyraźnie go uzgodnią. Naruszenie zakazu może skutkować zawieszeniem lub usunięciem Konta.
      </p>
      <p className={pClass}>
        Kierowca wybiera Warsztat, a następnie orientacyjny termin wizyty spośród dostępnych godzin. Po dokonaniu wyboru Serwis zarezerwuje wybraną
        godzinę dla Kierowcy na czas określony w Serwisie (obecnie 24 godziny w wersji testowej). W tym czasie Warsztat ma obowiązek potwierdzić,
        odrzucić lub zaproponować inny termin.
      </p>
      <p className={pClass}>
        Jeżeli Warsztat nie odpowie w okresie wskazanym w Serwisie (obecnie 24 godziny) od dokonania rezerwacji, rezerwacja zostaje anulowana.
      </p>
      <p className={pClass}>Kierowca otrzymuje od Warsztatu ostateczną propozycję ceny wraz z ewentualnym komentarzem. Kierowca może:</p>
      <ol className={olClass}>
        <li>zaakceptować warunki (wtedy rezerwacja zostaje potwierdzona i termin jest zablokowany);</li>
        <li>zaproponować własną cenę lub inny termin (opcja negocjacji w wersji testowej może być ograniczona);</li>
        <li>odrzucić ofertę – rezerwacja zostanie anulowana.</li>
      </ol>
      <p className={pClass}>
        Kierowca może anulować potwierdzoną wizytę. Anulowanie jest możliwe najpóźniej na 6 godzin przed planowaną wizytą. Odwołanie później niż 6
        godzin przed terminem może skutkować negatywną oceną lub czasową blokadą Konta.
      </p>
      <p className={pClass}>
        Kierowca może zmienić termin wizyty, o ile dany Warsztat oferuje taką możliwość i ma wolne sloty. Zmiana terminu traktowana jest jak
        anulowanie i ponowna rezerwacja.
      </p>
      <p className={pClass}>
        Kierowca może zgłosić problem dotyczący przebiegu wizyty lub jakości usługi poprzez funkcję zgłoszenia w Serwisie. Zgłoszenie problemu nie
        stanowi reklamacji w rozumieniu przepisów Kodeksu cywilnego. Reklamacje dotyczące usług motoryzacyjnych należy zgłaszać bezpośrednio do
        Warsztatu. Usługodawca może udzielić wsparcia w kontakcie z Warsztatem, jednak nie prowadzi postępowań reklamacyjnych w imieniu Użytkowników.
      </p>
      <p className={pClass}>
        Wszelkie opinie i oceny dodawane przez Kierowców w Serwisie powinny być zgodne z prawem i stanem faktycznym. Użytkownik ma możliwość wyboru,
        czy opinia będzie podpisana imieniem i pierwszą literą nazwiska, czy pseudonimem wskazanym podczas rejestracji. Usługodawca może moderować lub
        usuwać opinie naruszające przepisy, dobre obyczaje lub prawa osób trzecich.
      </p>

      <h2 className={h2Class}>§ 6. Zasady korzystania przez Warsztat</h2>
      <p className={pClass}>
        Warsztat zobowiązuje się do podania prawdziwych i kompletnych danych podczas wypełniania formularza rejestracji warsztatu. Dane te obejmują
        m.in. nazwę, adres oraz dane kontaktowe warsztatu (np. numer telefonu, adres e-mail), a także rodzaj działalności, zakres usług, orientacyjne
        ceny „od–do”, czas trwania usługi, godziny pracy, link do lokalizacji w Google Maps i inne istotne informacje. Dane kontaktowe warsztatu
        służą do komunikacji w ramach Serwisu i nie są udostępniane publicznie w profilu warsztatu; cała korespondencja z Kierowcą odbywa się za
        pośrednictwem wewnętrznej skrzynki wiadomości. Warsztat odpowiada za aktualizowanie danych w Serwisie. Podanie nieprawdziwych danych lub brak
        aktualizacji może skutkować zawieszeniem lub usunięciem Konta.
      </p>
      <p className={pClass}>
        Warsztat może zostać opublikowany na mapie Serwisu wyłącznie po pozytywnej weryfikacji przez Administratora. Administrator weryfikuje
        poprawność danych, w tym lokalizacji (latitude/longitude), oraz może poprosić o dodatkowe informacje.
      </p>
      <p className={pClass}>
        Warsztat ustala orientacyjne ceny usług. Ceny te są widoczne dla Kierowców w formacie „od–do”. Ostateczną cenę Warsztat przesyła Kierowcy po
        przyjęciu zgłoszenia i weryfikacji danych pojazdu. Warsztat jest zobowiązany do wyjaśnienia Kierowcy, z czego wynika ostateczna cena.
      </p>
      <p className={pClass}>
        Warsztat może ustalać i modyfikować godziny oraz dni pracy, wskazywać najbliższe dostępne terminy i czas trwania usługi. Zmiany te powinny być
        wprowadzane w Serwisie na bieżąco, aby zapobiec sytuacji, w której Kierowca rezerwuje termin niedostępny.
      </p>
      <p className={pClass}>
        Po otrzymaniu Rezerwacji Warsztat powinien w terminie wskazanym w Serwisie (obecnie 24 godziny w wersji testowej) potwierdzić, odrzucić lub
        zaproponować inny termin. Brak odpowiedzi w tym okresie powoduje automatyczne anulowanie Rezerwacji, a slot staje się ponownie dostępny dla
        innych Kierowców.
      </p>
      <p className={pClass}>
        Warsztat odpowiada za komunikację z Kierowcą wyłącznie za pośrednictwem systemu wiadomości dostępnego w Serwisie, w tym za odpowiadanie na
        zapytania i wysyłanie ostatecznej oferty. W celu zachowania transparentności i archiwizacji rozmowy wszelka komunikacja poza Serwisem – w
        szczególności telefoniczna, SMS, e-mail lub przez zewnętrzne komunikatory – jest niedopuszczalna. Warsztat nie powinien przekazywać
        dodatkowych informacji innymi kanałami ani zachęcać Kierowców do kontaktu poza platformą.
      </p>
      <p className={pClass}>
        Warsztat odpowiada za jakość świadczonej usługi, terminowość oraz bezpieczeństwo pojazdu. ServyGo nie ponosi odpowiedzialności za jakość lub
        skutki usług motoryzacyjnych.
      </p>
      <p className={pClass}>
        Warsztat może zostać zawieszony lub usunięty z Serwisu, jeżeli otrzyma liczne negatywne opinie wskazujące na oszustwa, niską jakość usług,
        niehonorowanie rezerwacji lub naruszanie prawa. Zawieszenie może być tymczasowe, do czasu wyjaśnienia, lub trwałe – z możliwością odwołania.
      </p>
      <p className={pClass}>
        Warsztat może w przyszłości udostępnić płatności przez Serwis lub inne dodatkowe funkcje (np. abonament). Zasady takich funkcji zostaną
        określone w osobnych regulaminach.
      </p>

      <h2 className={h2Class}>§ 7. Odpowiedzialność Usługodawcy</h2>
      <ol className={olClass}>
        <li>
          Usługodawca świadczy usługi elektroniczne polegające na udostępnianiu Użytkownikom funkcjonalności Serwisu. Usługodawca nie jest dostawcą
          usług motoryzacyjnych.
        </li>
        <li>Usługodawca nie odpowiada za treść ofert Warsztatów ani za wykonanie umów zawieranych pomiędzy Kierowcami a Warsztatami.</li>
        <li>
          Usługodawca nie gwarantuje, że korzystanie z Serwisu zawsze doprowadzi do znalezienia oferty Warsztatu. Serwis jest platformą
          pośredniczącą; dostępność i liczba Warsztatów zależy od ich liczby i aktywności w danym regionie.
        </li>
        <li>
          Usługodawca nie odpowiada za szkody spowodowane nieprawidłowym funkcjonowaniem sprzętu lub oprogramowania Użytkownika, opóźnienia w
          działaniu poczty elektronicznej, działaniem osób trzecich, awarie sieci Internet, a także za skutki działania siły wyższej (m.in. klęski
          żywiołowe, wojny, epidemie, zamieszki) uniemożliwiające świadczenie usług.
        </li>
        <li>
          Usługodawca zastrzega możliwość przerw w działaniu Serwisu z przyczyn technicznych. W miarę możliwości Użytkownicy będą informowani o
          planowanych przerwach.
        </li>
        <li>
          Usługodawca dokłada starań, aby treści w Serwisie były rzetelne i aktualne, ale nie ponosi odpowiedzialności za skutki korzystania z
          informacji o charakterze ogólnym. Opinie publikowane w Serwisie są subiektywnymi poglądami Użytkowników.
        </li>
      </ol>

      <h2 className={h2Class}>§ 8. Dane osobowe i Polityka prywatności</h2>
      <ol className={olClass}>
        <li>
          Dane osobowe Użytkowników są przetwarzane przez Usługodawcę zgodnie z obowiązującymi przepisami prawa, w tym z Rozporządzeniem Parlamentu
          Europejskiego i Rady (UE) 2016/679 z 27 kwietnia 2016 r. (RODO) oraz ustawą o ochronie danych osobowych.
        </li>
        <li>
          Szczegółowe zasady gromadzenia, przetwarzania, przechowywania i wykorzystywania danych osobowych, a także zasady dotyczące plików cookie
          określa Polityka prywatności dostępna w Serwisie.
        </li>
        <li>
          Podanie danych osobowych jest dobrowolne, lecz niezbędne do korzystania z niektórych funkcji Serwisu (np. rejestracji konta, rezerwacji
          wizyty). Użytkownik wyraża zgodę na przetwarzanie swoich danych w zakresie niezbędnym do świadczenia usług elektronicznych, realizacji
          rezerwacji i kontaktowania się w sprawach dotyczących korzystania z Serwisu.
        </li>
        <li>
          Użytkownik może w każdej chwili wycofać zgodę na przetwarzanie danych w celach marketingowych, co nie wpływa na zgodność z prawem
          przetwarzania przed wycofaniem zgody.
        </li>
        <li>
          Wiadomości wymieniane pomiędzy Użytkownikami w ramach Serwisu (wewnętrzna skrzynka) są przechowywane w systemie Serwisu przez okres
          niezbędny do obsługi rezerwacji i ewentualnych zgłoszeń.
        </li>
        <li>
          Administrator Serwisu może mieć dostęp do treści wiadomości wymienianych pomiędzy Użytkownikami jedynie w zakresie niezbędnym do świadczenia
          pomocy technicznej, zapewnienia bezpieczeństwa, wyjaśniania zgłoszeń, rozstrzygania sporów lub w przypadku podejrzenia naruszenia
          Regulaminu. Treści wiadomości nie są wykorzystywane w innych celach i podlegają ochronie zgodnie z Polityką prywatności.
        </li>
        <li>
          Na dzień sporządzenia Regulaminu Usługodawca nie prowadzi newslettera ani innych form komunikacji marketingowej. Wprowadzenie
          jakichkolwiek komunikatów marketingowych będzie wymagało uzyskania odrębnej, wyraźnej zgody Użytkownika.
        </li>
      </ol>

      <h2 className={h2Class}>§ 9. Zmiany Regulaminu</h2>
      <ol className={olClass}>
        <li>
          Usługodawca zastrzega sobie prawo do wprowadzania zmian w Regulaminie z ważnych przyczyn, w szczególności związanych ze zmianą przepisów
          prawa, rozwojem funkcjonalności Serwisu, wprowadzeniem nowych usług lub modyfikacją istniejących.
        </li>
        <li>
          Usługodawca poinformuje Użytkowników o planowanej zmianie Regulaminu, udostępniając nową treść Regulaminu na stronie internetowej Serwisu i
          wysyłając powiadomienie e-mail do Użytkowników posiadających Konto.
        </li>
        <li>
          Zmiany Regulaminu wchodzą w życie w terminie wskazanym w informacji o zmianach, nie krótszym niż 14 dni od daty powiadomienia. Użytkownik
          posiadający Konto, który nie akceptuje zmian, może w tym terminie zrezygnować z korzystania z Serwisu i usunąć Konto. Dalsze korzystanie z
          Serwisu po dacie wejścia w życie zmian oznacza akceptację nowego Regulaminu.
        </li>
        <li>Regulamin w równym stopniu obowiązuje wszystkich zarejestrowanych Użytkowników, niezależnie od wersji językowej Serwisu.</li>
      </ol>

      <h2 className={h2Class}>§ 10. Postanowienia końcowe</h2>
      <ol className={olClass}>
        <li>
          Regulamin podlega prawu Rzeczypospolitej Polskiej. W sprawach nieuregulowanych w Regulaminie zastosowanie mają przepisy Kodeksu cywilnego,
          ustawy o świadczeniu usług drogą elektroniczną oraz inne powszechnie obowiązujące przepisy prawa.
        </li>
        <li>
          Użytkownik, zakładając Konto, potwierdza, że zapoznał się z treścią Regulaminu, akceptuje jego postanowienia i zobowiązuje się ich
          przestrzegać.
        </li>
        <li>
          Użytkownik oświadcza, że posiada zdolność do czynności prawnych umożliwiającą zawieranie umów. Jeżeli z Serwisu korzysta osoba małoletnia,
          wymagana jest zgoda przedstawiciela ustawowego.
        </li>
        <li>
          Wszelkie spory wynikłe z korzystania z Serwisu będą rozstrzygane polubownie, a w przypadku braku porozumienia – przez właściwy sąd
          powszechny zgodnie z przepisami prawa polskiego.
        </li>
        <li>
          Usługodawca zastrzega sobie prawo do czasowego zablokowania lub trwałego usunięcia Konta Użytkownika (Kierowcy lub Warsztatu) bez
          wcześniejszego ostrzeżenia w przypadku naruszenia Regulaminu, w szczególności w razie podawania fałszywych danych, nadużywania systemu
          rezerwacji, spamowania, wielokrotnego nieprzyjeżdżania na wizytę, oszukiwania innych Użytkowników bądź podejmowania działań sprzecznych z
          prawem lub dobrymi obyczajami. Zablokowanie Konta może być tymczasowe lub trwałe – decyzję podejmuje Administrator. Użytkownikowi przysługuje
          prawo do wyjaśnień drogą elektroniczną.
        </li>
        <li>
          Regulamin dostępny jest w języku polskim. Serwis może udostępniać tłumaczenia Regulaminu na inne języki (np. angielski, ukraiński) – w
          przypadku rozbieżności decydujące znaczenie ma polska wersja Regulaminu.
        </li>
        <li>Niniejszy Regulamin wchodzi w życie z dniem publikacji w Serwisie i obowiązuje od tego dnia wszystkich Użytkowników.</li>
      </ol>

      <h2 className={h2Class}>§ 11. Reklamacje dotyczące działania Serwisu</h2>
      <ol className={olClass}>
        <li>
          Użytkownik może zgłosić reklamację dotyczącą funkcjonowania Serwisu, w szczególności problemów technicznych, błędów w rezerwacjach lub
          utrudnionego dostępu do funkcji. Reklamacje należy składać drogą elektroniczną na adres{" "}
          <a className={mailLinkClass} href="mailto:servygoa@gmail.com">
            servygoa@gmail.com
          </a>{" "}
          z opisaniem problemu.
        </li>
        <li>
          Usługodawca rozpatrzy reklamację w terminie 14 dni roboczych od daty jej otrzymania i przekaże odpowiedź na adres e-mail wskazany przez
          Użytkownika. Odpowiedź na reklamację zostanie przesłana w formie elektronicznej.
        </li>
        <li>
          Reklamacje dotyczące jakości usług motoryzacyjnych świadczonych przez Warsztaty nie są rozpatrywane przez Usługodawcę w ramach niniejszego
          Regulaminu. Ewentualne zgłoszenia problemów z Warsztatem mogą zostać złożone za pomocą funkcji zgłoszenia problemu w Serwisie i zostaną
          przekazane do wiadomości Administratora, który może podjąć działania opisane w Regulaminie (zawieszenie lub usunięcie Warsztatu).
        </li>
      </ol>
    </div>
  );
}
