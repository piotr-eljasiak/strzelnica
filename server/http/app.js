import { createServer } from 'node:http';

import { createRepository } from '../db/repository.js';
import { NotFound, Refused, createService } from '../app/service.js';
import { createPanelService } from '../app/panel-service.js';
import {
  SHOOTER_COOKIE,
  STAFF_COOKIE,
  clearedCookie,
  createSessions,
  readCookie,
  sessionCookie,
} from './sessions.js';

/**
 * The HTTP layer: authenticate, route, call a service, map the answer onto a status code.
 * No domain logic lives here -- if a rule needs changing, this file should not change.
 *
 * `now` is injected rather than read from the clock so tests can place themselves at a
 * fixed moment (see the spec's testing decisions).
 */

const REFUSAL_STATUS = {
  slot_taken: 409,
  email_taken: 409,
  lane_name_taken: 409,
  closure_collides: 409,
  lane_has_bookings: 409,
  bad_credentials: 401,
  missing_fields: 400,
  invalid_hours: 400,
};

export function createApp({ db, now = () => Date.now() }) {
  const repository = createRepository(db);
  const service = createService({ repository, now });
  const panel = createPanelService({ repository, now });
  const sessions = createSessions();

  const routes = [
    // --- Public ---

    ['GET', /^\/api\/ranges\/([\w-]+)$/, (ctx, slug) => ok(service.rangeSummary(slug))],

    ['GET', /^\/api\/ranges\/([\w-]+)\/availability$/, (ctx, slug) =>
      ok(service.availability(slug, {
        from: ctx.query.get('from') ?? undefined,
        to: ctx.query.get('to') ?? undefined,
      })),
    ],

    ['GET', /^\/api\/ranges\/([\w-]+)\/embed-origins$/, (ctx, slug) =>
      ok(service.embedOrigins(slug)),
    ],

    // --- Shooter ---

    ['POST', /^\/api\/auth\/register$/, (ctx) => {
      const shooter = service.register(ctx.body);
      return cookie(SHOOTER_COOKIE, sessions.open('shooter', shooter.id), ok(presentShooter(shooter), 201));
    }],

    ['POST', /^\/api\/auth\/login$/, (ctx) => {
      const shooter = service.authenticate(ctx.body);
      return cookie(SHOOTER_COOKIE, sessions.open('shooter', shooter.id), ok(presentShooter(shooter)));
    }],

    ['POST', /^\/api\/auth\/logout$/, (ctx) => {
      sessions.close(ctx.shooterToken);
      return { status: 204, headers: { 'Set-Cookie': clearedCookie(SHOOTER_COOKIE) } };
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

    // --- Panel (range staff) ---

    ['POST', /^\/api\/panel\/login$/, (ctx) => {
      const staff = panel.authenticate(ctx.body);
      return cookie(STAFF_COOKIE, sessions.open('staff', staff.id), ok(panel.overview(staff)));
    }],

    ['POST', /^\/api\/panel\/logout$/, (ctx) => {
      sessions.close(ctx.staffToken);
      return { status: 204, headers: { 'Set-Cookie': clearedCookie(STAFF_COOKIE) } };
    }],

    ['GET', /^\/api\/panel$/, (ctx) => ok(panel.overview(requireStaff(ctx)))],

    ['POST', /^\/api\/panel\/lanes$/, (ctx) => {
      const id = panel.addLane(requireStaff(ctx), ctx.body);
      return ok({ id }, 201);
    }],

    ['POST', /^\/api\/panel\/lanes\/(\d+)$/, (ctx, id) => {
      panel.renameLane(requireStaff(ctx), Number(id), ctx.body);
      return { status: 204 };
    }],

    ['POST', /^\/api\/panel\/lanes\/(\d+)\/delete$/, (ctx, id) => {
      panel.removeLane(requireStaff(ctx), Number(id));
      return { status: 204 };
    }],

    ['POST', /^\/api\/panel\/lanes\/(\d+)\/hours$/, (ctx, id) => {
      panel.setLaneHours(requireStaff(ctx), Number(id), ctx.body.days);
      return { status: 204 };
    }],

    ['POST', /^\/api\/panel\/hours$/, (ctx) => {
      panel.setRangeHours(requireStaff(ctx), ctx.body.days);
      return { status: 204 };
    }],

    ['POST', /^\/api\/panel\/settings$/, (ctx) => {
      panel.setRangeSettings(requireStaff(ctx), ctx.body);
      return { status: 204 };
    }],

    ['GET', /^\/api\/panel\/closures$/, (ctx) =>
      ok({ closures: panel.closures(requireStaff(ctx)) }),
    ],

    ['POST', /^\/api\/panel\/closures$/, (ctx) =>
      ok(panel.addClosure(requireStaff(ctx), ctx.body), 201),
    ],

    ['POST', /^\/api\/panel\/closures\/(\d+)\/delete$/, (ctx, id) => {
      panel.removeClosure(requireStaff(ctx), Number(id));
      return { status: 204 };
    }],

    ['GET', /^\/api\/panel\/bookings$/, (ctx) =>
      ok({ bookings: panel.bookings(requireStaff(ctx)) }),
    ],

    ['POST', /^\/api\/panel\/bookings\/(\d+)\/cancel$/, (ctx, id) => {
      panel.cancelBooking(requireStaff(ctx), Number(id), ctx.body.note);
      return { status: 204 };
    }],
  ];

  function requireShooter(ctx) {
    if (!ctx.shooter) throw new Unauthorised();
    return ctx.shooter;
  }

  function requireStaff(ctx) {
    if (!ctx.staff) throw new Unauthorised();
    return ctx.staff;
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
        const shooterToken = readCookie(req.headers.cookie, SHOOTER_COOKIE);
        const staffToken = readCookie(req.headers.cookie, STAFF_COOKIE);
        const shooterId = sessions.idFor('shooter', shooterToken);
        const staffId = sessions.idFor('staff', staffToken);

        const ctx = {
          query: url.searchParams,
          body: req.method === 'POST' ? await readJson(req) : {},
          shooterToken,
          staffToken,
          shooter: shooterId ? service.shooterById(shooterId) : undefined,
          staff: staffId ? panel.staffById(staffId) : undefined,
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
const cookie = (name, token, outcome) => ({
  ...outcome,
  headers: { ...outcome.headers, 'Set-Cookie': sessionCookie(name, token) },
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
