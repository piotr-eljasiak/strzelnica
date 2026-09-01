/**
 * Converting between a range's local wall-clock time and absolute UTC instants.
 *
 * Schedules are written in local time ("open 9 to 20"), bookings are stored as instants.
 * The translation between them is the only place daylight saving can bite, so it lives
 * here alone and nowhere else.
 *
 * No module reads the system clock: "now" is always passed in (see the spec's testing
 * decisions -- the 24 h cancellation window and the 30 day horizon are only testable when
 * the clock is an input).
 */

const formatters = new Map();

function partsFormatter(timeZone) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock fields of an instant, as seen in `timeZone`. */
export function localParts(instantMs, timeZone) {
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(new Date(instantMs))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  // Some environments render midnight as hour 24; normalise it.
  const hour = parts.hour % 24;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour,
    minute: parts.minute,
    date: isoDate(parts.year, parts.month, parts.day),
    weekday: new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay(),
  };
}

function offsetMs(instantMs, timeZone) {
  const parts = localParts(instantMs, timeZone);
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return asIfUtc - Math.floor(instantMs / 60000) * 60000;
}

/**
 * The instant at which the given wall-clock hour occurs in `timeZone`, or null when that
 * hour does not exist -- the hour skipped when the clocks go forward.
 *
 * Two passes: guess using the offset at the naive instant, then re-check using the offset
 * at the guess. One pass is wrong for times near a transition.
 */
export function localHourToInstant(date, hour, timeZone) {
  const [year, month, day] = date.split('-').map(Number);
  const naive = Date.UTC(year, month - 1, day, hour);

  let instant = naive - offsetMs(naive, timeZone);
  instant = naive - offsetMs(instant, timeZone);

  // If the wall clock at this instant is not the hour we asked for, that hour was skipped.
  const check = localParts(instant, timeZone);
  if (check.date !== date || check.hour !== hour) return null;

  return instant;
}

export function isoDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The calendar date on which an instant falls, as seen in `timeZone`. */
export function localDate(instantMs, timeZone) {
  return localParts(instantMs, timeZone).date;
}

export function addDays(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return isoDate(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate());
}

/** Inclusive list of dates from `from` to `to`. */
export function datesBetween(from, to) {
  const dates = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function weekdayOf(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export const toIso = (instantMs) => new Date(instantMs).toISOString().replace('.000', '');

export const HOUR_MS = 3600000;
