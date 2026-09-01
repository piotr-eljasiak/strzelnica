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

    // SQLite cannot change a column's nullability, so altering one means rebuilding the
    // table: copy, drop, rename. Foreign keys have to be off for that, or dropping the old
    // table cascades into everything pointing at it. The pragma is ignored inside a
    // transaction, hence outside. A migration opts in with a marker line so that the
    // ordinary ones keep their protection.
    const rebuildsTables = /^--\s*migration:\s*foreign-keys-off\s*$/m.test(sql);
    if (rebuildsTables) db.exec('PRAGMA foreign_keys = OFF');

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
      if (rebuildsTables) db.exec('PRAGMA foreign_keys = ON');
      throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
    }

    if (rebuildsTables) {
      db.exec('PRAGMA foreign_keys = ON');
      // Turning the checks off means nothing enforced them during the rebuild; verify now
      // rather than discovering a dangling row weeks later.
      const dangling = db.prepare('PRAGMA foreign_key_check').all();
      if (dangling.length > 0) {
        throw new Error(
          `Migration ${file} left ${dangling.length} broken foreign key reference(s)`,
        );
      }
    }
  }

  return pending;
}
