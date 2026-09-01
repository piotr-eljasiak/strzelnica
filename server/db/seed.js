/**
 * Seed data for stage 1.
 *
 * Two ranges, not one (ADR 0001): with a single range no tenant isolation bug has any way
 * of showing itself. They also differ in their limits, so it is visible that limits are
 * counted per range.
 *
 * Content is Polish because it is domain data shown to users; identifiers are English.
 */

import { openDatabase } from './connection.js';
import { hashPassword } from '../auth/passwords.js';

const SUNDAY = 0;
const SATURDAY = 6;
const WEEKDAYS = [1, 2, 3, 4, 5];

const DEMO_PASSWORD = 'strzelec123';

export function seed(db) {
  const now = new Date().toISOString();

  const insertRange = db.prepare(`
    INSERT INTO shooting_range
      (slug, name, phone, horizon_days, max_active_bookings,
       max_slots_per_day, cancellation_window_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOrigin = db.prepare(
    'INSERT INTO embed_origin (range_id, origin) VALUES (?, ?)',
  );
  const insertRangeHours = db.prepare(`
    INSERT INTO range_hours (range_id, weekday, start_hour, end_hour) VALUES (?, ?, ?, ?)
  `);
  const insertLane = db.prepare(
    'INSERT INTO lane (range_id, name, distance_m) VALUES (?, ?, ?)',
  );
  const insertLaneHours = db.prepare(`
    INSERT INTO lane_hours (lane_id, weekday, start_hour, end_hour) VALUES (?, ?, ?, ?)
  `);
  const insertClosure = db.prepare(
    'INSERT INTO closure (lane_id, start_utc, end_utc, reason) VALUES (?, ?, ?, ?)',
  );
  const insertShooter = db.prepare(`
    INSERT INTO shooter (email, password_hash, first_name, last_name, phone, created_utc)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // --- Range 1: standard limits, the 100 m lane open fewer hours than the site ---

  const tarczownia = insertRange.run(
    'tarczownia',
    'Strzelnica Tarczownia',
    '+48 58 111 22 33',
    30,
    3,
    2,
    24,
  ).lastInsertRowid;

  insertOrigin.run(tarczownia, 'http://localhost:5174');

  for (const weekday of WEEKDAYS) insertRangeHours.run(tarczownia, weekday, 9, 20);
  insertRangeHours.run(tarczownia, SATURDAY, 9, 16);
  // No row for Sunday: the site is closed.

  insertLane.run(tarczownia, 'Oś 25 m', 25);
  const tarczowniaLane100 = insertLane.run(tarczownia, 'Oś 100 m', 100).lastInsertRowid;

  // The 25 m lane has no schedule of its own, so it inherits the range's hours.
  // The 100 m lane has its own, shorter one: noise and conditions.
  for (const weekday of WEEKDAYS) insertLaneHours.run(tarczowniaLane100, weekday, 10, 18);
  insertLaneHours.run(tarczowniaLane100, SATURDAY, 10, 14);

  // --- Range 2: different limits and a different week, so isolation is visible ---

  const bemowo = insertRange.run(
    'bemowo',
    'Strzelnica Bemowo',
    '+48 22 444 55 66',
    14,
    2,
    4,
    24,
  ).lastInsertRowid;

  insertOrigin.run(bemowo, 'http://localhost:5174');

  for (let weekday = SUNDAY; weekday <= SATURDAY; weekday += 1) {
    insertRangeHours.run(bemowo, weekday, 8, 22);
  }

  insertLane.run(bemowo, 'Oś 25 m', 25);
  const bemowoLane50 = insertLane.run(bemowo, 'Oś 50 m', 50).lastInsertRowid;

  // --- A closure: a club competition on the 50 m lane this coming Saturday ---

  const saturday = nextWeekday(SATURDAY);
  insertClosure.run(
    bemowoLane50,
    `${saturday}T08:00:00Z`,
    `${saturday}T14:00:00Z`,
    'Zawody klubowe',
  );

  // --- Demo account ---

  insertShooter.run(
    'strzelec@example.com',
    hashPassword(DEMO_PASSWORD),
    'Jan',
    'Kowalski',
    '+48 600 100 200',
    now,
  );

  return {
    ranges: ['tarczownia', 'bemowo'],
    lanes: 4,
    demoShooter: { email: 'strzelec@example.com', password: DEMO_PASSWORD },
    closure: `Oś 50 m (Bemowo), ${saturday} 08:00-14:00 UTC`,
    inheritance: 'Oś 25 m (Tarczownia) inherits range hours; Oś 100 m has its own schedule',
  };
}

function nextWeekday(weekday) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  const ahead = (weekday - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + ahead);
  return date.toISOString().slice(0, 10);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('Seed data written:');
  console.log(seed(openDatabase()));
}
