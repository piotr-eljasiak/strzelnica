# Rezerwacja przyjęta przez obsługę i rezerwacja bez konta

Obsługa może zapisać klienta, który zadzwonił albo stoi przy ladzie. Pociąga to dwie
zmiany, z których pierwsza częściowo cofa [ADR 0005](./0005-zakres-pierwszej-wersji.md).

## Rezerwacja może nie mieć konta

Dzwoniący zwykle konta nie ma i nie chce zakładać. Rezerwacja może więc należeć do **konta
strzelca** albo do **gościa** znanego z imienia i telefonu; nigdy do obu i nigdy do żadnego
— pilnują tego warunki w schemacie, żeby pytanie „czyja to rezerwacja" zawsze miało
odpowiedź, na której kod może polegać.

To nie jest przywrócenie rezerwacji gościa z ADR 0005. Tamta oznaczała, że **ktokolwiek**
z internetu rezerwuje bez konta. Ta jest zawsze przyjęta przez konkretną osobę z obsługi,
której identyfikator jest zapisany przy rezerwacji. Odpowiedzialność ma właściciela.

Konsekwencja, którą trzeba znać: gość nie zobaczy swojej rezerwacji w „Moje rezerwacje"
i nie anuluje jej sam — nie ma konta, przez które mógłby to zrobić. Zwolnić termin może
tylko obsługa.

## Wyszukiwanie stałych klientów jest zawężone do własnej strzelnicy

Obsługa może zapisać rezerwację na istniejące konto, ale wyszukiwarka pokazuje wyłącznie
osoby, które **już rezerwowały w tej strzelnicy** — czyli takie, których dane obsługa i tak
zna z ich wcześniejszych wizyt. Przeszukiwanie wszystkich kont platformy zamieniłoby panel
w katalog klientów konkurencji i przeczyłoby [ADR 0001](./0001-multi-tenancy-od-poczatku.md)
oraz [ADR 0008](./0008-obsluga-jako-osobny-byt.md).

Z tego samego powodu podanie identyfikatora konta, którego ta strzelnica nie zna, jest
odrzucane jako „nie znaleziono" — inaczej dałoby się doczepić rezerwację dowolnemu
nieznajomemu, zgadując liczbę.

## Co obsługa może obejść, a czego nie

Obsługa może pominąć **limity strzelca** (horyzont, liczba aktywnych rezerwacji, godziny
dziennie) i — po wyraźnym potwierdzeniu — **godziny otwarcia**. Limity chronią przed
anonimowym nadużyciem, a rezerwacja przyjęta przez człowieka z definicji nie jest anonimowa;
strzelnice zaś realnie otwierają się poza harmonogramem dla grupy.

Obsługa **nie może** obejść zajętego slotu, blokady ani terminu z przeszłości. To nie są
polityki, tylko fakty: dwie osoby nie zmieszczą się na jednej osi, a jeśli oś jest wyłączona
z powodu remontu, właściwą czynnością jest zdjęcie blokady, nie ominięcie jej. Blokada,
którą wolno obchodzić, przestaje cokolwiek znaczyć.

Rozróżnienie jest widoczne w kodzie: reguły przyjmują listę rzeczy do odpuszczenia, a to,
czego na niej nie ma, obowiązuje wszystkich jednakowo.
