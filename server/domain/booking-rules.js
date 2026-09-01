/**
 * The rules that decide whether a booking may be made or cancelled.
 *
 * Pure, like availability: the database and the clock stay outside. Every refusal carries
 * a distinct reason, because each one leads the interface somewhere different -- "someone
 * just took it" sends the shooter back to the calendar, "you have too many" does not.
 *
 * These rules are enforced here, on the server. Validation in the browser is a courtesy
 * to the user, never a safeguard (ADR 0005): the widget's code is public.
 */

import { HOUR_MS, localDate, localHourToInstant, toIso, weekdayOf } from './time.js';
import { FREE, slotsOnDate } from './availability.js';

export const REFUSAL = {
  IN_THE_PAST: 'in_the_past',
  BEYOND_HORIZON: 'beyond_horizon',
  NOT_CONTIGUOUS: 'not_contiguous',
  OUTSIDE_SCHEDULE: 'outside_schedule',
  SLOT_TAKEN: 'slot_taken',
  TOO_MANY_ACTIVE: 'too_many_active',
  TOO_MANY_SLOTS_TODAY: 'too_many_slots_today',
  EMPTY: 'empty',
  SPANS_TWO_DAYS: 'spans_two_days',
};

const allow = () => ({ allowed: true });
const refuse = (reason, detail) => ({ allowed: false, reason, ...detail });

/**
 * Whether these slots may become a booking.
 *
 * `slots` are ISO instants of whole local hours, in order. Several of them make one
 * booking only when they touch (ADR 0003): a gap in the middle would be a second booking
 * wearing the first one's clothes.
 */
export function checkBooking({
  slots,
  schedule,
  timeZone,
  horizonDays,
  maxActiveBookings,
  maxSlotsPerDay,
  activeBookingCount,
  slotsAlreadyBookedThatDay,
  takenSlots,
  closures,
  nowMs,
}) {
  if (!Array.isArray(slots) || slots.length === 0) return refuse(REFUSAL.EMPTY);

  const startsMs = slots.map((slot) => Date.parse(slot));
  if (startsMs.some(Number.isNaN)) return refuse(REFUSAL.EMPTY);

  const sorted = [...startsMs].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] !== HOUR_MS) return refuse(REFUSAL.NOT_CONTIGUOUS);
  }

  const firstMs = sorted[0];
  const lastEndMs = sorted[sorted.length - 1] + HOUR_MS;

  if (firstMs < nowMs) return refuse(REFUSAL.IN_THE_PAST);

  // A booking belongs to one local day. Crossing midnight would put its slots under two
  // different daily limits, so it is refused rather than silently counted twice.
  const day = localDate(firstMs, timeZone);
  if (localDate(lastEndMs - HOUR_MS, timeZone) !== day) {
    return refuse(REFUSAL.SPANS_TWO_DAYS);
  }

  const lastBookableDay = addDaysToDate(localDate(nowMs, timeZone), horizonDays);
  if (day > lastBookableDay) {
    return refuse(REFUSAL.BEYOND_HORIZON, { horizonDays, lastBookableDay });
  }

  const openHours = new Set(
    slotsOnDate({ date: day, schedule, timeZone }).map((slot) => slot.startMs),
  );
  if (sorted.some((startMs) => !openHours.has(startMs))) {
    return refuse(REFUSAL.OUTSIDE_SCHEDULE);
  }

  const taken = new Set(takenSlots);
  if (sorted.some((startMs) => taken.has(toIso(startMs)))) {
    return refuse(REFUSAL.SLOT_TAKEN);
  }

  const closed = closures.map((closure) => ({
    startMs: Date.parse(closure.start_utc),
    endMs: Date.parse(closure.end_utc),
  }));
  const hitsClosure = sorted.some((startMs) =>
    closed.some((c) => c.startMs < startMs + HOUR_MS && c.endMs > startMs),
  );
  // A closure is refused with the same reason as a taken slot: the shooter is told the
  // time is gone, never why (ADR 0002).
  if (hitsClosure) return refuse(REFUSAL.SLOT_TAKEN);

  if (activeBookingCount >= maxActiveBookings) {
    return refuse(REFUSAL.TOO_MANY_ACTIVE, { maxActiveBookings });
  }

  if (slotsAlreadyBookedThatDay + sorted.length > maxSlotsPerDay) {
    return refuse(REFUSAL.TOO_MANY_SLOTS_TODAY, { maxSlotsPerDay });
  }

  return allow();
}

export const CANCEL_REFUSAL = {
  NOT_YOURS: 'not_yours',
  ALREADY_CANCELLED: 'already_cancelled',
  ALREADY_STARTED: 'already_started',
  TOO_LATE: 'too_late',
};

/**
 * Whether a shooter may cancel their own booking.
 *
 * The window is the range's (24 h by default). Past it the booking still exists; only the
 * range's staff can release it, which is why the refusal carries the range's phone number
 * for the interface to show (story 30).
 */
export function checkCancellation({ booking, shooterId, nowMs }) {
  if (booking.shooter_id !== shooterId) return refuse(CANCEL_REFUSAL.NOT_YOURS);
  if (booking.status === 'cancelled') return refuse(CANCEL_REFUSAL.ALREADY_CANCELLED);

  const startMs = Date.parse(booking.start_utc);
  if (startMs <= nowMs) return refuse(CANCEL_REFUSAL.ALREADY_STARTED);

  const deadlineMs = startMs - booking.cancellation_window_hours * HOUR_MS;
  if (nowMs > deadlineMs) {
    return refuse(CANCEL_REFUSAL.TOO_LATE, {
      windowHours: booking.cancellation_window_hours,
      deadlineUtc: toIso(deadlineMs),
      rangePhone: booking.range_phone,
    });
  }

  return allow();
}

/** The moment after which a booking can no longer be cancelled by its shooter. */
export function cancellationDeadline(booking) {
  return toIso(Date.parse(booking.start_utc) - booking.cancellation_window_hours * HOUR_MS);
}

/** Expands a start instant and a slot count into the slots the booking occupies. */
export function slotsFrom(startUtc, count) {
  const startMs = Date.parse(startUtc);
  return Array.from({ length: count }, (_, i) => toIso(startMs + i * HOUR_MS));
}

function addDaysToDate(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return moved.toISOString().slice(0, 10);
}

// Re-exported so callers can build a schedule check without reaching past this module.
export { weekdayOf, localHourToInstant, FREE };
