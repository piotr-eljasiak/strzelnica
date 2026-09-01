/**
 * Deletes the database file, rebuilds the schema from the migrations and seeds it.
 * Story 50 of the spec: getting back to a clean slate after experiments.
 */

import { rmSync } from 'node:fs';
import { openDatabase, DATABASE_PATH } from './connection.js';
import { seed } from './seed.js';

for (const file of [DATABASE_PATH, `${DATABASE_PATH}-wal`, `${DATABASE_PATH}-shm`]) {
  rmSync(file, { force: true });
}

const summary = seed(openDatabase());

console.log(`Database rebuilt: ${DATABASE_PATH}`);
console.log(summary);
