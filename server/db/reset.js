/**
 * Kasuje plik bazy, odtwarza schemat z migracji i zasiewa dane startowe.
 * Historia 50 ze speka: powrót do czystego stanu po eksperymentach.
 */

import { rmSync } from 'node:fs';
import { otworzBaze, SCIEZKA_BAZY } from './polaczenie.js';
import { zasiej } from './seed.js';

for (const plik of [SCIEZKA_BAZY, `${SCIEZKA_BAZY}-wal`, `${SCIEZKA_BAZY}-shm`]) {
  rmSync(plik, { force: true });
}

const db = otworzBaze();
const podsumowanie = zasiej(db);

console.log(`Baza odtworzona: ${SCIEZKA_BAZY}`);
console.log(podsumowanie);
