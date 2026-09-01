/**
 * What a range's staff can do with their own range.
 *
 * Every operation here starts from the signed-in staff member and works outwards to their
 * range. Nothing takes a range id from the request: there is no argument a caller could
 * tamper with to reach another range's data (ADR 0008).
 */

import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { NotFound, Refused } from './service.js';
import { HOUR_MS, localHourToInstant, toIso } from '../domain/time.js';

const WEEK = [0, 1, 2, 3, 4, 5, 6];

export function createPanelService({ repository, now }) {
  const nowMs = () => now();

  function rangeOf(staff) {
    const range = repository.rangeById(staff.range_id);
    if (!range) throw new NotFound('range');
    return range;
  }

  function ownLane(staff, laneId) {
    const lane = repository.laneInRange(laneId, staff.range_id);
    // Another range's lane is reported as missing, never as forbidden.
    if (!lane) throw new NotFound('lane');
    return lane;
  }

  return {
    authenticate({ email, password }) {
      const staff = repository.staffByEmail(String(email ?? '').trim().toLowerCase());
      if (!staff || !verifyPassword(String(password ?? ''), staff.password_hash)) {
        throw new Refused('bad_credentials');
      }
      return staff;
    },

    staffById: (id) => repository.staffById(id),

    /** Everything the panel's first screen needs, for this staff member's range only. */
    overview(staff) {
      const range = rangeOf(staff);
      return {
        staff: { id: staff.id, name: staff.name, email: staff.email },
        range: {
          slug: range.slug,
          name: range.name,
          phone: range.phone,
          timeZone: range.time_zone,
          horizonDays: range.horizon_days,
          maxActiveBookings: range.max_active_bookings,
          maxSlotsPerDay: range.max_slots_per_day,
          cancellationWindowHours: range.cancellation_window_hours,
          embedOrigins: repository.embedOrigins(range.id),
        },
        rangeHours: normaliseWeek(repository.rangeHours(range.id)),
        lanes: repository.lanesOfRange(range.id).map((lane) => {
          const schedule = repository.scheduleForLane(lane.id, range.id);
          return {
            id: lane.id,
            name: lane.name,
            distanceM: lane.distance_m,
            inheritsHours: schedule.source === 'range',
            hours: normaliseWeek(schedule.days),
          };
        }),
      };
    },

    addLane(staff, { name, distanceM }) {
      if (!String(name ?? '').trim()) throw new Refused('missing_fields');
      const distance = Number(distanceM);
      if (!Number.isInteger(distance) || distance <= 0) throw new Refused('missing_fields');
      try {
        return repository.addLane(staff.range_id, String(name).trim(), distance);
      } catch (error) {
        if (/UNIQUE constraint failed: lane/i.test(error.message)) {
          throw new Refused('lane_name_taken');
        }
        throw error;
      }
    },

    renameLane(staff, laneId, { name, distanceM }) {
      ownLane(staff, laneId);
      repository.updateLane(laneId, staff.range_id, String(name).trim(), Number(distanceM));
    },

    /**
     * Removing a lane with future bookings is refused rather than cascading. Deleting a
     * lane would silently delete other people's bookings -- the same reasoning as closures
     * never cancelling automatically.
     */
    removeLane(staff, laneId) {
      ownLane(staff, laneId);
      if (repository.laneHasFutureBookings(laneId, toIso(nowMs()))) {
        throw new Refused('lane_has_bookings');
      }
      repository.removeLane(laneId, staff.range_id);
    },

    /** An empty week puts the lane back to inheriting the range's hours. */
    setLaneHours(staff, laneId, days) {
      ownLane(staff, laneId);
      repository.replaceLaneHours(laneId, validWeek(days));
    },

    setRangeHours(staff, days) {
      repository.replaceRangeHours(staff.range_id, validWeek(days));
    },

    setRangeSettings(staff, settings) {
      const numbers = {
        horizonDays: Number(settings.horizonDays),
        maxActiveBookings: Number(settings.maxActiveBookings),
        maxSlotsPerDay: Number(settings.maxSlotsPerDay),
        cancellationWindowHours: Number(settings.cancellationWindowHours),
      };
      if (
        !Number.isInteger(numbers.horizonDays) || numbers.horizonDays < 1 ||
        !Number.isInteger(numbers.maxActiveBookings) || numbers.maxActiveBookings < 1 ||
        !Number.isInteger(numbers.maxSlotsPerDay) || numbers.maxSlotsPerDay < 1 ||
        !Number.isInteger(numbers.cancellationWindowHours) || numbers.cancellationWindowHours < 0
      ) {
        throw new Refused('missing_fields');
      }
      repository.updateRangeSettings(staff.range_id, {
        phone: String(settings.phone ?? '').trim(),
        ...numbers,
      });
    },

    closures(staff) {
      return repository.closuresOfRange(staff.range_id, toIso(nowMs())).map((closure) => ({
        id: closure.id,
        laneId: closure.lane_id,
        laneName: closure.lane_name,
        startUtc: closure.start_utc,
        endUtc: closure.end_utc,
        reason: closure.reason,
      }));
    },

    /**
     * Creating a closure never cancels anything (Q15, variant beta).
     *
     * If bookings fall inside it, the first attempt is refused and returns them, so staff
     * see whose day they are about to ruin. Repeating the call with `acknowledged` creates
     * the closure and leaves those bookings standing -- releasing them stays a separate,
     * deliberate act.
     */
    addClosure(staff, { laneId, startUtc, endUtc, reason, acknowledged }) {
      const lane = ownLane(staff, Number(laneId));
      const startMs = Date.parse(startUtc);
      const endMs = Date.parse(endUtc);
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        throw new Refused('missing_fields');
      }
      if (!String(reason ?? '').trim()) throw new Refused('missing_fields');

      const colliding = repository.bookingsCollidingWith(lane.id, startUtc, endUtc);
      if (colliding.length > 0 && !acknowledged) {
        throw new Refused('closure_collides', { bookings: colliding.map(presentForStaff) });
      }

      const id = repository.addClosure(lane.id, startUtc, endUtc, String(reason).trim());
      return { id, collidingBookings: colliding.map(presentForStaff) };
    },

    removeClosure(staff, closureId) {
      if (!repository.closureInRange(closureId, staff.range_id)) throw new NotFound('closure');
      repository.removeClosure(closureId);
    },

    /** Upcoming bookings at this range, with the contact details staff need (story 11). */
    bookings(staff) {
      return repository
        .bookingsOfRange(staff.range_id, toIso(nowMs()))
        .map(presentForStaff);
    },

    /**
     * Staff may release any booking at their range at any time -- the 24 h window binds
     * the shooter, not the range (Q17). A note is required, so the reason is recorded
     * where the next person can read it.
     */
    cancelBooking(staff, bookingId, note) {
      const booking = repository.bookingById(bookingId);
      if (!booking || booking.range_id !== staff.range_id) throw new NotFound('booking');
      if (booking.status === 'cancelled') throw new Refused('already_cancelled');
      if (!String(note ?? '').trim()) throw new Refused('missing_fields');

      repository.cancelBooking(booking.id, toIso(nowMs()), {
        staffId: staff.id,
        note: String(note).trim(),
      });
    },
  };
}

