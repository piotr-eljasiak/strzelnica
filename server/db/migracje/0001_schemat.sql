-- Schemat początkowy: strzelnice, osie, grafiki, blokady, strzelcy, rezerwacje.
--
-- Czas: znaczniki bezwzględne trzymamy w UTC jako ISO 8601 ('2026-03-14T09:00:00Z').
-- Godziny grafiku trzymamy jako liczby godzin w czasie lokalnym strzelnicy, bo to one
-- definiują otwarcie obiektu — przechowywane w UTC przesunęłyby się przy zmianie czasu.

CREATE TABLE strzelnica (
  id                       INTEGER PRIMARY KEY,
  slug                     TEXT    NOT NULL UNIQUE,
  nazwa                    TEXT    NOT NULL,
  telefon                  TEXT    NOT NULL,
  strefa_czasowa           TEXT    NOT NULL DEFAULT 'Europe/Warsaw',
  horyzont_dni             INTEGER NOT NULL DEFAULT 30 CHECK (horyzont_dni > 0),
  max_aktywnych_rezerwacji INTEGER NOT NULL DEFAULT 3  CHECK (max_aktywnych_rezerwacji > 0),
  max_slotow_dziennie      INTEGER NOT NULL DEFAULT 2  CHECK (max_slotow_dziennie > 0),
  okno_anulowania_godzin   INTEGER NOT NULL DEFAULT 24 CHECK (okno_anulowania_godzin >= 0)
);

-- Domeny, którym wolno osadzić widget tej strzelnicy (nagłówek frame-ancestors).
CREATE TABLE domena_osadzenia (
  strzelnica_id INTEGER NOT NULL REFERENCES strzelnica(id) ON DELETE CASCADE,
  domena        TEXT    NOT NULL,
  PRIMARY KEY (strzelnica_id, domena)
);

CREATE TABLE os (
  id            INTEGER PRIMARY KEY,
  strzelnica_id INTEGER NOT NULL REFERENCES strzelnica(id) ON DELETE CASCADE,
  nazwa         TEXT    NOT NULL,
  dystans_m     INTEGER NOT NULL CHECK (dystans_m > 0),
  UNIQUE (strzelnica_id, nazwa)
);

-- Domyślne godziny otwarcia strzelnicy. Brak wiersza dla dnia = tego dnia zamknięte.
CREATE TABLE godziny_strzelnicy (
  strzelnica_id  INTEGER NOT NULL REFERENCES strzelnica(id) ON DELETE CASCADE,
  dzien_tygodnia INTEGER NOT NULL CHECK (dzien_tygodnia BETWEEN 0 AND 6), -- 0 = niedziela
  godzina_od     INTEGER NOT NULL CHECK (godzina_od BETWEEN 0 AND 23),
  godzina_do     INTEGER NOT NULL CHECK (godzina_do BETWEEN 1 AND 24),
  PRIMARY KEY (strzelnica_id, dzien_tygodnia),
  CHECK (godzina_do > godzina_od)
);

-- Grafik osi. Oś bez ani jednego wiersza tutaj dziedziczy godziny strzelnicy.
-- Oś, która ma choć jeden wiersz, definiuje swój tydzień w całości: dzień bez wiersza
-- oznacza dla niej zamknięcie, a nie powrót do dziedziczenia.
CREATE TABLE godziny_osi (
  os_id          INTEGER NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  dzien_tygodnia INTEGER NOT NULL CHECK (dzien_tygodnia BETWEEN 0 AND 6),
  godzina_od     INTEGER NOT NULL CHECK (godzina_od BETWEEN 0 AND 23),
  godzina_do     INTEGER NOT NULL CHECK (godzina_do BETWEEN 1 AND 24),
  PRIMARY KEY (os_id, dzien_tygodnia),
  CHECK (godzina_do > godzina_od)
);

CREATE TABLE strzelec (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  hash_hasla    TEXT NOT NULL,
  imie          TEXT NOT NULL,
  nazwisko      TEXT NOT NULL,
  telefon       TEXT NOT NULL,
  utworzony_utc TEXT NOT NULL
);

-- Wyłączenie osi ze sprzedaży. Powód jest wewnętrzny i nigdy nie trafia do dostępności.
CREATE TABLE blokada (
  id           INTEGER PRIMARY KEY,
  os_id        INTEGER NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  poczatek_utc TEXT    NOT NULL,
  koniec_utc   TEXT    NOT NULL,
  powod        TEXT    NOT NULL,
  CHECK (koniec_utc > poczatek_utc)
);

CREATE INDEX idx_blokada_os_czas ON blokada (os_id, poczatek_utc, koniec_utc);

CREATE TABLE rezerwacja (
  id            INTEGER PRIMARY KEY,
  strzelnica_id INTEGER NOT NULL REFERENCES strzelnica(id) ON DELETE CASCADE,
  os_id         INTEGER NOT NULL REFERENCES os(id)         ON DELETE CASCADE,
  strzelec_id   INTEGER NOT NULL REFERENCES strzelec(id)   ON DELETE CASCADE,
  poczatek_utc  TEXT    NOT NULL,
  koniec_utc    TEXT    NOT NULL,
  status        TEXT    NOT NULL CHECK (status IN ('potwierdzona', 'anulowana')),
  utworzona_utc TEXT    NOT NULL,
  anulowana_utc TEXT,
  CHECK (koniec_utc > poczatek_utc),
  CHECK ((status = 'anulowana') = (anulowana_utc IS NOT NULL))
);

CREATE INDEX idx_rezerwacja_strzelec ON rezerwacja (strzelec_id, status);
CREATE INDEX idx_rezerwacja_os_czas   ON rezerwacja (os_id, poczatek_utc);

-- Zajęte sloty potwierdzonych rezerwacji. Rezerwacja pozostaje zakresem — ta tabela jest
-- wyłącznie wymuszeniem wyłączności: klucz główny sprawia, że dwie równoczesne rezerwacje
-- tej samej osi na tę samą godzinę nie mogą obie się zapisać, niezależnie od sprawdzeń
-- w kodzie. Anulowanie usuwa wiersze i tym samym zwalnia sloty.
CREATE TABLE zajety_slot (
  os_id         INTEGER NOT NULL REFERENCES os(id)         ON DELETE CASCADE,
  poczatek_utc  TEXT    NOT NULL,
  rezerwacja_id INTEGER NOT NULL REFERENCES rezerwacja(id) ON DELETE CASCADE,
  PRIMARY KEY (os_id, poczatek_utc)
);
