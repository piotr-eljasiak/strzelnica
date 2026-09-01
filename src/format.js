/** Formatting instants for a shooter, always in the range's own time zone. */

const DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

export function hourIn(instantUtc, timeZone) {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(instantUtc));
}

export function dateLabel(date) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`;
}

export function fullMoment(instantUtc, timeZone) {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(instantUtc));
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Polish plurals: 1 rezerwację, 2 rezerwacje, 5 rezerwacji.
 * Three forms, not two -- picking the wrong one is the sort of thing that makes an
 * interface read as machine-translated.
 */
export function plural(count, one, few, many) {
  const last = count % 10;
  const lastTwo = count % 100;
  if (count === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}
