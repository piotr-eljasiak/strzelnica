/**
 * Test scaffolding: a server on a fresh in-memory database, at a moment we choose.
 *
 * Tests speak HTTP and nothing else. They never read the database to check an outcome --
 * they ask the API, the way a client would. A test that breaks because a column was
 * renamed is testing the wrong thing (see the spec's testing decisions).
 */

import { createServer } from 'node:http';
import { openDatabase } from '../server/db/connection.js';
import { seed } from '../server/db/seed.js';
import { createApp } from '../server/http/app.js';

/** A Wednesday, 08:00 in Warsaw. Fixed, so no test depends on the day it runs. */
export const DEFAULT_NOW = '2026-09-02T06:00:00Z';

export async function startTestServer({ now = DEFAULT_NOW, withSeed = true } = {}) {
  const db = openDatabase(':memory:');
  if (withSeed) seed(db);

  let currentNow = Date.parse(now);
  const { handler } = createApp({ db, now: () => currentNow });

  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base,
    /** Moves the clock the server sees. Nothing else in the system reads a clock. */
    travelTo(instant) {
      currentNow = Date.parse(instant);
    },
    client: createClient(base),
    async stop() {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}

/** A client that keeps its cookies, so "logged in" means what it means in a browser. */
export function createClient(base) {
  let cookie;

  async function request(method, path, body) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];

    const text = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      body: text ? JSON.parse(text) : undefined,
    };
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body ?? {}),
    forget() {
      cookie = undefined;
    },
    get cookie() {
      return cookie;
    },
  };
}

export const SHOOTER = {
  email: 'nowy@example.com',
  password: 'tajne-haslo',
  firstName: 'Anna',
  lastName: 'Nowak',
  phone: '+48 600 300 400',
};

export async function registerShooter(client, overrides = {}) {
  const response = await client.post('/api/auth/register', { ...SHOOTER, ...overrides });
  if (response.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(response.body)}`);
  }
  return response.body;
}

/** The id of a lane by distance, so tests do not hard-code database ids. */
export async function laneId(client, slug, distanceM) {
  const { body } = await client.get(`/api/ranges/${slug}`);
  const lane = body.lanes.find((candidate) => candidate.distanceM === distanceM);
  if (!lane) throw new Error(`No ${distanceM} m lane at ${slug}`);
  return lane.id;
}

/** Finds a free slot on a lane, so tests do not depend on the seeded opening hours. */
export async function firstFreeSlot(client, slug, distanceM) {
  const { body } = await client.get(`/api/ranges/${slug}/availability?from=${dayAfter(1)}&to=${dayAfter(6)}`);
  const lane = body.lanes.find((candidate) => candidate.distanceM === distanceM);
  for (const day of lane.days) {
    const free = day.slots.find((slot) => slot.state === 'free');
    if (free) return { laneId: lane.id, startUtc: free.startUtc, date: day.date };
  }
  throw new Error(`No free slot on the ${distanceM} m lane at ${slug}`);
}

export function dayAfter(days, from = DEFAULT_NOW) {
  const date = new Date(Date.parse(from));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
