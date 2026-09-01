import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, 'migrations');

export const DATABASE_PATH = join(here, '..', '..', 'strzelnica.db');

/**
 * Opens the database and brings its schema up to the current version.
 *
 * Passing ':memory:' gives a database that lives only inside the process, so tests get
 * a clean slate without having to clean up files.
 */
export function openDatabase(path = DATABASE_PATH) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  applyMigrations(db);
  return db;
}

function applyMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migration (
      name         TEXT PRIMARY KEY,
      applied_utc  TEXT NOT NULL
    )
  `);

  const applied = new Set(db.prepare('SELECT name FROM migration').all().map((r) => r.name));

  const pending = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .filter((file) => !applied.has(file));

  for (const file of pending) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO migration (name, applied_utc) VALUES (?, ?)').run(
        file,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
    }
  }

  return pending;
}
