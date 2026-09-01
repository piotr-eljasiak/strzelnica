# Angielskie nazwy w kodzie przy polskim glosariuszu

Glosariusz w `CONTEXT.md` jest po polsku, bo domena jest polska i „oś strzelecka" nie ma
zwięzłego angielskiego odpowiednika. Kod, nazwy tabel, kolumn i funkcji są jednak po
angielsku — jak w każdym innym projekcie. Rozważaliśmy polskie identyfikatory, żeby kod
czytał się dokładnie tak jak glosariusz, ale mieszanie polskich nazw z angielskimi słowami
kluczowymi SQL i JavaScriptu daje kod, którego nie da się czytać w żadnym z dwóch języków.

Cena tego wyboru jest realna: między dokumentem a kodem trzeba tłumaczyć. Dlatego mapowanie
jest tutaj, a nie w czyjejś głowie.

## Mapowanie

| Glosariusz (`CONTEXT.md`) | W kodzie                       |
| ------------------------- | ------------------------------ |
| Strzelnica                | `shooting_range`, `range_id`   |
| Oś strzelecka             | `lane`                         |
| Slot                      | `slot`, `booked_slot`          |
| Grafik                    | `range_hours`, `lane_hours`    |
| Blokada                   | `closure`                      |
| Rezerwacja                | `booking`                      |
| Strzelec                  | `shooter`                      |
| Obsługa                   | `staff`                        |
| Dostępność                | `availability`                 |
| Admin platformy           | `platform_admin`               |
| Widget                    | `widget`                       |

Tabela `shooting_range` nie nazywa się `range`, bo `RANGE` jest słowem kluczowym SQL.

## Konsekwencje

- Nowe pojęcie domenowe trafia najpierw do `CONTEXT.md` po polsku, a dopiero potem do tej
  tabeli i do kodu. Nazwa angielska bez wpisu w glosariuszu oznacza, że ktoś wymyślił
  pojęcie, którego projekt nie ma.
- Treści widoczne dla użytkownika i dane domenowe (nazwy osi, powody blokad) pozostają
  po polsku — to dane, nie identyfikatory.
- Komentarze w kodzie są po angielsku, spójnie z kodem; dokumentacja projektowa po polsku.
