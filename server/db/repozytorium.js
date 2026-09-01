/**
 * Jedyne miejsce w systemie, które zna SQL i kształt tabel (ADR 0004).
 *
 * Operacje są nazwane językiem domeny, nie językiem bazy: reszta aplikacji prosi
 * o „osie strzelnicy" albo „rezerwacje strzelca", a nie o wiersze tabeli. Dzięki temu
 * powrót do Postgresa jest wymianą tego modułu, a nie przepisaniem aplikacji.
 */

/** Rzucane, gdy inna rezerwacja zajęła slot między sprawdzeniem a zapisem. */
export class SlotZajetyError extends Error {
  constructor() {
    super('Slot został zajęty przez inną rezerwację');
    this.name = 'SlotZajetyError';
  }
}

export function utworzRepozytorium(db) {
  const zapytania = {
    strzelnicaPoSlugu: db.prepare('SELECT * FROM strzelnica WHERE slug = ?'),
    osieStrzelnicy: db.prepare(
      'SELECT * FROM os WHERE strzelnica_id = ? ORDER BY dystans_m, nazwa',
    ),
    osWStrzelnicy: db.prepare('SELECT * FROM os WHERE id = ? AND strzelnica_id = ?'),
    domenyOsadzenia: db.prepare(
      'SELECT domena FROM domena_osadzenia WHERE strzelnica_id = ? ORDER BY domena',
    ),
    godzinyStrzelnicy: db.prepare(
      'SELECT dzien_tygodnia, godzina_od, godzina_do FROM godziny_strzelnicy WHERE strzelnica_id = ?',
    ),
    godzinyOsi: db.prepare(
      'SELECT dzien_tygodnia, godzina_od, godzina_do FROM godziny_osi WHERE os_id = ?',
    ),
    blokadyOsi: db.prepare(`
      SELECT id, os_id, poczatek_utc, koniec_utc
        FROM blokada
       WHERE os_id = ? AND poczatek_utc < ? AND koniec_utc > ?
    `),
    zajeteSlotyOsi: db.prepare(`
      SELECT poczatek_utc
        FROM zajety_slot
       WHERE os_id = ? AND poczatek_utc >= ? AND poczatek_utc < ?
    `),
    strzelecPoEmailu: db.prepare('SELECT * FROM strzelec WHERE email = ?'),
    strzelecPoId: db.prepare('SELECT * FROM strzelec WHERE id = ?'),
    dodajStrzelca: db.prepare(`
      INSERT INTO strzelec (email, hash_hasla, imie, nazwisko, telefon, utworzony_utc)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    dodajRezerwacje: db.prepare(`
      INSERT INTO rezerwacja
        (strzelnica_id, os_id, strzelec_id, poczatek_utc, koniec_utc, status, utworzona_utc)
      VALUES (?, ?, ?, ?, ?, 'potwierdzona', ?)
    `),
    dodajZajetySlot: db.prepare(
      'INSERT INTO zajety_slot (os_id, poczatek_utc, rezerwacja_id) VALUES (?, ?, ?)',
    ),
    rezerwacjaPoId: db.prepare(`
      SELECT r.*, o.nazwa AS os_nazwa, o.dystans_m, s.nazwa AS strzelnica_nazwa,
             s.slug AS strzelnica_slug, s.telefon AS strzelnica_telefon,
             s.strefa_czasowa, s.okno_anulowania_godzin
        FROM rezerwacja r
        JOIN os o          ON o.id = r.os_id
        JOIN strzelnica s  ON s.id = r.strzelnica_id
       WHERE r.id = ?
    `),
    rezerwacjeStrzelca: db.prepare(`
      SELECT r.*, o.nazwa AS os_nazwa, o.dystans_m, s.nazwa AS strzelnica_nazwa,
             s.slug AS strzelnica_slug, s.telefon AS strzelnica_telefon,
             s.strefa_czasowa, s.okno_anulowania_godzin
        FROM rezerwacja r
        JOIN os o          ON o.id = r.os_id
        JOIN strzelnica s  ON s.id = r.strzelnica_id
       WHERE r.strzelec_id = ?
       ORDER BY r.poczatek_utc DESC
    `),
    aktywneRezerwacjeStrzelca: db.prepare(`
      SELECT COUNT(*) AS ile
        FROM rezerwacja
       WHERE strzelec_id = ? AND strzelnica_id = ?
         AND status = 'potwierdzona' AND koniec_utc > ?
    `),
    slotyStrzelcaWZakresie: db.prepare(`
      SELECT COUNT(*) AS ile
        FROM zajety_slot z
        JOIN rezerwacja r ON r.id = z.rezerwacja_id
       WHERE r.strzelec_id = ? AND r.strzelnica_id = ?
         AND z.poczatek_utc >= ? AND z.poczatek_utc < ?
    `),
    oznaczAnulowana: db.prepare(`
      UPDATE rezerwacja SET status = 'anulowana', anulowana_utc = ?
       WHERE id = ? AND status = 'potwierdzona'
    `),
    usunZajeteSloty: db.prepare('DELETE FROM zajety_slot WHERE rezerwacja_id = ?'),
  };

  return {
    strzelnicaPoSlugu: (slug) => zapytania.strzelnicaPoSlugu.get(slug),
    osieStrzelnicy: (strzelnicaId) => zapytania.osieStrzelnicy.all(strzelnicaId),
    osWStrzelnicy: (osId, strzelnicaId) => zapytania.osWStrzelnicy.get(osId, strzelnicaId),
    domenyOsadzenia: (strzelnicaId) =>
      zapytania.domenyOsadzenia.all(strzelnicaId).map((w) => w.domena),

    /**
     * Grafik osi: własny, jeśli oś ma choć jeden wiersz, w przeciwnym razie
     * odziedziczony ze strzelnicy. Zwraca też, skąd pochodzi — dostępność nie musi
     * tego wiedzieć, ale panel i testy tak.
     */
    grafikOsi(osId, strzelnicaId) {
      const wlasny = zapytania.godzinyOsi.all(osId);
      if (wlasny.length > 0) return { zrodlo: 'os', dni: wlasny };
      return { zrodlo: 'strzelnica', dni: zapytania.godzinyStrzelnicy.all(strzelnicaId) };
    },

    blokadyOsiWZakresie: (osId, odUtc, doUtc) => zapytania.blokadyOsi.all(osId, doUtc, odUtc),
    zajeteSlotyOsiWZakresie: (osId, odUtc, doUtc) =>
      zapytania.zajeteSlotyOsi.all(osId, odUtc, doUtc).map((w) => w.poczatek_utc),

    strzelecPoEmailu: (email) => zapytania.strzelecPoEmailu.get(email),
    strzelecPoId: (id) => zapytania.strzelecPoId.get(id),
    dodajStrzelca({ email, hashHasla, imie, nazwisko, telefon, terazUtc }) {
      const wynik = zapytania.dodajStrzelca.run(
        email,
        hashHasla,
        imie,
        nazwisko,
        telefon,
        terazUtc,
      );
      return zapytania.strzelecPoId.get(wynik.lastInsertRowid);
    },

    rezerwacjaPoId: (id) => zapytania.rezerwacjaPoId.get(id),
    rezerwacjeStrzelca: (strzelecId) => zapytania.rezerwacjeStrzelca.all(strzelecId),
    liczbaAktywnychRezerwacji: (strzelecId, strzelnicaId, terazUtc) =>
      zapytania.aktywneRezerwacjeStrzelca.get(strzelecId, strzelnicaId, terazUtc).ile,
    liczbaSlotowStrzelcaWZakresie: (strzelecId, strzelnicaId, odUtc, doUtc) =>
      zapytania.slotyStrzelcaWZakresie.get(strzelecId, strzelnicaId, odUtc, doUtc).ile,

    /**
     * Zapisuje rezerwację razem z jej slotami w jednej transakcji.
     *
     * Klucz główny `zajety_slot` jest ostatnią linią obrony: jeśli między sprawdzeniem
     * dostępności a zapisem ktoś zajmie ten sam slot, zapis się nie powiedzie i cała
     * transakcja się wycofa.
     */
    zapiszRezerwacje({ strzelnicaId, osId, strzelecId, sloty, poczatekUtc, koniecUtc, terazUtc }) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const wynik = zapytania.dodajRezerwacje.run(
          strzelnicaId,
          osId,
          strzelecId,
          poczatekUtc,
          koniecUtc,
          terazUtc,
        );
        const rezerwacjaId = wynik.lastInsertRowid;
        for (const slot of sloty) {
          zapytania.dodajZajetySlot.run(osId, slot, rezerwacjaId);
        }
        db.exec('COMMIT');
        return zapytania.rezerwacjaPoId.get(rezerwacjaId);
      } catch (blad) {
        db.exec('ROLLBACK');
        if (/UNIQUE constraint failed: zajety_slot/i.test(blad.message)) {
          throw new SlotZajetyError();
        }
        throw blad;
      }
    },

    /** Anuluje rezerwację i zwalnia jej sloty. Zwraca `false`, jeśli już była anulowana. */
    anulujRezerwacje(rezerwacjaId, terazUtc) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const wynik = zapytania.oznaczAnulowana.run(terazUtc, rezerwacjaId);
        if (wynik.changes === 0) {
          db.exec('ROLLBACK');
          return false;
        }
        zapytania.usunZajeteSloty.run(rezerwacjaId);
        db.exec('COMMIT');
        return true;
      } catch (blad) {
        db.exec('ROLLBACK');
        throw blad;
      }
    },
  };
}
