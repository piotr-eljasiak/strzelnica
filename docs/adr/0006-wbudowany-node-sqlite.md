# Wbudowany moduł `node:sqlite` zamiast `better-sqlite3`

Warstwa dostępu do danych używa modułu `node:sqlite` z biblioteki standardowej Node.js, a nie
powszechniejszego `better-sqlite3`. Powód jest praktyczny: `better-sqlite3` to dodatek natywny,
który przy braku pasującej prekompilacji kompiluje się ze źródeł, a na maszynie, na której ten
projekt powstaje, nie ma ani kompilatora C++, ani narzędzi budowania Visual Studio. Moduł
wbudowany działa od razu, nie wymaga instalacji i sprawia, że projekt nie ma ani jednej
zależności produkcyjnej.

## Konsekwencje

- `node:sqlite` jest oznaczony jako niestabilny i wymaga Node.js w wersji co najmniej 22.5;
  `package.json` zapisuje ten wymóg. Zmiana API między wersjami Node jest realnym ryzykiem.
- Interfejs jest synchroniczny, co dla aplikacji uruchamianej lokalnie przez jedną osobę jest
  zaletą: kod czyta się liniowo, a transakcje nie wymagają koordynacji.
- Wymiana na inny sterownik dotyka wyłącznie modułu dostępu do danych (ADR 0004).
