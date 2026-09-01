# Wiele strzelnic (multi-tenancy) od pierwszego dnia

Platforma ma obsługiwać wiele niezależnych strzelnic, każdą z własnymi osiami, grafikiem
i rezerwacjami. Rozważaliśmy zbudowanie systemu dla jednej strzelnicy i dołożenie wielodostępności
później, ale doklejenie najemcy do istniejącego schematu oznacza migrację każdej tabeli i przegląd
każdego zapytania. Dlatego strzelnica jest właścicielem wszystkich danych od początku, a każde
zapytanie jest zawężone do jednej strzelnicy.

## Konsekwencje

Dane demonstracyjne zawierają **dwie** strzelnice, nie jedną: przy jednej żaden błąd izolacji
najemców nie ma jak się ujawnić.
