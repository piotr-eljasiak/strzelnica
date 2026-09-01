/**
 * Dane startowe etapu 1.
 *
 * Dwie strzelnice, nie jedna (ADR 0001): przy jednej żaden błąd izolacji najemców nie ma
 * jak się ujawnić. Różnią się też limitami, żeby było widać, że liczą się osobno.
 */

import { otworzBaze } from './polaczenie.js';
import { zahashuj } from '../auth/hasla.js';

const NIEDZIELA = 0;
const PONIEDZIALEK = 1;
const SOBOTA = 6;
const DNI_ROBOCZE = [1, 2, 3, 4, 5];

const HASLO_DEMO = 'strzelec123';

export function zasiej(db) {
  const teraz = new Date().toISOString();

  const dodajStrzelnice = db.prepare(`
    INSERT INTO strzelnica
      (slug, nazwa, telefon, horyzont_dni, max_aktywnych_rezerwacji,
       max_slotow_dziennie, okno_anulowania_godzin)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const dodajDomene = db.prepare(
    'INSERT INTO domena_osadzenia (strzelnica_id, domena) VALUES (?, ?)',
  );
  const dodajGodzinyStrzelnicy = db.prepare(`
    INSERT INTO godziny_strzelnicy (strzelnica_id, dzien_tygodnia, godzina_od, godzina_do)
    VALUES (?, ?, ?, ?)
  `);
  const dodajOs = db.prepare(
    'INSERT INTO os (strzelnica_id, nazwa, dystans_m) VALUES (?, ?, ?)',
  );
  const dodajGodzinyOsi = db.prepare(`
    INSERT INTO godziny_osi (os_id, dzien_tygodnia, godzina_od, godzina_do)
    VALUES (?, ?, ?, ?)
  `);
  const dodajBlokade = db.prepare(
    'INSERT INTO blokada (os_id, poczatek_utc, koniec_utc, powod) VALUES (?, ?, ?, ?)',
  );
  const dodajStrzelca = db.prepare(`
    INSERT INTO strzelec (email, hash_hasla, imie, nazwisko, telefon, utworzony_utc)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // --- Strzelnica 1: standardowe limity, oś 100 m czynna krócej niż reszta obiektu ---

  const tarczownia = dodajStrzelnice.run(
    'tarczownia',
    'Strzelnica Tarczownia',
    '+48 58 111 22 33',
    30,
    3,
    2,
    24,
  ).lastInsertRowid;

  dodajDomene.run(tarczownia, 'http://localhost:5174');

  for (const dzien of DNI_ROBOCZE) dodajGodzinyStrzelnicy.run(tarczownia, dzien, 9, 20);
  dodajGodzinyStrzelnicy.run(tarczownia, SOBOTA, 9, 16);
  // Brak wiersza dla niedzieli = obiekt zamknięty.

  const tarczowniaOs25 = dodajOs.run(tarczownia, 'Oś 25 m', 25).lastInsertRowid;
  const tarczowniaOs100 = dodajOs.run(tarczownia, 'Oś 100 m', 100).lastInsertRowid;

  // Oś 25 m nie ma własnego grafiku — dziedziczy godziny strzelnicy.
  // Oś 100 m ma własny, krótszy: hałas i warunki.
  for (const dzien of DNI_ROBOCZE) dodajGodzinyOsi.run(tarczowniaOs100, dzien, 10, 18);
  dodajGodzinyOsi.run(tarczowniaOs100, SOBOTA, 10, 14);

  // --- Strzelnica 2: inne limity i inny tydzień, żeby izolacja była widoczna ---

  const bemowo = dodajStrzelnice.run(
    'bemowo',
    'Strzelnica Bemowo',
    '+48 22 444 55 66',
    14,
    2,
    4,
    24,
  ).lastInsertRowid;

  dodajDomene.run(bemowo, 'http://localhost:5174');

  for (let dzien = NIEDZIELA; dzien <= SOBOTA; dzien += 1) {
    dodajGodzinyStrzelnicy.run(bemowo, dzien, 8, 22);
  }

  dodajOs.run(bemowo, 'Oś 25 m', 25);
  const bemowoOs50 = dodajOs.run(bemowo, 'Oś 50 m', 50).lastInsertRowid;

  // --- Blokada: zawody na osi 50 m w najbliższą sobotę ---

  const sobota = najblizszyDzienTygodnia(SOBOTA);
  dodajBlokade.run(
    bemowoOs50,
    `${sobota}T08:00:00Z`,
    `${sobota}T14:00:00Z`,
    'Zawody klubowe',
  );

  // --- Konto demonstracyjne ---

  const hash = zahashuj(HASLO_DEMO);
  dodajStrzelca.run('strzelec@example.com', hash, 'Jan', 'Kowalski', '+48 600 100 200', teraz);

  return {
    strzelnice: ['tarczownia', 'bemowo'],
    osie: 4,
    strzelecDemo: { email: 'strzelec@example.com', haslo: HASLO_DEMO },
    blokada: `Oś 50 m (Bemowo), ${sobota} 08:00–14:00 UTC`,
    dziedziczenie: `Oś 25 m (Tarczownia) dziedziczy godziny strzelnicy; Oś 100 m ma własny grafik`,
    tarczowniaOs25,
  };
}

function najblizszyDzienTygodnia(dzienTygodnia) {
  const data = new Date();
  data.setUTCHours(0, 0, 0, 0);
  const doPrzodu = (dzienTygodnia - data.getUTCDay() + 7) % 7 || 7;
  data.setUTCDate(data.getUTCDate() + doPrzodu);
  return data.toISOString().slice(0, 10);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const db = otworzBaze();
  const podsumowanie = zasiej(db);
  console.log('Dane startowe zapisane:');
  console.log(podsumowanie);
}
