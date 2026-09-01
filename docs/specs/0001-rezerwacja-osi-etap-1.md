# Rezerwacja osi strzeleckiej — etap 1

> Opublikowany jako [issue #1](https://github.com/piotr-eljasiak/strzelnica/issues/1)
> z etykietą `ready-for-agent`. Ta kopia jest zapisem historycznym; bieżąca dyskusja
> toczy się w issue.

## Problem Statement

Strzelec, który chce postrzelać, nie ma jak sprawdzić, czy oś o interesującej go długości jest
w danej godzinie wolna. Musi zadzwonić do strzelnicy albo przyjechać na miejsce i zaryzykować,
że wszystko jest zajęte. Strzelnica z kolei przyjmuje rezerwacje przez telefon i prowadzi je
w zeszycie albo w arkuszu, przez co dwie osoby potrafią dostać tę samą oś na tę samą godzinę,
a informacja o dostępności nie istnieje nigdzie poza głową osoby przy telefonie.

Strzelnica ma własną stronę www i nie chce wysyłać z niej klientów do obcego serwisu, ale nie ma
też zasobów, by zbudować własny system rezerwacji.

## Solution

Platforma obsługująca wiele strzelnic, w której strzelec rezerwuje całą oś strzelecką na godzinne
sloty. Strzelnica wkleja na swoją stronę jeden fragment kodu i dostaje osadzony widget
z aktualną dostępnością swoich osi — anonimowy, bez logowania, wyglądający jak część jej witryny.
Strzelec wybiera w widgecie oś i godzinę, przechodzi na stronę aplikacji, loguje się i potwierdza
rezerwację, która od tej chwili jest wiążąca. Swoje rezerwacje widzi w jednym miejscu i może je
samodzielnie anulować najpóźniej 24 godziny przed terminem.

Etap 1 dowozi tę ścieżkę w całości, od dostępności w osadzonym widgecie po anulowanie, jako
aplikację testową uruchamianą lokalnie.

## User Stories

### Strzelec — przeglądanie dostępności

1. Jako strzelec, chcę zobaczyć na stronie strzelnicy kalendarz jej osi, aby sprawdzić dostępność
   bez dzwonienia i bez opuszczania strony, którą właśnie czytam.
2. Jako strzelec, chcę zobaczyć listę osi danej strzelnicy wraz z ich dystansem, aby wybrać oś
   odpowiednią do broni, z której zamierzam strzelać.
3. Jako strzelec, chcę widzieć dostępność w podziale na godzinne sloty, aby od razu wiedzieć,
   o której mogę przyjść.
4. Jako strzelec, chcę widzieć każdy slot oznaczony jako wolny albo niedostępny, aby nie tracić
   czasu na próbę rezerwacji terminu, którego i tak nie dostanę.
5. Jako strzelec, chcę przeglądać dostępność bez zakładania konta, aby ocenić ofertę strzelnicy,
   zanim zdecyduję się cokolwiek podawać o sobie.
6. Jako strzelec, chcę przechodzić między kolejnymi dniami, aby znaleźć termin pasujący
   do mojego grafiku.
7. Jako strzelec, chcę widzieć wyłącznie dni w dozwolonym horyzoncie rezerwacji, aby nie planować
   terminów, których i tak nie da się zarezerwować.
8. Jako strzelec, chcę, aby godziny poza grafikiem osi w ogóle się nie pojawiały, aby kalendarz
   pokazywał realne godziny otwarcia, a nie pustą dobę.
9. Jako strzelec, chcę, aby sloty, które już minęły, nie były oferowane, aby nie próbować
   zarezerwować przeszłości.

### Strzelec — konto

10. Jako strzelec, chcę założyć konto podając e-mail i hasło, aby móc składać rezerwacje.
11. Jako strzelec, chcę podać imię, nazwisko i telefon przy zakładaniu konta, aby obsługa
    strzelnicy miała jak się ze mną skontaktować, gdy coś się zmieni.
12. Jako strzelec, chcę zostać poinformowany, że konto o tym adresie e-mail już istnieje,
    aby wiedzieć, że mam się zalogować, a nie rejestrować.
13. Jako strzelec, chcę się zalogować e-mailem i hasłem, aby wrócić do swoich rezerwacji.
14. Jako strzelec, chcę pozostać zalogowany po odświeżeniu strony, aby nie logować się przy
    każdym kroku.
15. Jako strzelec, chcę się wylogować, aby zakończyć sesję na współdzielonym komputerze.
16. Jako strzelec, chcę, aby moje hasło nie było przechowywane w postaci jawnej, aby jego wyciek
    nie oznaczał utraty konta.

### Strzelec — składanie rezerwacji

17. Jako strzelec, chcę kliknąć wybrany slot w widgecie i przejść do finalizacji rezerwacji,
    aby dokończyć to, co zacząłem, bez szukania formularza.
18. Jako strzelec, chcę, aby po zalogowaniu wybrany wcześniej termin był nadal wybrany, aby nie
    zaczynać wyboru od nowa.
19. Jako strzelec, chcę zarezerwować kilka kolejnych godzin jako jedną rezerwację, aby spokojnie
    przeprowadzić dłuższy trening.
20. Jako strzelec, chcę zobaczyć podsumowanie z nazwą strzelnicy, osią, datą i godzinami przed
    potwierdzeniem, aby upewnić się, że rezerwuję to, co chciałem.
21. Jako strzelec, chcę, aby rezerwacja była wiążąca od razu po potwierdzeniu, aby nie czekać
    na czyjąś akceptację i nie ryzykować, że ktoś zajmie termin w międzyczasie.
22. Jako strzelec, chcę zobaczyć czytelny komunikat, gdy ktoś zajął wybrany termin przed
    chwilą, aby wrócić do kalendarza i wybrać inny.
23. Jako strzelec, chcę zobaczyć czytelny komunikat, gdy wyczerpałem limit rezerwacji, aby
    rozumieć, dlaczego nie mogę zarezerwować, zamiast zgadywać.
24. Jako strzelec, chcę, aby próba rezerwacji nieprzylegających do siebie godzin została odrzucona
    z wyjaśnieniem, aby wiedzieć, że dłuższa rezerwacja musi być ciągła.

### Strzelec — zarządzanie rezerwacjami

25. Jako strzelec, chcę zobaczyć listę swoich nadchodzących rezerwacji, aby pamiętać, kiedy
    i gdzie mam przyjść.
26. Jako strzelec, chcę zobaczyć rezerwacje we wszystkich strzelnicach w jednym miejscu, aby nie
    sprawdzać każdej strony osobno.
27. Jako strzelec, chcę zobaczyć historię minionych rezerwacji, aby wiedzieć, gdzie już byłem.
28. Jako strzelec, chcę anulować rezerwację samodzielnie, aby nie blokować osi, na którą i tak
    nie dotrę.
29. Jako strzelec, chcę widzieć, do kiedy mogę anulować, aby świadomie zdecydować przed upływem
    tego czasu.
30. Jako strzelec, chcę, aby próba anulowania na mniej niż 24 godziny przed terminem została
    odrzucona z wyjaśnieniem i wskazaniem kontaktu do strzelnicy, aby wiedzieć, co dalej.
31. Jako strzelec, chcę, aby anulowany termin natychmiast wrócił do puli wolnych, aby ktoś inny
    mógł z niego skorzystać.
32. Jako strzelec, chcę mieć pewność, że nie widzę i nie mogę anulować cudzych rezerwacji,
    aby moje dane były równie bezpieczne.

### Strzelnica — osadzenie widgetu

33. Jako obsługa strzelnicy, chcę wkleić na swoją stronę gotowy fragment kodu, aby uruchomić
    rezerwacje bez pomocy programisty.
34. Jako obsługa strzelnicy, chcę, aby widget pokazywał wyłącznie moje osie, aby klient nie
    trafił przypadkiem na ofertę konkurencji.
35. Jako obsługa strzelnicy, chcę, aby widget dopasowywał wysokość do treści, aby nie miał
    wewnętrznego paska przewijania psującego wygląd strony.
36. Jako obsługa strzelnicy, chcę, aby nikt poza wskazanymi przeze mnie stronami nie mógł osadzić
    mojego widgetu, aby nie firmować cudzych witryn.
37. Jako obsługa strzelnicy, chcę, aby odwiedzający moją stronę nie widział w widgecie nazwisk
    ani danych innych klientów, aby nie naruszać ich prywatności.
38. Jako obsługa strzelnicy, chcę, aby powód niedostępności slotu nie był ujawniany publicznie,
    aby nikt nie wnioskował z kalendarza o moich sprawach wewnętrznych.

### Strzelnica — dane i konfiguracja (etap 1: przez dane startowe)

39. Jako obsługa strzelnicy, chcę, aby każda oś miała własny grafik tygodniowy, aby oś 100 m
    mogła być czynna krócej niż oś 25 m.
40. Jako obsługa strzelnicy, chcę, aby oś bez własnego grafiku dziedziczyła godziny strzelnicy,
    aby nie powielać tych samych ustawień przy każdej osi.
41. Jako obsługa strzelnicy, chcę móc wyłączyć oś z rezerwacji na konkretny czas, aby
    przeprowadzić remont, zawody albo zamknąć obiekt w święto.
42. Jako obsługa strzelnicy, chcę, aby blokada nie kasowała automatycznie istniejących rezerwacji,
    aby żaden klient nie stracił terminu bez mojej wiedzy.
43. Jako obsługa strzelnicy, chcę ustawić własne limity rezerwacji, aby dopasować je do wielkości
    obiektu i ruchu, jaki obsługuję.

### Izolacja strzelnic

44. Jako admin platformy, chcę, aby dane każdej strzelnicy były odseparowane, aby jedna strzelnica
    nie mogła zobaczyć ani zmienić danych drugiej.
45. Jako admin platformy, chcę, aby limity rezerwacji liczyły się osobno w każdej strzelnicy, aby
    rezerwacja w jednym obiekcie nie odbierała możliwości rezerwacji w drugim.
46. Jako admin platformy, chcę, aby odwołanie do nieistniejącej strzelnicy dawało czytelny błąd,
    aby literówka w adresie nie kończyła się pustym ekranem.

### Uruchomienie lokalne

47. Jako autor projektu, chcę uruchomić całość jedną komendą, aby nie odtwarzać konfiguracji
    za każdym razem.
48. Jako autor projektu, chcę mieć dane startowe z dwiema strzelnicami, aby móc naocznie
    sprawdzić, że izolacja działa.
49. Jako autor projektu, chcę mieć lokalną stronę udającą witrynę strzelnicy, aby zobaczyć widget
    w prawdziwym osadzeniu z innego źródła, a nie tylko na własnej stronie.
50. Jako autor projektu, chcę móc skasować plik bazy i odtworzyć dane startowe, aby wrócić
    do czystego stanu po eksperymentach.

## Implementation Decisions

### Moduły

- **Dostęp do danych** — jedyne miejsce, które zna SQL i schemat bazy. Wystawia operacje w języku
  domeny (osie strzelnicy, rezerwacje strzelca, blokady w zakresie dat), nie generyczne CRUD-y.
  Reszta systemu nie wie, że pod spodem jest SQLite. Wynika z ADR 0004: powrót do Postgresa
  ma być wymianą tego modułu, nie przepisaniem aplikacji.
- **Reguły dostępności** — czysta logika wyliczająca dostępność osi w zakresie dat z grafiku,
  blokad i rezerwacji. Bez wejścia do bazy i bez odczytu zegara systemowego; dostaje dane
  i „teraz" jako argumenty.
- **Reguły rezerwacji** — walidacja złożenia i anulowania: ciągłość slotów, wolność wszystkich
  slotów, horyzont, limity strzelca, okno anulowania, własność rezerwacji.
- **Uwierzytelnianie** — rejestracja, logowanie, sesja. Hasła hashowane, sesja w ciasteczku
  `HttpOnly`. Świadomie na poziomie „test lokalny" (ADR 0004).
- **Serwer HTTP** — cienka warstwa: uwierzytelnia żądanie, ustala kontekst strzelnicy, woła
  reguły, mapuje wynik na kody odpowiedzi. Bez logiki domenowej.
- **Aplikacja przeglądarkowa** — jedna aplikacja Vite z trasą widgetu, trasami strzelca
  i stroną-atrapą strzelnicy serwowaną z osobnego portu.

### Schemat

Byty: **strzelnica** (slug, nazwa, domyślne godziny, limity, dozwolone domeny osadzenia),
**oś** (przynależna strzelnicy, nazwa, dystans), **grafik** (per oś, per dzień tygodnia, godzina
od–do; brak wpisów = dziedziczenie ze strzelnicy), **blokada** (per oś, zakres czasu, powód
widoczny tylko wewnętrznie), **strzelec** (e-mail, hash hasła, imię, nazwisko, telefon),
**rezerwacja** (strzelnica, oś, strzelec, początek, koniec, status).

Rezerwacja przechowuje **zakres** (początek i koniec), nie listę slotów — slot jest jednostką
prezentacji i walidacji, nie zapisu. Baza wymusza brak nakładania się aktywnych rezerwacji
na tej samej osi; to ostatnia linia obrony przed wyścigiem dwóch równoczesnych żądań, niezależna
od sprawdzenia w kodzie.

Czas przechowywany w UTC, prezentowany w `Europe/Warsaw`. Strefa jest przy prezentacji, nie
w bazie — granice grafiku definiuje się w czasie lokalnym strzelnicy i przelicza przy odczycie,
inaczej zmiana czasu przesunie godziny otwarcia.

Statusy rezerwacji: **potwierdzona** i **anulowana**. Nie ma statusu oczekującej (ADR 0003:
rezerwacja jest wiążąca od razu) ani niestawienia się (brak płatności czyni go martwym polem).

### Kontrakt API

- **Publiczne, bez uwierzytelnienia**: dane strzelnicy po slugu (nazwa, osie) oraz dostępność
  osi w zakresie dat. Odpowiedź dostępności zawiera wyłącznie oś, slot i stan wolny/niedostępny —
  **nigdy** identyfikatora rezerwacji, strzelca ani powodu blokady. Blokada i rezerwacja są
  w niej nierozróżnialne (ADR 0002).
- **Dla zalogowanego strzelca**: rejestracja, logowanie, wylogowanie, lista własnych rezerwacji,
  złożenie rezerwacji, anulowanie rezerwacji.
- Każde żądanie dotyczące strzelnicy niesie jej slug; przynależność zasobu do strzelnicy jest
  sprawdzana po stronie serwera przy każdym żądaniu, nie ufamy identyfikatorowi z wejścia.
- Odmowy mają rozróżnialne przyczyny (termin zajęty, limit wyczerpany, poza horyzontem, za późno
  na anulowanie, nie Twoja rezerwacja), bo każda prowadzi do innego komunikatu i innego zachowania
  interfejsu.
- Odmowa dostępu do cudzej rezerwacji nie zdradza, czy ta rezerwacja istnieje.

### Widget i osadzenie

Widget to trasa aplikacji renderowana w trybie bez nagłówka, ładowana przez `<iframe>` ze strony
strzelnicy. Nagłówki odpowiedzi ograniczają osadzanie do domen zadeklarowanych przez strzelnicę
(historia 36). Wysokość ramki dostraja się komunikatem od widgetu do strony osadzającej.
Kliknięcie slotu wykonuje nawigację **całego okna** na stronę aplikacji z wybranym terminem
w adresie — nie nawigację wewnątrz ramki (ADR 0002). Widget nie odczytuje i nie zapisuje sesji.

### Zegar

„Teraz" jest jawnym wejściem do reguł dostępności i rezerwacji, dostarczanym przez serwer.
Żaden moduł domenowy nie czyta zegara systemowego samodzielnie — inaczej okna 24 h i horyzontu
30 dni nie da się przetestować deterministycznie.

### Limity

Horyzont 30 dni, maks. 3 aktywne rezerwacje, maks. 2 sloty w jednym dniu — wartości domyślne,
przechowywane per strzelnica i liczone osobno dla każdej. Egzekwowane w serwerze; walidacja
w interfejsie jest wyłącznie uprzejmością wobec użytkownika (ADR 0005).

### Etap 1 a zarządzanie

Osie, grafiki, blokady i limity wchodzą do bazy przez migracje i dane startowe. Panel strzelnicy
do ich edycji jest etapem 2 — reguły muszą je jednak honorować już teraz, bo to one są testowane.

## Testing Decisions

### Czym jest dobry test w tym projekcie

Testem jest żądanie HTTP i sprawdzenie odpowiedzi. Test opisuje, co system **robi** dla aktora
z listy user stories, nie jak jest zbudowany w środku. Test nie zagląda do bazy, aby zweryfikować
skutek — sprawdza go kolejnym żądaniem, tak jak zrobiłby to klient. Nazwy testów mówią językiem
glosariusza: „nie pozwala zarezerwować osi, gdy w tym slocie jest blokada", nie „zwraca 409".

Test, który trzeba poprawić po zmianie nazwy funkcji albo kształtu tabeli, jest testem złym
i zostanie odrzucony w przeglądzie.

### Szwy

**Szew główny — HTTP API.** Testy startują serwer podpięty do świeżej bazy i wysyłają prawdziwe
żądania. Przez ten szew przechodzi cała logika domenowa razem z autoryzacją, bo to właśnie
na styku reguły i autoryzacji powstają błędy, których osobne testy jednostkowe nie widzą.

**Szew pomocniczy — zegar.** Jedyne wstrzyknięcie: test podaje „teraz", aby okno 24 h i horyzont
30 dni były sprawdzalne bez czekania i bez losowych porażek o północy.

Świadomie odrzucone: testy warstwy dostępu do danych (sprawdzałyby reguły w oderwaniu
od autoryzacji), testy interfejsu w przeglądarce (poza zakresem — ustalenie o zerowych testach UI),
testy jednostkowe wewnętrznych funkcji (przywiązują testy do kształtu kodu).

### Co jest pokryte

- **Dostępność**: slot poza grafikiem osi jest nieobecny; oś bez własnego grafiku dziedziczy
  godziny strzelnicy; slot z blokadą i slot z rezerwacją są nieodróżnialne; slot w przeszłości
  nie jest oferowany; poza horyzontem nie ma dni.
- **Składanie rezerwacji**: kilka sąsiadujących slotów tworzy jedną rezerwację; sloty nieprzylegające
  są odrzucane; slot już zajęty jest odrzucany; slot pod blokadą jest odrzucany; termin poza
  horyzontem jest odrzucany.
- **Limity**: przekroczenie liczby aktywnych rezerwacji, przekroczenie liczby slotów dziennie,
  oraz — osobno — fakt, że limity liczą się niezależnie w każdej strzelnicy.
- **Anulowanie**: wcześniej niż 24 h przed jest dozwolone; później odrzucone; anulowanie zwalnia
  slot, co potwierdza kolejne zapytanie o dostępność; nie da się anulować cudzej ani minionej
  rezerwacji.
- **Izolacja strzelnic**: rezerwacja jednej strzelnicy nie pojawia się w dostępności drugiej; nie
  da się zarezerwować osi, podając slug innej strzelnicy; nieistniejący slug daje czytelny błąd.
- **Prywatność publicznego wejścia**: odpowiedź o dostępności nie zawiera żadnych danych strzelca
  ani powodu blokady, także dla użytkownika zalogowanego.
- **Uwierzytelnianie**: nie da się złożyć ani anulować rezerwacji bez sesji; powtórna rejestracja
  na ten sam e-mail jest odrzucana.

### Prior art

Brak — to pierwszy kod w repozytorium. Kształt ustalony tym spekiem staje się wzorcem dla
kolejnych testów: żądanie i odpowiedź, dane budowane przez API tam, gdzie się da, a dane startowe
tylko dla tego, czego etap 1 nie pozwala jeszcze utworzyć (osie, grafiki, blokady).

## Out of Scope

- **Panel strzelnicy** do zarządzania osiami, grafikiem, blokadami i limitami — etap 2. W etapie 1
  dane te pochodzą z migracji i danych startowych.
- **Konsola admina platformy** i zakładanie strzelnic przez interfejs — etap 2.
- **Wdrożenie i hosting.** Aplikacja działa wyłącznie lokalnie (ADR 0004). Nie ma konfiguracji
  wdrożeniowej ani publicznego adresu.
- **Płatności, kaucje, cennik** — w tym cennik wyłącznie informacyjny (ADR 0005).
- **Powiadomienia e-mail i SMS**, w tym potwierdzenie rezerwacji i przypomnienie o terminie.
  Konsekwencja: odzyskiwanie hasła również odpada, bo nie ma czym wysłać wiadomości.
- **Rezerwacja bez konta**, przez gościa.
- **Stanowiska na osi** i przydział numerów stanowisk (ADR 0003).
- **Instruktorzy, uprawnienia strzeleckie, wypożyczanie broni** — poza modelem domeny.
- **Dowolne przedziały czasu** inne niż wielokrotność pełnej godziny (ADR 0003).
- **Wielojęzyczność.** Interfejs po polsku; kod i identyfikatory po angielsku.
- **Testy interfejsu w przeglądarce.**

## Further Notes

Aplikacja jest testowa i uruchamiana wyłącznie na maszynie autora. Uwierzytelnianie powstało
na potrzeby tego testu i **nie jest gotowe do wystawienia w internecie** bez osobnego przeglądu
bezpieczeństwa — brak ograniczania liczby prób logowania, brak polityki haseł, brak odzyskiwania
dostępu.

Widget jest sprawdzany w prawdziwym osadzeniu międzyźródłowym: strona-atrapa strzelnicy działa
na innym porcie niż aplikacja, więc test obejmuje realne zachowanie ramki, nagłówków osadzania
i utraty sesji w kontekście third-party. Osadzenie widgetu na tym samym porcie co aplikacja
uznajemy za test bezwartościowy.

Największym ryzykiem etapu 1 jest krok wyjścia z ramki na stronę aplikacji: to tam spotykają się
osadzenie, sesja i przeniesienie wybranego terminu. Kolejność prac stawia ten krok wcześnie,
przed dopracowywaniem interfejsu.
