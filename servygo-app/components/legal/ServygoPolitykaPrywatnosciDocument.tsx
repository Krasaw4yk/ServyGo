/**
 * Polityka prywatności ServyGo (PL), wersja 1.0 — struktura i kolory jak przy regulaminie.
 */

import { getLegalDocTypography } from "./legalDocumentTypography";

export function ServygoPolitykaPrywatnosciDocument({ isDark }: { isDark: boolean }) {
  const { h2Class, h3SectionClass, pClass, olClass, introClass, wrapClass, mailLinkClass } = getLegalDocTypography(isDark);

  return (
    <div className={wrapClass}>
      <h2 className={`mt-0 scroll-mt-24 text-base font-bold sm:text-lg ${isDark ? "text-zinc-50" : "text-zinc-950"}`}>
        1. Informacje ogólne
      </h2>
      <p className={introClass}>
        Serwis ServyGo, dostępny pod adresem servygo.pl, jest platformą testową umożliwiającą kontakt pomiędzy kierowcami poszukującymi usług
        motoryzacyjnych a warsztatami. Administratorem danych osobowych przetwarzanych w ramach Serwisu jest Kyrylo Veremieienko prowadzący projekt
        ServyGo. Dane korespondencyjne administratora: ul. Grażyny 11/24, 43-330 Bielsko-Biała; e-mail:{" "}
        <a className={mailLinkClass} href="mailto:servygoa@gmail.com">
          servygoa@gmail.com
        </a>
        . Serwis ma charakter testowy, ale jest publicznie dostępny.
      </p>
      <p className={pClass}>
        Niniejsza Polityka prywatności określa zasady przetwarzania danych osobowych użytkowników Serwisu, w tym kierowców i warsztatów, zgodnie z
        Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z 27 kwietnia 2016 r. (RODO) oraz krajowymi przepisami o ochronie danych
        osobowych.
      </p>

      <h2 className={h2Class}>2. Definicje</h2>
      <p className={pClass}>W niniejszej Polityce przyjmuje się definicje zgodne z Regulaminem Serwisu:</p>
      <ol className={olClass}>
        <li>
          <strong>Serwis</strong> – platforma ServyGo umożliwiająca łączenie kierowców z warsztatami.
        </li>
        <li>
          <strong>Użytkownik</strong> – każda osoba korzystająca z Serwisu; użytkownikami są m.in. kierowcy, warsztaty i administratorzy.
        </li>
        <li>
          <strong>Kierowca</strong> – osoba fizyczna poszukująca usługi motoryzacyjnej, która posiada konto kierowcy w Serwisie.
        </li>
        <li>
          <strong>Warsztat</strong> – przedsiębiorca prowadzący działalność gospodarczą lub osoba prawna oferująca usługi motoryzacyjne za
          pośrednictwem Serwisu.
        </li>
        <li>
          <strong>Administrator</strong> – uprawniony przedstawiciel Usługodawcy zarządzający Serwisem.
        </li>
        <li>
          <strong>Rezerwacja</strong> – zarezerwowanie przez kierowcę terminu wizyty w wybranym warsztacie.
        </li>
      </ol>

      <h2 className={h2Class}>3. Zakres i kategorie danych osobowych</h2>

      <h3 className={h3SectionClass}>3.1. Dane kierowcy</h3>
      <p className={pClass}>
        Podczas rejestracji kierowca podaje co najmniej: imię, adres e-mail, numer telefonu oraz hasło. Podanie nazwiska jest opcjonalne –
        użytkownik może użyć pseudonimu lub inicjału. Do konta można dodać kilka pojazdów. W celu przygotowania wyceny kierowca podaje dane pojazdu:
        marka, model, rocznik i rodzaj paliwa; podanie numeru VIN jest dobrowolne, ale ułatwia warsztatowi przygotowanie dokładniejszej oferty.
        Użytkownik może podać numer rejestracyjny pojazdu; jeśli numer rejestracyjny jest wprowadzony, będzie on przechowywany w koncie pojazdu.
      </p>
      <p className={pClass}>
        Kierowca może również opisać problem i podać miasto, w którym chce wykonać usługę. Telefon i e-mail kierowcy służą do logowania i
        powiadomień systemowych; nie są przekazywane warsztatowi. Kierowca może wybrać, aby jego imię z inicjałem nazwiska albo pseudonim był widoczny
        przy opinii.
      </p>

      <h3 className={h3SectionClass}>3.2. Dane rezerwacji</h3>
      <p className={pClass}>
        W ramach rezerwacji zbierane są dane dotyczące wybranej usługi motoryzacyjnej, warsztatu, proponowanego terminu, orientacyjnej ceny, statusu
        rezerwacji oraz historia komunikacji z warsztatem. Rezerwacja jest tymczasowo blokowana na określony czas; warsztat może potwierdzić,
        odrzucić lub zaproponować inny termin.
      </p>

      <h3 className={h3SectionClass}>3.3. Dane warsztatów</h3>
      <p className={pClass}>
        Przy rejestracji warsztaty podają m.in. nazwę, adres, NIP, numer telefonu, adres e-mail, rodzaj działalności, zakres usług, orientacyjne ceny
        „od–do”, czas trwania usługi, godziny pracy oraz link do lokalizacji w Google Maps. Dane kontaktowe warsztatu służą do komunikacji w ramach
        Serwisu i nie są publicznie udostępniane; warsztat komunikuje się z kierowcami wyłącznie przez wewnętrzny system wiadomości. Administrator
        weryfikuje poprawność danych warsztatu, w tym lokalizację (współrzędne latitude/longitude).
      </p>

      <h3 className={h3SectionClass}>3.4. Dane techniczne</h3>
      <p className={pClass}>
        W czasie korzystania z Serwisu zbierane są dane techniczne, takie jak adres IP, informacje o urządzeniu i przeglądarce, ustawienia języka, a
        także dane przechowywane w plikach cookie i local storage niezbędne do działania Serwisu. Wersja mobilna może wykorzystywać technologię Local
        Storage do zapamiętywania ustawień. Serwis nie pobiera automatycznie dokładnej geolokalizacji GPS użytkownika; kierowca samodzielnie wpisuje
        miasto. W przypadku warsztatów Administrator może korzystać z linku Google Maps lub Google Place ID, aby zweryfikować lokalizację, a następnie
        zapisać współrzędne geograficzne na mapie ServyGo.
      </p>

      <h3 className={h3SectionClass}>3.5. Dane komunikacji</h3>
      <p className={pClass}>
        Wszelka komunikacja między kierowcą a warsztatem odbywa się wyłącznie poprzez wewnętrzną skrzynkę wiadomości. Kierowca nie powinien udzielać
        warsztatowi swoich danych kontaktowych (numeru telefonu, adresu e-mail) i nie powinien korzystać z zewnętrznych kanałów w celu omawiania
        szczegółów usługi. Wiadomości wymieniane w ramach Serwisu są przechowywane przez okres niezbędny do obsługi rezerwacji i ewentualnych
        zgłoszeń. Administrator może mieć dostęp do treści wiadomości jedynie w zakresie niezbędnym do świadczenia pomocy technicznej, zapewnienia
        bezpieczeństwa, wyjaśniania zgłoszeń, rozstrzygania sporów lub w przypadku podejrzenia naruszenia Regulaminu.
      </p>

      <h3 className={h3SectionClass}>3.6. Opinie i oceny</h3>
      <p className={pClass}>
        Kierowcy mogą wystawiać opinie o warsztatach. Przy opinii będzie widoczne imię z pierwszą literą nazwiska lub pseudonim – pełne nazwisko,
        adres e-mail oraz numer telefonu nie są publikowane.
      </p>

      <h3 className={h3SectionClass}>3.7. Zdjęcia</h3>
      <p className={pClass}>
        Zwykli użytkownicy nie dodają zdjęć. Warsztaty oraz Administrator mogą dodawać zdjęcia warsztatów, stanowisk czy wyposażenia. Dodawane zdjęcia
        nie powinny zawierać danych osobowych (np. tablic rejestracyjnych, twarzy osób) ani dokumentów. W przyszłości Serwis może umożliwić pobieranie
        zdjęć z zewnętrznych źródeł (np. Google), jednak będą one wykorzystywane wyłącznie w celu prezentacji warsztatu.
      </p>

      <h2 className={h2Class}>4. Cele i podstawy prawne przetwarzania danych</h2>
      <p className={pClass}>Dane osobowe Użytkowników są przetwarzane w następujących celach i na podstawach prawnych:</p>
      <ol className={olClass}>
        <li>
          <strong>Rejestracja i obsługa konta Użytkownika</strong> – art. 6 ust. 1 lit. b RODO (niezbędność do wykonania umowy o świadczenie usług
          drogą elektroniczną), art. 6 ust. 1 lit. c RODO (wypełnienie obowiązków prawnych).
        </li>
        <li>
          <strong>Umożliwienie korzystania z Serwisu i rezerwacji wizyt</strong> – art. 6 ust. 1 lit. b RODO; obejmuje zbieranie danych pojazdu,
          przedstawianie ofert warsztatów oraz wymianę informacji dotyczących rezerwacji.
        </li>
        <li>
          <strong>Przekazywanie danych warsztatom w celu przygotowania oferty i realizacji usługi</strong> – art. 6 ust. 1 lit. b RODO. Warsztat
          otrzymuje tylko dane niezbędne do obsługi konkretnej rezerwacji: imię Użytkownika (bez pełnego nazwiska), oznaczenie pojazdu (marka, model,
          rocznik, paliwo, numer VIN jeśli podany), opis problemu, miasto i proponowany termin. Dane kontaktowe kierowcy (numer telefonu, e-mail) nie
          są standardowo udostępniane warsztatowi.
        </li>
        <li>
          <strong>Wewnętrzna komunikacja pomiędzy Użytkownikami</strong> – art. 6 ust. 1 lit. b oraz f RODO (prawnie uzasadniony interes administratora
          polegający na zapewnieniu bezpieczeństwa i możliwości dochodzenia roszczeń).
        </li>
        <li>
          <strong>Obsługa reklamacji i zgłoszeń problemów</strong> – art. 6 ust. 1 lit. b i f RODO; Serwis zbiera zgłoszenia problemów w celu ich
          przekazania warsztatowi i zachowania historii rozmowy.
        </li>
        <li>
          <strong>Prowadzenie historii rezerwacji i rozliczeń oraz obrona przed roszczeniami</strong> – art. 6 ust. 1 lit. f RODO (uzasadniony interes
          administratora).
        </li>
        <li>
          <strong>Spełnienie obowiązków prawnych</strong> wynikających z przepisów o świadczeniu usług drogą elektroniczną, przepisów podatkowych i o
          rachunkowości – art. 6 ust. 1 lit. c RODO.
        </li>
        <li>
          <strong>Cele analityczne i statystyczne</strong> – art. 6 ust. 1 lit. f RODO; obejmuje analizę korzystania z Serwisu w celu jego rozwoju i
          poprawy funkcjonalności. Analiza odbywa się na danych zanonimizowanych lub pseudonimizowanych.
        </li>
        <li>
          <strong>Marketing bezpośredni</strong> – na dzień sporządzenia regulaminu Usługodawca nie prowadzi newslettera ani komunikacji
          marketingowej. W przypadku uruchomienia newslettera lub reklam dopasowanych przetwarzanie danych będzie odbywało się na podstawie odrębnej
          zgody Użytkownika, art. 6 ust. 1 lit. a RODO.
        </li>
      </ol>

      <h2 className={h2Class}>5. Odbiorcy danych</h2>
      <p className={pClass}>Dane osobowe mogą być przekazywane następującym kategoriom odbiorców:</p>
      <ol className={olClass}>
        <li>
          <strong>Warsztaty</strong> – wyłącznie w zakresie niezbędnym do przygotowania oferty i realizacji rezerwacji (dane pojazdu i imię
          Użytkownika). Warsztat zobowiązany jest do korzystania z danych tylko w celu realizacji usługi oraz do aktualizowania swoich danych.
        </li>
        <li>
          <strong>Dostawcy usług technologicznych</strong> – w szczególności dostawcy usług hostingu (np. Vercel), bazy danych i uwierzytelniania
          (Supabase), usług e-mail oraz dostawcy map i narzędzi programistycznych. Dostawcy ci mogą przetwarzać dane w naszym imieniu na podstawie
          zawartych umów powierzenia przetwarzania danych.
        </li>
        <li>
          <strong>Podmioty uprawnione na podstawie przepisów prawa</strong> – np. organy publiczne lub uprawnione podmioty, jeśli zwrócą się do
          Administratora z żądaniem wynikającym z bezwzględnie obowiązujących przepisów.
        </li>
        <li>
          <strong>Administratorzy systemów bezpieczeństwa</strong> – w przypadkach wykrycia nieprawidłowości, naruszeń bezpieczeństwa lub podejrzenia
          oszustwa.
        </li>
      </ol>
      <p className={pClass}>Nie udostępniamy danych Użytkowników innym podmiotom do ich własnych celów marketingowych.</p>

      <h2 className={h2Class}>6. Przekazywanie danych do państw trzecich</h2>
      <p className={pClass}>
        Serwis korzysta z usług dostawców infrastruktury informatycznej, którzy mogą mieć siedzibę lub infrastrukturę poza Europejskim Obszarem
        Gospodarczym (EOG), takich jak Supabase czy Vercel. Dostawcy ci stosują odpowiednie instrumenty prawne, w szczególności standardowe klauzule
        umowne, gwarantujące ochronę danych osobowych zgodnie z RODO. Użytkownik ma prawo uzyskać kopię zabezpieczeń stosowanych przy przekazywaniu
        danych do państw trzecich, kontaktując się z administratorem.
      </p>

      <h2 className={h2Class}>7. Okres przechowywania danych</h2>
      <p className={pClass}>Dane osobowe będą przechowywane przez okres niezbędny do realizacji celów określonych w niniejszej Polityce:</p>
      <ol className={olClass}>
        <li>
          <strong>Konto Użytkownika</strong> – do czasu usunięcia konta przez Użytkownika lub rozwiązania umowy.
        </li>
        <li>
          <strong>Dane pojazdów</strong> – do czasu usunięcia pojazdu z profilu lub usunięcia konta.
        </li>
        <li>
          <strong>Historia rezerwacji i rozliczeń</strong> – do 5 lat od zakończenia rezerwacji lub rozwiązania sporu, w celu dochodzenia roszczeń i
          obrony przed nimi.
        </li>
        <li>
          <strong>Formularze i zgłoszenia</strong> – do 12 miesięcy, chyba że dojdzie do współpracy; wtedy dane przechowywane są zgodnie z zasadami
          dotyczącymi konta i rezerwacji.
        </li>
        <li>
          <strong>Dane komunikacji (wiadomości)</strong> – przez okres potrzebny do obsługi rezerwacji i zgłoszeń oraz do czasu przedawnienia roszczeń.
        </li>
        <li>
          <strong>Dane techniczne (logi)</strong> – do 12 miesięcy.
        </li>
        <li>
          <strong>Dane marketingowe</strong> – do czasu wycofania zgody.
        </li>
        <li>
          <strong>Pliki cookie i local storage</strong> – zgodnie z ustawieniami użytkownika lub do czasu ich samoczynnego wygaśnięcia.
        </li>
      </ol>
      <p className={pClass}>Po upływie odpowiednich okresów dane są usuwane lub anonimizowane.</p>

      <h2 className={h2Class}>8. Prawa Użytkowników</h2>
      <p className={pClass}>Każdej osobie, której dane dotyczą, przysługują następujące prawa wynikające z RODO:</p>
      <ol className={olClass}>
        <li>
          <strong>Prawo dostępu do danych</strong> – uzyskanie informacji o przetwarzaniu danych i kopii danych.
        </li>
        <li>
          <strong>Prawo do sprostowania danych</strong> – żądanie poprawienia nieprawidłowych danych lub ich uzupełnienia.
        </li>
        <li>
          <strong>Prawo do usunięcia danych („prawo do bycia zapomnianym”)</strong> – żądanie usunięcia danych przetwarzanych bezpodstawnie lub
          sprzecznie z prawem.
        </li>
        <li>
          <strong>Prawo do ograniczenia przetwarzania</strong> – żądanie wstrzymania operacji na danych w określonych przypadkach.
        </li>
        <li>
          <strong>Prawo do przenoszenia danych</strong> – otrzymanie danych w ustrukturyzowanym formacie i przeniesienie ich do innego administratora.
        </li>
        <li>
          <strong>Prawo sprzeciwu</strong> – sprzeciw wobec przetwarzania danych opartego na uzasadnionym interesie administratora lub na potrzeby
          marketingu bezpośredniego.
        </li>
        <li>
          <strong>Prawo do wycofania zgody</strong> – w zakresie, w jakim przetwarzanie odbywa się na podstawie zgody; cofnięcie zgody nie wpływa na
          zgodność z prawem wcześniejszego przetwarzania.
        </li>
        <li>
          <strong>Prawo wniesienia skargi do organu nadzorczego</strong> – w Polsce organem tym jest Prezes Urzędu Ochrony Danych Osobowych (ul.
          Stawki 2, 00-193 Warszawa).
        </li>
      </ol>
      <p className={pClass}>
        W celu skorzystania z praw Użytkownicy mogą skontaktować się z Administratorem poprzez adres e-mail:{" "}
        <a className={mailLinkClass} href="mailto:servygoa@gmail.com">
          servygoa@gmail.com
        </a>
        .
      </p>

      <h2 className={h2Class}>9. Bezpieczeństwo danych</h2>
      <p className={pClass}>
        Administrator stosuje odpowiednie środki techniczne i organizacyjne w celu zapewnienia bezpieczeństwa przetwarzanych danych, w szczególności:
      </p>
      <ol className={olClass}>
        <li>szyfrowanie połączeń (SSL) oraz szyfrowanie haseł w systemie uwierzytelniania;</li>
        <li>system uprawnień ograniczający dostęp do danych tylko do osób uprawnionych;</li>
        <li>regularne aktualizacje oprogramowania i kontrola bezpieczeństwa;</li>
        <li>wewnętrzny system wiadomości jako podstawowy kanał kontaktu między kierowcami a warsztatami;</li>
        <li>procedury ochrony danych i reagowania na incydenty.</li>
      </ol>

      <h2 className={h2Class}>10. Pliki cookie i podobne technologie</h2>
      <p className={pClass}>
        Serwis wykorzystuje pliki cookie oraz lokalną pamięć przeglądarki (Local Storage) wyłącznie w celach technicznych, aby zapewnić prawidłowe
        działanie Serwisu, zapamiętać ustawienia użytkownika, uwierzytelnianie i zabezpieczenie połączeń. Serwis nie korzysta obecnie z narzędzi
        analitycznych (np. Google Analytics) ani reklamowych (Google Ads, Meta Pixel). Jeżeli w przyszłości zostaną wprowadzone narzędzia analityczne lub
        marketingowe, będzie to wymagało uzyskania wyraźnej zgody Użytkowników. Użytkownik może w każdej chwili zmienić ustawienia dotyczące plików
        cookie w swojej przeglądarce.
      </p>

      <h2 className={h2Class}>11. Zmiany Polityki prywatności</h2>
      <p className={pClass}>
        Administrator zastrzega sobie prawo do wprowadzania zmian w niniejszej Polityce w celu dostosowania jej do zmian prawnych, rozwoju
        funkcjonalności Serwisu lub wprowadzenia nowych usług. O wszelkich zmianach Użytkownicy zostaną poinformowani poprzez odpowiednią informację
        na stronie Serwisu lub mailowo, nie później niż 14 dni przed wejściem zmian w życie. Korzystanie z Serwisu po dacie wejścia w życie zmian
        oznacza akceptację nowych zasad.
      </p>

      <h2 className={h2Class}>12. Kontakt</h2>
      <p className={pClass}>
        W przypadku pytań lub wątpliwości dotyczących przetwarzania danych osobowych w ramach Serwisu można skontaktować się z Administratorem:
      </p>
      <p className={pClass}>
        e-mail:{" "}
        <a className={mailLinkClass} href="mailto:servygoa@gmail.com">
          servygoa@gmail.com
        </a>
      </p>
      <p className={pClass}>adres korespondencyjny: ul. Grażyny 11/24, 43-330 Bielsko-Biała.</p>

      <p className={`${pClass} mt-8 border-t pt-6 ${isDark ? "border-zinc-600/50" : "border-zinc-200"}`}>
        Niniejsza Polityka prywatności obowiązuje od 3 maja 2026 r. i zastępuje wszystkie wcześniejsze wersje dokumentu.
      </p>
    </div>
  );
}
