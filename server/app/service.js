/**
 * Where the repository and the domain rules meet.
 *
 * The HTTP layer above knows nothing about rules; the rules below know nothing about the
 * database. This module is the only thing that knows both, which keeps the seam the tests
 * aim at (HTTP) thin enough to be worth aiming at.
 */

import { SlotTakenError } from '../db/repository.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { bookableDateRange, laneAvailability } from '../domain/availability.js';
import {
  CANCEL_REFUSAL,
  REFUSAL,
  checkBooking,
  checkCancellation,
  cancellationDeadline,
  slotsFrom,
} from '../domain/booking-rules.js';
import { HOUR_MS, addDays, localDate, toIso } from '../domain/time.js';

export class NotFound extends Error {}
export class Refused extends Error {
  constructor(reason, detail = {}) {
    super(reason);
    this.reason = reason;
    this.detail = detail;
  }
}

export function createService({ repository, now }) {
  const nowMs = () => now();

  function requireRange(slug) {
    const range = repository.rangeBySlug(slug);
    if (!range) throw new NotFound('range');
    return range;
  }

  function requireLane(laneId, range) {
    const lane = repository.laneInRange(laneId, range.id);
    // A lane belonging to another range is reported as missing, not as forbidden: the
    // caller learns nothing about ranges it did not ask for.
    if (!lane) throw new NotFound('lane');
    return lane;
  }

  return {
    /** Public: what an anonymous visitor may know about a range. */
    rangeSummary(slug) {
      const range = requireRange(slug);
      return {
        slug: range.slug,
        name: range.name,
        phone: range.phone,
        timeZone: range.time_zone,
        horizonDays: range.horizon_days,
        lanes: repository.lanesOfRange(range.id).map((lane) => ({
          id: lane.id,
          name: lane.name,
          distanceM: lane.distance_m,
        })),
      };
    },

    /**
     * Public: free / unavailable per slot. Carries no booking ids, no shooter data and no
     * closure reasons -- an anonymous caller must not be able to tell a closure from a
     * booking (ADR 0002).
     */
    availability(slug, { from, to } = {}) {
      const range = requireRange(slug);
      const window = bookableDateRange({
        nowMs: nowMs(),
        timeZone: range.time_zone,
        horizonDays: range.horizon_days,
      });

      const start = clamp(from ?? window.from, window.from, window.to);
      const end = clamp(to ?? window.from, start, window.to);

      return {
        range: { slug: range.slug, name: range.name, timeZone: range.time_zone },
        from: start,
        to: end,
        // The whole window a shooter may book in, so the interface knows how far it may
        // page without asking for days the server would only clamp away (story 6 and 7).
        earliestDate: window.from,
        latestDate: window.to,
        lanes: repository.lanesOfRange(range.id).map((lane) => {
          const fromUtc = `${start}T00:00:00Z`;
          const toUtc = `${addDays(end, 2)}T00:00:00Z`;
          return {
            id: lane.id,
            name: lane.name,
            distanceM: lane.distance_m,
            days: laneAvailability({
              schedule: repository.scheduleForLane(lane.id, range.id),
              timeZone: range.time_zone,
              from: start,
              to: end,
              closures: repository.closuresForLane(lane.id, fromUtc, toUtc),
              bookedSlots: repository.bookedSlotsForLane(lane.id, fromUtc, toUtc),
              nowMs: nowMs(),
            }),
          };
        }),
      };
    },

    register({ email, password, firstName, lastName, phone }) {
      const normalised = String(email ?? '').trim().toLowerCase();
      if (!normalised || !password || !firstName || !lastName || !phone) {
        throw new Refused('missing_fields');
      }
      if (repository.shooterByEmail(normalised)) throw new Refused('email_taken');

      return repository.insertShooter({
        email: normalised,
        passwordHash: hashPassword(password),
        firstName,
        lastName,
        phone,
        nowUtc: toIso(nowMs()),
      });
    },

    authenticate({ email, password }) {
      const shooter = repository.shooterByEmail(String(email ?? '').trim().toLowerCase());
      // Same refusal whether the address is unknown or the password is wrong.
      if (!shooter || !verifyPassword(String(password ?? ''), shooter.password_hash)) {
        throw new Refused('bad_credentials');
      }
      return shooter;
    },

    /**
     * Which sites this range allows to embed its widget. Read by whatever serves the
     * widget so it can set frame-ancestors from data rather than from a hard-coded list
     * (story 36).
     */
    embedOrigins(slug) {
      return { origins: repository.embedOrigins(requireRange(slug).id) };
    },

    shooterById(id) {
      return repository.shooterById(id);
    },

    bookingsOf(shooterId) {
      return repository.bookingsOfShooter(shooterId).map(presentBooking);
    },

    book({ slug, laneId, startUtc, slotCount, shooterId }) {
      const range = requireRange(slug);
      const lane = requireLane(laneId, range);

      const count = Number(slotCount ?? 1);
      if (!Number.isInteger(count) || count < 1) throw new Refused(REFUSAL.EMPTY);
      if (Number.isNaN(Date.parse(String(startUtc)))) throw new Refused(REFUSAL.EMPTY);

      const slots = slotsFrom(startUtc, count);
      const day = localDate(Date.parse(slots[0]), range.time_zone);
      const dayStartUtc = `${day}T00:00:00Z`;
      const dayEndUtc = `${addDays(day, 2)}T00:00:00Z`;

      const verdict = checkBooking({
        slots,
        schedule: repository.scheduleForLane(lane.id, range.id),
        timeZone: range.time_zone,
        horizonDays: range.horizon_days,
        maxActiveBookings: range.max_active_bookings,
        maxSlotsPerDay: range.max_slots_per_day,
        activeBookingCount: repository.activeBookingCount(shooterId, range.id, toIso(nowMs())),
        slotsAlreadyBookedThatDay: repository.shooterSlotCount(
          shooterId,
          range.id,
          dayStartUtc,
          dayEndUtc,
        ),
        takenSlots: repository.bookedSlotsForLane(lane.id, dayStartUtc, dayEndUtc),
        closures: repository.closuresForLane(lane.id, dayStartUtc, dayEndUtc),
        nowMs: nowMs(),
      });

      if (!verdict.allowed) throw new Refused(verdict.reason, stripVerdict(verdict));

      try {
        return presentBooking(
          repository.insertBooking({
            rangeId: range.id,
            laneId: lane.id,
            shooterId,
            slots,
            startUtc: slots[0],
            endUtc: toIso(Date.parse(slots[slots.length - 1]) + HOUR_MS),
            nowUtc: toIso(nowMs()),
          }),
        );
      } catch (error) {
        // Lost the race between the check above and this write.
        if (error instanceof SlotTakenError) throw new Refused(REFUSAL.SLOT_TAKEN);
        throw error;
      }
    },

    cancel({ bookingId, shooterId }) {
      const booking = repository.bookingById(bookingId);
      // A booking that is not yours is reported as missing: the refusal must not confirm
      // that it exists.
      if (!booking) throw new NotFound('booking');

      const verdict = checkCancellation({ booking, shooterId, nowMs: nowMs() });
      if (!verdict.allowed) {
        if (verdict.reason === CANCEL_REFUSAL.NOT_YOURS) throw new NotFound('booking');
        throw new Refused(verdict.reason, stripVerdict(verdict));
      }

      repository.cancelBooking(booking.id, toIso(nowMs()));
      return presentBooking(repository.bookingById(booking.id));
    },
  };
}

function presentBooking(booking) {
  return {
    id: booking.id,
    status: booking.status,
    startUtc: booking.start_utc,
    endUtc: booking.end_utc,
    cancellableUntilUtc: cancellationDeadline(booking),
    lane: { id: booking.lane_id, name: booking.lane_name, distanceM: booking.distance_m },
    range: {
      slug: booking.range_slug,
      name: booking.range_name,
      phone: booking.range_phone,
      timeZone: booking.time_zone,
    },
  };
}

function stripVerdict({ allowed, reason, ...detail }) {
  return detail;
}

function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}
