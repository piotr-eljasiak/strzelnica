# Panel strzelnicy — etap 2

> Opublikowany jako [issue #2](https://github.com/piotr-eljasiak/strzelnica/issues/2)
> z etykietą `ready-for-agent`.

## Problem Statement

Po etapie 1 strzelnica jest w systemie, ale nic w niej nie może zmienić. Osie, godziny
otwarcia, blokady i limity wchodzą do bazy przez dane startowe, więc każda zmiana —
dołożenie osi, skrócenie soboty, wyłączenie toru na remont — wymaga programisty. Obsługa
nie widzi też, kto ma przyjść i pod jaki numer zadzwonić, gdy coś się posypie, mimo że
strzelec podał telefon właśnie po to.

## Solution

Panel dla obsługi strzelnicy: własne logowanie, lista nadchodzących rezerwacji z danymi
kontaktowymi, zarządzanie osiami i grafikiem, zakładanie blokad oraz zmiana limitów.
Wszystko zawężone do jednej strzelnicy — tej, do której należy zalogowane konto.

Strzelnice i konta obsługi zakłada admin platformy z linii poleceń, a nie przez trzeci
interfejs webowy zbudowany dla jednej osoby.

## User Stories

### Dostęp

1. Jako obsługa strzelnicy, chcę logować się osobnym kontem, aby moje uprawnienia nie
   zależały od tego, czy jestem też czyimś klientem.
2. Jako obsługa strzelnicy, chcę widzieć wyłącznie swoją strzelnicę, aby nie móc przez
   pomyłkę zmienić czegoś u konkurencji.
3. Jako admin platformy, chcę mieć pewność, że sesja strzelca nie otwiera panelu, aby
   pomyłka w jednym punkcie API nie odsłaniała danych osobowych.
4. Jako admin platformy, chcę, aby sesja obsługi nie dawała dostępu do rezerwacji strzelca,
   aby oba światy pozostały rozdzielone w obie strony.
5. Jako obsługa strzelnicy, chcę się wylogować, aby zakończyć pracę na wspólnym komputerze.

### Rezerwacje

6. Jako obsługa strzelnicy, chcę widzieć listę nadchodzących rezerwacji, aby wiedzieć,
   kogo się spodziewać.
7. Jako obsługa strzelnicy, chcę widzieć imię, nazwisko i telefon strzelca, aby zadzwonić,
   gdy coś się zmieni.
8. Jako obsługa strzelnicy, chcę widzieć, ile godzin obejmuje rezerwacja, aby zaplanować
   zajętość osi.
9. Jako obsługa strzelnicy, chcę anulować rezerwację także wtedy, gdy strzelec już nie
   może, aby móc reagować na awarie w ostatniej chwili.
10. Jako obsługa strzelnicy, chcę podać powód anulowania, aby następna osoba przy ladzie
    wiedziała, co się stało.
11. Jako strzelec, chcę, aby anulowany przez strzelnicę termin natychmiast wrócił do puli
    wolnych, aby ktoś inny mógł z niego skorzystać.

### Osie

12. Jako obsługa strzelnicy, chcę dodać oś, aby wystawić do rezerwacji nowo otwarty tor.
13. Jako obsługa strzelnicy, chcę, aby nowa oś była widoczna publicznie od razu, aby nie
    czekać na czyjekolwiek zatwierdzenie.
14. Jako obsługa strzelnicy, chcę zostać powstrzymany przed dodaniem drugiej osi o tej
    samej nazwie, aby klient nie musiał zgadywać, którą wybiera.
15. Jako obsługa strzelnicy, chcę usunąć oś, której już nie ma.
16. Jako obsługa strzelnicy, chcę, aby system odmówił usunięcia osi z przyszłymi
    rezerwacjami, aby nie skasować cudzych terminów jednym kliknięciem.

### Grafik

17. Jako obsługa strzelnicy, chcę ustawić godziny otwarcia obiektu na każdy dzień tygodnia,
    aby kalendarz pokazywał prawdę.
18. Jako obsługa strzelnicy, chcę oznaczyć dzień jako zamknięty, aby niedziela nie
    pojawiała się w ofercie.
19. Jako obsługa strzelnicy, chcę nadać osi własny grafik, aby tor 100 m mógł być czynny
    krócej niż reszta obiektu.
20. Jako obsługa strzelnicy, chcę przywrócić osi dziedziczenie godzin obiektu, odznaczając
    wszystkie dni, aby nie utrzymywać dwóch kopii tych samych godzin.
21. Jako obsługa strzelnicy, chcę, aby system odrzucił dzień kończący się przed
    rozpoczęciem, aby literówka nie wyprodukowała pustego kalendarza.
22. Jako obsługa strzelnicy, chcę widzieć przy każdej osi, czy ma własny grafik, czy
    dziedziczony, aby wiedzieć, gdzie zmieniać godziny.

### Blokady

23. Jako obsługa strzelnicy, chcę wyłączyć oś na konkretny czas, aby przeprowadzić remont
    albo zawody.
24. Jako obsługa strzelnicy, chcę podać powód blokady, aby zespół wiedział, co się dzieje.
25. Jako obsługa strzelnicy, chcę, aby powód nigdy nie był widoczny publicznie, aby nie
    ujawniać spraw wewnętrznych obiektu.
26. Jako obsługa strzelnicy, chcę zobaczyć listę rezerwacji, które blokada obejmuje, zanim
    ją założę, aby wiedzieć, do kogo muszę zadzwonić.
27. Jako obsługa strzelnicy, chcę, aby założenie blokady **nie** anulowało tych rezerwacji,
    aby nikt nie stracił terminu bez mojej świadomej decyzji.
28. Jako obsługa strzelnicy, chcę zdjąć blokadę, gdy remont się skończy.
29. Jako obsługa strzelnicy, chcę podawać godziny blokady w czasie lokalnym obiektu, aby
    nie przeliczać stref w głowie.

### Ustawienia i widget

30. Jako obsługa strzelnicy, chcę zmienić horyzont rezerwacji, aby dopasować go do tego,
    jak daleko planuję.
31. Jako obsługa strzelnicy, chcę zmienić limity strzelca, aby dopasować je do wielkości
    obiektu.
32. Jako obsługa strzelnicy, chcę, aby zmienione limity obowiązywały natychmiast.
33. Jako obsługa strzelnicy, chcę zmienić okno anulowania, aby dopasować je do swojej
    polityki.
34. Jako obsługa strzelnicy, chcę zmienić telefon kontaktowy, bo to on trafia do strzelca,
    gdy na anulowanie jest za późno.
35. Jako obsługa strzelnicy, chcę skopiować gotowy fragment kodu widgetu, aby wkleić go na
    swoją stronę bez pomocy programisty.
36. Jako obsługa strzelnicy, chcę zobaczyć, którym stronom wolno osadzić mój widget, aby
    wiedzieć, czy lista jest aktualna.

### Admin platformy

37. Jako admin platformy, chcę dodać strzelnicę z linii poleceń, aby nie budować trzeciego
    interfejsu dla jednego użytkownika.
38. Jako admin platformy, chcę, aby nowa strzelnica miała od razu sensowne godziny, aby
    była używalna, zanim obsługa cokolwiek ustawi.
39. Jako admin platformy, chcę dodać konto obsługi do wskazanej strzelnicy.
40. Jako admin platformy, chcę dopisać stronę uprawnioną do osadzenia widgetu.
41. Jako admin platformy, chcę wypisać stan systemu jedną komendą, aby sprawdzić, co
    istnieje, bez zaglądania do bazy.

## Implementation Decisions

### Tożsamość obsługi

Obsługa to osobna tabela, osobne logowanie i osobne ciasteczko sesji, nie rola dopisana do
strzelca — powody i konsekwencje w ADR 0008. Sesje obu rodzajów mogą istnieć równolegle
w jednej przeglądarce i żadna nie zastępuje drugiej.

Konto obsługi należy do dokładnie jednej strzelnicy. **Żadna operacja panelu nie przyjmuje
identyfikatora strzelnicy z żądania** — wynika on z zalogowanego konta, więc nie istnieje
argument, którym dałoby się sięgnąć gdzie indziej.

### Zasób obcej strzelnicy to 404, nie 403

Oś, blokada i rezerwacja spoza własnej strzelnicy są zgłaszane jako nieistniejące. Kod 403
potwierdzałby ich istnienie i pozwalał odmapować cudzy obiekt przez strzelanie
identyfikatorami. Ta sama zasada, co przy cudzej rezerwacji strzelca w etapie 1.

### Blokada nigdy nie anuluje rezerwacji

Zgodne z ustaleniem z wywiadu (wariant β). Pierwsza próba założenia kolidującej blokady
jest odrzucana i zwraca listę rezerwacji wraz z danymi kontaktowymi. Powtórzenie żądania
z potwierdzeniem zakłada blokadę i **zostawia rezerwacje nietknięte** — ich zwolnienie
pozostaje osobną, świadomą czynnością obsługi.

To samo rozumowanie zabrania usunięcia osi z przyszłymi rezerwacjami: kasowanie osi
skasowałoby je kaskadowo.

### Grafik zapisywany całym tygodniem

Zapis grafiku podmienia cały tydzień naraz, a nie dzień po dniu. Pusty tydzień oznacza
powrót do dziedziczenia godzin strzelnicy — dzięki temu „dziedziczy" i „ma własny, ale
pusty" nie są dwoma różnymi stanami, których nie dałoby się rozróżnić w interfejsie.

### Anulowanie przez obsługę

Okno 24 godzin wiąże strzelca, nie strzelnicę: obsługa może zwolnić dowolną rezerwację
u siebie w dowolnym momencie. Wymagana jest notatka z powodem, zapisywana razem
z identyfikatorem osoby, która anulowała — inaczej po tygodniu nikt nie wie, czemu termin
zniknął.

### Admin platformy jako narzędzie wiersza poleceń

Zakładanie strzelnic i kont obsługi odbywa się skryptem, nie przez interfejs webowy.
Uzasadnienie jest to samo, co przy Q13: strzelnic będzie kilka, a nie kilkaset, a konsola
webowa dla jednego użytkownika to tygodnie pracy plus trzecia powierzchnia do zabezpieczenia.
Skrypt działa wyłącznie z maszyny, na której leży baza.

## Testing Decisions

Ten sam szew co w etapie 1: żądania HTTP do serwera na świeżej bazie w pamięci, zegar jako
argument. Panel nie dostaje własnego rodzaju testu — jest po prostu kolejnym zestawem
punktów API.

Pokryte w szczególności:

- **Izolacja**: obsługa jednej strzelnicy nie edytuje osi, nie zakłada blokady i nie
  anuluje rezerwacji drugiej; nie widzi też jej rezerwacji na liście.
- **Rozdział sesji**: sesja strzelca nie otwiera panelu, sesja obsługi nie otwiera punktów
  strzelca. Sprawdzane w obie strony, bo pomyłka w jedną stronę jest równie łatwa.
- **Blokada a rezerwacje**: kolizja jest zgłaszana z listą osób; po potwierdzeniu blokada
  powstaje, a rezerwacja pozostaje potwierdzona.
- **Grafik**: zmiana grafiku osi widać w publicznej dostępności; pusty tydzień przywraca
  dziedziczenie; dzień „od 18 do 9" jest odrzucany.
- **Limity**: zmiana limitu w panelu wiąże strzelca przy najbliższej rezerwacji.
- **Prywatność**: powód blokady nie pojawia się w publicznej dostępności.

## Out of Scope

- **Rejestracja samoobsługowa strzelnic** — strzelnice zakłada admin platformy (Q13).
- **Konsola webowa admina platformy** — zastąpiona skryptem.
- **Rezerwacja w imieniu klienta** przez obsługę, np. przyjęta telefonicznie.
- **Historia zmian** w panelu: kto zmienił grafik i kiedy. Zapisujemy tylko autora
  anulowania, bo tylko ono dotyka cudzych danych.
- **Konto obsługi w kilku strzelnicach** — jedno konto, jedna strzelnica.
- **Odzyskiwanie hasła obsługi** — nie ma poczty (ADR 0005); hasło resetuje admin skryptem.
- **Płatności, powiadomienia, instruktorzy, stanowiska** — nadal poza zakresem (ADR 0005).

## Further Notes

Panel jest trzecią powierzchnią aplikacji obok widgetu i ekranów strzelca, ale nie trzecim
wdrożeniem: to trasa `/panel` w tej samej aplikacji, ładowana leniwie i pomijająca całą
logikę sesji strzelca.

Uwaga o bezpieczeństwie z ADR 0004 obowiązuje tym mocniej: panel pokazuje dane osobowe
klientów strzelnicy. Uwierzytelnianie nadal nie ma limitu prób logowania ani polityki
haseł i nie nadaje się do wystawienia w internecie bez osobnego przeglądu.
