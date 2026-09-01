/**
 * Working out which slots on a lane are free.
 *
 * Pure: it reads no database and no clock. Everything it needs -- the schedule, the
 * closures, the taken slots and "now" -- arrives as arguments, which is what makes the
 * rules testable without a fixture that drifts with the calendar.
 *
 * A slot is one whole hour of local time on one lane. Only two states reach the outside
 * world: free, or unavailable. A closure and a booking are indistinguishable here on
 * purpose (ADR 0002) -- a visitor must not be able to read the range's internal business
 * out of the calendar.
 */

import {
  HOUR_MS,
  addDays,
  datesBetween,
  localDate,
  localHourToInstant,
  toIso,
  weekdayOf,
} from './time.js';

export const FREE = 'free';
export const UNAVAILABLE = 'unavailable';

/**
 * The window a shooter may book in: from today in the range's local time, through the
 * horizon. The horizon counts days, not hours, so "30 days" ends at the close of that day.
 */
export function bookableDateRange({ nowMs, timeZone, horizonDays }) {
  const from = localDate(nowMs, timeZone);
  return { from, to: addDays(from, horizonDays) };
}

/**
 * The slots a schedule opens on one date, as absolute instants.
 *
 * Returns [] for a weekday the schedule does not cover -- that is a closed day, which is
 * why a lane with its own schedule is closed on days it does not list rather than falling
 * back to the range's hours.
 */
export function slotsOnDate({ date, schedule, timeZone }) {
  const hours = schedule.days.find((day) => day.weekday === weekdayOf(date));
  if (!hours) return [];

  const slots = [];
  for (let hour = hours.start_hour; hour < hours.end_hour; hour += 1) {
    const startMs = localHourToInstant(date, hour, timeZone);
    // Null means the wall clock skipped this hour when the clocks went forward. There is
    // no such moment to sell, so it is simply absent from the day.
    if (startMs === null) continue;
    slots.push({ hour, startMs });
  }
  return slots;
}

/**
 * Availability of one lane across a range of dates.
 *
 * Slots that have already started are left out entirely rather than marked unavailable:
 * offering the past and then refusing it is worse than not offering it (story 9).
 */
export function laneAvailability({
  schedule,
  timeZone,
  from,
  to,
  closures,
  bookedSlots,
  nowMs,
}) {
  const taken = new Set(bookedSlots);
  const closedRanges = closures.map((closure) => ({
    startMs: Date.parse(closure.start_utc),
    endMs: Date.parse(closure.end_utc),
  }));

  return datesBetween(from, to).map((date) => ({
    date,
    slots: slotsOnDate({ date, schedule, timeZone })
      .filter((slot) => slot.startMs >= nowMs)
      .map((slot) => ({
        startUtc: toIso(slot.startMs),
        hour: slot.hour,
        state:
          taken.has(toIso(slot.startMs)) || overlapsClosure(slot.startMs, closedRanges)
            ? UNAVAILABLE
            : FREE,
      })),
  }));
}

function overlapsClosure(slotStartMs, closedRanges) {
  const slotEndMs = slotStartMs + HOUR_MS;
  return closedRanges.some(
    (closed) => closed.startMs < slotEndMs && closed.endMs > slotStartMs,
  );
}
