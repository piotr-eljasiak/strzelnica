# Rezerwacje osi strzeleckich

Platforma wielu strzelnic (multi-tenant), w której strzelec rezerwuje całą oś strzelecką na
określony przedział czasu. Każda strzelnica osadza kalendarz rezerwacji na własnej stronie www.

## Język

**Strzelnica**:
Organizacja prowadząca obiekt strzelecki; najemca (tenant) platformy, właściciel własnych osi,
godzin i rezerwacji.
_Unikaj_: obiekt, klub, tenant, klient

**Oś strzelecka**:
Rezerwowany zasób należący do strzelnicy, wyróżniony dystansem (np. oś 25 m). Rezerwowana zawsze
w całości, na wyłączność.
_Unikaj_: tor, stanowisko, lane, strzelnica (w znaczeniu osi)

**Stanowisko**:
Świadomie **poza modelem**. Podział osi na stanowiska jest sprawą wewnętrzną strzelnicy;
platforma nie zna ani nie przydziela stanowisk.

**Slot**:
Godzinny przedział czasu na jednej osi, wyrównany do pełnej godziny — najmniejsza jednostka,
którą można zająć.
_Unikaj_: termin, okienko, przedział

**Grafik**:
Tygodniowy wzorzec godzin, w których dana oś jest otwarta na rezerwacje. Definiowany per oś,
domyślnie dziedziczony z godzin strzelnicy.
_Unikaj_: harmonogram, kalendarz, godziny otwarcia

**Blokada**:
Wyłączenie osi ze sprzedaży w konkretnym czasie z powodu po stronie strzelnicy (święto, zawody,
przerwa techniczna). Zajmuje slot tak jak rezerwacja, ale nie należy do żadnego strzelca.
_Unikaj_: wyjątek, wyłączenie, przerwa

**Gość**:
Osoba bez konta, zapisana na oś przez obsługę (telefonicznie albo przy ladzie). Znana wyłącznie
z imienia i telefonu; nie loguje się i nie anuluje sama.
_Unikaj_: klient bez konta, anonim, walk-in

**Rezerwacja**:
Wyłączne prawo strzelca albo gościa do jednej osi w jednym lub kilku sąsiadujących slotach.
Wiążąca od chwili złożenia — nie wymaga zatwierdzenia przez obsługę.
_Unikaj_: booking, wizyta, termin, zapis

**Strzelec**:
Użytkownik końcowy posiadający konto, składający rezerwacje we własnym imieniu. Kto konta
nie ma, jest **gościem** — te dwa pojęcia nie są wymienne.
_Unikaj_: klient, użytkownik

**Obsługa**:
Osoba działająca w imieniu strzelnicy: zarządza jej osiami, dostępnością i rezerwacjami.
_Unikaj_: admin, pracownik, operator

**Widget**:
Osadzany na stronie www strzelnicy fragment interfejsu, przez który strzelec przegląda dostępność
i rozpoczyna rezerwację. Dostępny anonimowo; domknięcie rezerwacji następuje już poza nim.
_Unikaj_: embed, wtyczka, plugin, iframe

**Dostępność**:
Publiczny obraz zajętości osi: dla każdego slotu wyłącznie „wolny" albo „niedostępny", bez powodu
i bez wskazania strzelca. Blokada i rezerwacja są w nim nieodróżnialne.
_Unikaj_: kalendarz, wolne terminy, obłożenie

**Admin platformy**:
Osoba zarządzająca zbiorem strzelnic: zakłada strzelnicę i nadaje dostęp jej obsłudze. Nie
uczestniczy w rezerwacjach.
_Unikaj_: superadmin, root, właściciel

**Instruktor**:
Świadomie **poza modelem**. Nadzór instruktorski, patenty i wypożyczanie broni pozostają poza
platformą i nie wpływają na dostępność osi.

**Konto obsługi**:
Dostęp obsługi do panelu jednej strzelnicy. Odrębne od konta strzelca: ta sama osoba
potrzebuje obu, jeśli chce i pracować, i strzelać.
_Unikaj_: konto pracownika, rola, uprawnienia

**Panel**:
Interfejs, w którym obsługa zarządza osiami, grafikiem, blokadami i rezerwacjami swojej
strzelnicy.
_Unikaj_: admin, backoffice, kokpit
