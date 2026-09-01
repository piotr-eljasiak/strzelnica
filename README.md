# Rezerwacja osi strzeleckich

Platforma, w której strzelec rezerwuje całą oś strzelecką na godzinne sloty, a strzelnica
osadza kalendarz na własnej stronie www. Obsługuje wiele strzelnic naraz.

**Aplikacja testowa** — działa wyłącznie lokalnie, nie jest przygotowana do wystawienia
w internecie (patrz [ADR 0004](docs/adr/0004-lokalny-serwer-i-sqlite-zamiast-supabase.md)).

## Uruchomienie

Wymagany Node.js 22.5 lub nowszy (używamy wbudowanego `node:sqlite`).

```bash
npm install
```

```bash
npm run db:reset
```

```bash
npm run dev
```

Trzy procesy wstają razem:

| Adres | Co to |
| --- | --- |
| http://localhost:5174 | udawana strona strzelnicy z **osadzonym widgetem** — zacznij tutaj |
| http://localhost:5173 | aplikacja: finalizacja rezerwacji, moje rezerwacje |
| http://localhost:3000 | API |

Konto testowe: `strzelec@example.com` / `strzelec123`.

> **Windows PowerShell:** jeśli `npm` kończy się błędem `running scripts is disabled on
> this system`, użyj `npm.cmd` zamiast `npm` — albo pomiń npm i uruchom wprost
> `node tools/dev.js`. Nie trzeba zmieniać polityki wykonywania skryptów.

Widget i aplikacja stoją na różnych portach **celowo**: tylko wtedy ramka jest naprawdę
kontekstem third-party i test osadzenia coś znaczy.

## Testy

```bash
npm test
```

Wszystkie testy rozmawiają z systemem przez HTTP i nigdy nie zaglądają do bazy, żeby
sprawdzić skutek — pytają API tak, jak zrobiłby to klient.

## Dane startowe

Dwie strzelnice, bo przy jednej żaden błąd izolacji nie ma jak się ujawnić:

- **Tarczownia** — oś 25 m (dziedziczy godziny strzelnicy, 9–20), oś 100 m (własny grafik
  10–18), horyzont 30 dni, 3 aktywne rezerwacje, 2 sloty dziennie
- **Bemowo** — oś 25 m, oś 50 m z blokadą „Zawody klubowe" w najbliższą sobotę,
  horyzont 14 dni, 2 aktywne rezerwacje, 4 sloty dziennie

## Dokumentacja

- [CONTEXT.md](CONTEXT.md) — glosariusz domeny; kod używa nazw angielskich,
  mapowanie jest w [ADR 0007](docs/adr/0007-angielskie-nazwy-w-kodzie.md)
- [docs/adr/](docs/adr/) — decyzje projektowe wraz z powodami
- [docs/specs/](docs/specs/) — spec etapu 1 (także jako
  [issue #1](https://github.com/piotr-eljasiak/strzelnica/issues/1))

## Czego świadomie nie ma

Płatności, cennika, powiadomień e-mail, instruktorów, stanowisk na osi, rezerwacji bez
konta oraz panelu strzelnicy. Powody w
[ADR 0005](docs/adr/0005-zakres-pierwszej-wersji.md).
