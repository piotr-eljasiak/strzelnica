import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const katalog = dirname(fileURLToPath(import.meta.url));
const katalogMigracji = join(katalog, 'migracje');

export const SCIEZKA_BAZY = join(katalog, '..', '..', 'strzelnica.db');

/**
 * Otwiera bazę i doprowadza jej schemat do bieżącej wersji.
 *
 * `:memory:` daje bazę żyjącą tylko w procesie — testy dostają wtedy czysty stan
 * bez sprzątania plików.
 */
export function otworzBaze(sciezka = SCIEZKA_BAZY) {
  const db = new DatabaseSync(sciezka);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  zastosujMigracje(db);
  return db;
}

function zastosujMigracje(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migracja (
      nazwa           TEXT PRIMARY KEY,
      zastosowana_utc TEXT NOT NULL
    )
  `);

  const juzZastosowane = new Set(
    db.prepare('SELECT nazwa FROM migracja').all().map((w) => w.nazwa),
  );

  const doZastosowania = readdirSync(katalogMigracji)
    .filter((plik) => plik.endsWith('.sql'))
    .sort()
    .filter((plik) => !juzZastosowane.has(plik));

  for (const plik of doZastosowania) {
    const sql = readFileSync(join(katalogMigracji, plik), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO migracja (nazwa, zastosowana_utc) VALUES (?, ?)').run(
        plik,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (blad) {
      db.exec('ROLLBACK');
      throw new Error(`Migracja ${plik} nie przeszła: ${blad.message}`, { cause: blad });
    }
  }

  return doZastosowania;
}
