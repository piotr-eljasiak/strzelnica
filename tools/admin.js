/**
 * The platform admin's tools, as a command line rather than a third web interface.
 *
 * Ranges are created by hand, by one person, a few times (Q13). A console with login,
 * forms and its own authorisation would be weeks of work for a single user -- this is the
 * same capability in an afternoon, and it cannot be reached from the internet at all.
 */

import { createInterface } from 'node:readline/promises';
import { openDatabase } from '../server/db/connection.js';
import { createRepository } from '../server/db/repository.js';
import { hashPassword } from '../server/auth/passwords.js';

const db = openDatabase();
const repository = createRepository(db);
const [command, ...args] = process.argv.slice(2);

const commands = {
  'list': listRanges,
  'add-range': addRange,
  'add-staff': addStaff,
  'allow-origin': allowOrigin,
};

const run = commands[command];
if (!run) {
  console.log(`
Użycie: node tools/admin.js <komenda>

  list                      wypisz strzelnice, ich osie i konta obsługi
  add-range                 dodaj strzelnicę (pyta o dane)
  add-staff                 dodaj konto obsługi do strzelnicy (pyta o dane)
  allow-origin <slug> <url> pozwól tej stronie osadzić widget strzelnicy
`);
  process.exit(command ? 1 : 0);
}

await run(args);
db.close();

async function listRanges() {
  const ranges = repository.allRanges();
  if (ranges.length === 0) {
    console.log('Brak strzelnic. Dodaj pierwszą: node tools/admin.js add-range');
    return;
  }
  for (const range of ranges) {
    console.log(`\n${range.name}  [${range.slug}]  tel. ${range.phone}`);
    console.log(
      `  limity: horyzont ${range.horizon_days} ${plural(range.horizon_days, 'dzień', 'dni', 'dni')}, ` +
        `${range.max_active_bookings} ${plural(range.max_active_bookings, 'aktywna rezerwacja', 'aktywne rezerwacje', 'aktywnych rezerwacji')}, ` +
        `${range.max_slots_per_day} ${plural(range.max_slots_per_day, 'slot', 'sloty', 'slotów')} dziennie, ` +
        `anulowanie do ${range.cancellation_window_hours} h przed`,
    );
    for (const lane of repository.lanesOfRange(range.id)) {
      const schedule = repository.scheduleForLane(lane.id, range.id);
      const source = schedule.source === 'range' ? 'grafik dziedziczony' : 'grafik własny';
      console.log(`  - ${lane.name} (${lane.distance_m} m, ${source})`);
    }
    const origins = repository.embedOrigins(range.id);
    console.log(`  osadzanie: ${origins.length ? origins.join(', ') : 'nigdzie'}`);
    const staff = db
      .prepare('SELECT name, email FROM staff WHERE range_id = ? ORDER BY name')
      .all(range.id);
    console.log(
      `  obsługa: ${staff.length ? staff.map((s) => `${s.name} <${s.email}>`).join(', ') : 'brak kont'}`,
    );
  }
}

async function addRange() {
  const ask = prompter();
  try {
    const slug = await ask.required('Slug (w adresie, np. tarczownia): ');
    if (repository.rangeBySlug(slug)) {
      console.error(`Strzelnica o slugu "${slug}" już istnieje.`);
      process.exitCode = 1;
      return;
    }
    const name = await ask.required('Nazwa: ');
    const phone = await ask.required('Telefon: ');

    const range = repository.insertRange({ slug, name, phone });
    // Sensible opening hours so the range is usable the moment it exists; staff change
    // them in the panel.
    repository.replaceRangeHours(
      range.id,
      [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startHour: 9, endHour: 20 })),
    );

    console.log(`\nDodano: ${name} [${slug}], czynna pn-sb 9-20.`);
    console.log('Kolejny krok: node tools/admin.js add-staff');
  } finally {
    ask.close();
  }
}

async function addStaff() {
  const ask = prompter();
  try {
    const slug = await ask.required('Slug strzelnicy: ');
    const range = repository.rangeBySlug(slug);
    if (!range) {
      console.error(`Nie ma strzelnicy o slugu "${slug}".`);
      process.exitCode = 1;
      return;
    }
    const name = await ask.required('Imię i nazwisko: ');
    const email = (await ask.required('E-mail: ')).toLowerCase();
    if (repository.staffByEmail(email)) {
      console.error('Konto obsługi o tym adresie już istnieje.');
      process.exitCode = 1;
      return;
    }
    const password = await ask.required('Hasło: ');

    repository.insertStaff({
      rangeId: range.id,
      email,
      passwordHash: hashPassword(password),
      name,
      nowUtc: new Date().toISOString(),
    });

    console.log(`\nDodano ${name} <${email}> do ${range.name}.`);
    console.log('Panel: http://localhost:5173/panel');
  } finally {
    ask.close();
  }
}

async function allowOrigin([slug, origin]) {
  if (!slug || !origin) {
    console.error('Użycie: node tools/admin.js allow-origin <slug> <https://strona.pl>');
    process.exitCode = 1;
    return;
  }
  const range = repository.rangeBySlug(slug);
  if (!range) {
    console.error(`Nie ma strzelnicy o slugu "${slug}".`);
    process.exitCode = 1;
    return;
  }
  db.prepare('INSERT OR IGNORE INTO embed_origin (range_id, origin) VALUES (?, ?)').run(
    range.id,
    origin,
  );
  console.log(`${origin} może teraz osadzić widget strzelnicy ${range.name}.`);
}

function prompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    async required(question) {
      for (;;) {
        const answer = (await rl.question(question)).trim();
        if (answer) return answer;
        console.log('  (wymagane)');
      }
    },
    close: () => rl.close(),
  };
}

/** Polish plurals: 1 slot, 2 sloty, 5 slotów. Duplicated from the browser side on purpose:
 *  the CLI has no reason to import anything out of `src/`. */
function plural(count, one, few, many) {
  const last = count % 10;
  const lastTwo = count % 100;
  if (count === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}
