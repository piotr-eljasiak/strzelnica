import { createServer } from 'node:http';

import { createRepository } from '../db/repository.js';
import { NotFound, Refused, createService } from '../app/service.js';
import { COOKIE_NAME, clearedCookie, createSessions, readCookie, sessionCookie } from './sessions.js';

/**
 * The HTTP layer: authenticate, route, call the service, map the answer onto a status
 * code. No domain logic lives here -- if a rule ever needs changing, this file should not
 * be the one that changes.
 *
 * `now` is injected rather than read from the clock so the tests can place themselves at
 * a fixed moment (see the spec's testing decisions).
 */

const REFUSAL_STATUS = {
  slot_taken: 409,
  email_taken: 409,
  bad_credentials: 401,
  missing_fields: 400,
};

export function createApp({ db, now = () => Date.now() }) {
  const service = createService({ repository: createRepository(db), now });
  const sessions = createSessions();

  const routes = [
    ['GET', /^\/api\/ranges\/([\w-]+)$/, (ctx, slug) => ok(service.rangeSummary(slug))],

    ['GET', /^\/api\/ranges\/([\w-]+)\/availability$/, (ctx, slug) =>
      ok(service.availability(slug, {
        from: ctx.query.get('from') ?? undefined,
        to: ctx.query.get('to') ?? undefined,
      })),
    ],

    ['POST', /^\/api\/auth\/register$/, (ctx) => {
      const shooter = service.register(ctx.body);
      return withSession(sessions.open(shooter.id), ok(presentShooter(shooter), 201));
    }],

    ['POST', /^\/api\/auth\/login$/, (ctx) => {
      const shooter = service.authenticate(ctx.body);
      return withSession(sessions.open(shooter.id), ok(presentShooter(shooter)));
    }],

    ['POST', /^\/api\/auth\/logout$/, (ctx) => {
      sessions.close(ctx.token);
      return { status: 204, headers: { 'Set-Cookie': clearedCookie } };
    }],

    ['GET', /^\/api\/auth\/me$/, (ctx) => ok(presentShooter(requireShooter(ctx)))],

    ['GET', /^\/api\/bookings$/, (ctx) =>
      ok({ bookings: service.bookingsOf(requireShooter(ctx).id) }),
    ],

    ['POST', /^\/api\/ranges\/([\w-]+)\/bookings$/, (ctx, slug) =>
      ok(
        service.book({
          slug,
          laneId: Number(ctx.body.laneId),
          startUtc: ctx.body.startUtc,
          slotCount: ctx.body.slotCount ?? 1,
          shooterId: requireShooter(ctx).id,
        }),
        201,
      ),
    ],

    ['POST', /^\/api\/bookings\/(\d+)\/cancel$/, (ctx, id) =>
      ok(service.cancel({ bookingId: Number(id), shooterId: requireShooter(ctx).id })),
    ],
  ];

  function requireShooter(ctx) {
    if (!ctx.shooter) throw new Unauthorised();
    return ctx.shooter;
  }

  const handler = async (req, res) => {
    let outcome;
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = routes.find(
        ([method, pattern]) => method === req.method && pattern.test(url.pathname),
      );
      if (!route) {
        outcome = { status: 404, body: { error: 'not_found' } };
      } else {
        const token = readCookie(req.headers.cookie, COOKIE_NAME);
        const shooterId = sessions.shooterIdFor(token);
        const ctx = {
          query: url.searchParams,
          body: req.method === 'POST' ? await readJson(req) : {},
          token,
          shooter: shooterId ? service.shooterById(shooterId) : undefined,
        };
        outcome = await route[2](ctx, ...url.pathname.match(route[1]).slice(1));
      }
    } catch (error) {
      outcome = mapError(error);
    }

    const headers = { 'Content-Type': 'application/json; charset=utf-8', ...outcome.headers };
    res.writeHead(outcome.status, headers);
    res.end(outcome.body === undefined ? '' : JSON.stringify(outcome.body));
  };

  return { handler, listen: (port) => createServer(handler).listen(port) };
}

class Unauthorised extends Error {}
class BadJson extends Error {}

function mapError(error) {
  if (error instanceof Unauthorised) return { status: 401, body: { error: 'unauthenticated' } };
  if (error instanceof NotFound) return { status: 404, body: { error: 'not_found' } };
  if (error instanceof BadJson) return { status: 400, body: { error: 'bad_request' } };
  if (error instanceof Refused) {
    return {
      status: REFUSAL_STATUS[error.reason] ?? 422,
      body: { error: error.reason, ...error.detail },
    };
  }
  return { status: 500, body: { error: 'internal' } };
}

const ok = (body, status = 200) => ({ status, body });
const withSession = (token, outcome) => ({
  ...outcome,
  headers: { ...outcome.headers, 'Set-Cookie': sessionCookie(token) },
});

const presentShooter = (shooter) => ({
  id: shooter.id,
  email: shooter.email,
  firstName: shooter.first_name,
  lastName: shooter.last_name,
  phone: shooter.phone,
});

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BadJson();
  }
}