/** Turns a wall-clock day plus hour into an instant, for the closure form. */
export function closureInstant(date, hour, timeZone) {
  const instant = localHourToInstant(date, hour, timeZone);
  // An hour skipped by the clock change is nudged forward rather than refused: a closure
  // is a blunt instrument and an hour either side of it changes nothing.
  return instant === null ? localHourToInstant(date, hour + 1, timeZone) : instant;
}

function presentForStaff(booking) {
  return {
    id: booking.id,
    status: booking.status,
    startUtc: booking.start_utc,
    endUtc: booking.end_utc,
    hours: Math.round((Date.parse(booking.end_utc) - Date.parse(booking.start_utc)) / HOUR_MS),
    lane: { id: booking.lane_id, name: booking.lane_name },
    shooter: {
      name: `${booking.first_name} ${booking.last_name}`,
      phone: booking.shooter_phone,
      email: booking.shooter_email,
    },
  };
}

function normaliseWeek(days) {
  const byWeekday = new Map(days.map((day) => [day.weekday, day]));
  return WEEK.map((weekday) => {
    const day = byWeekday.get(weekday);
    return day
      ? { weekday, open: true, startHour: day.start_hour, endHour: day.end_hour }
      : { weekday, open: false, startHour: null, endHour: null };
  });
}

function validWeek(days) {
  if (!Array.isArray(days)) throw new Refused('missing_fields');
  return days
    .filter((day) => day?.open)
    .map((day) => {
      const weekday = Number(day.weekday);
      const startHour = Number(day.startHour);
      const endHour = Number(day.endHour);
      if (
        !WEEK.includes(weekday) ||
        !Number.isInteger(startHour) || startHour < 0 || startHour > 23 ||
        !Number.isInteger(endHour) || endHour < 1 || endHour > 24 ||
        endHour <= startHour
      ) {
        throw new Refused('invalid_hours');
      }
      return { weekday, startHour, endHour };
    });
}

export { hashPassword };
