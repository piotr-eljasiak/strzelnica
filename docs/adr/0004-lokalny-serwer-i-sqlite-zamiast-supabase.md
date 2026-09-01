# Lokalny serwer i SQLite zamiast Supabase

Projekt był zaprojektowany pod Supabase (Postgres, RLS jako granica prywatności, wbudowane
uwierzytelnianie), ale docelowo ma to być aplikacja testowa uruchamiana wyłącznie na komputerze
autora, bez zakładania kont w chmurze. Dlatego dane trzyma lokalny serwer z bazą SQLite w pliku,
a uwierzytelnianie (e-mail i hasło, sesja w ciasteczku) i autoryzacja są realizowane w kodzie
serwera. Odrzuciliśmy trzymanie danych w przeglądarce, bo widget działa w innym źródle niż
aplikacja i nie zobaczyłby złożonych rezerwacji — testowalibyśmy wygląd zamiast działania.

## Konsekwencje

- Reguły, które w Supabase pilnowałoby RLS — izolacja strzelnic i limity strzelca — muszą być
  egzekwowane w serwerze. Walidacja w interfejsie nie jest zabezpieczeniem.
- Dostęp do danych zostaje odizolowany za jedną warstwą, żeby powrót do Postgresa nie oznaczał
  przepisywania aplikacji.
- Uwierzytelnianie powstało na potrzeby testu lokalnego i nie jest gotowe do wystawienia
  w internecie bez osobnego przeglądu.
