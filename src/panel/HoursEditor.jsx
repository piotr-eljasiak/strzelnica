import { useState } from 'react';

const DAY_NAMES = [
  'niedziela',
  'poniedziałek',
  'wtorek',
  'środa',
  'czwartek',
  'piątek',
  'sobota',
];

/**
 * A week of opening hours.
 *
 * A day that is not open has no hours at all, rather than 0-0: the schema says a missing
 * weekday means closed, and the form says the same thing rather than inventing a third
 * state that would then need translating.
 */
export function HoursEditor({ week, onSave, note }) {
  const [days, setDays] = useState(week);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(weekday, changes) {
    setSaved(false);
    setDays(days.map((day) => (day.weekday === weekday ? { ...day, ...changes } : day)));
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(days);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {note && <p className="muted">{note}</p>}

      <table className="hours">
        <tbody>
          {days.map((day) => (
            <tr key={day.weekday}>
              <td className="hours-day">{DAY_NAMES[day.weekday]}</td>
              <td>
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={day.open}
                    onChange={(event) =>
                      update(day.weekday, {
                        open: event.target.checked,
                        startHour: event.target.checked ? (day.startHour ?? 9) : null,
                        endHour: event.target.checked ? (day.endHour ?? 20) : null,
                      })
                    }
                  />
                  czynne
                </label>
              </td>
              <td>
                {day.open && (
                  <span className="hours-range">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={day.startHour ?? 9}
                      onChange={(event) =>
                        update(day.weekday, { startHour: Number(event.target.value) })
                      }
                    />
                    <span>–</span>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={day.endHour ?? 20}
                      onChange={(event) =>
                        update(day.weekday, { endHour: Number(event.target.value) })
                      }
                    />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? 'Zapisuję…' : 'Zapisz grafik'}
        </button>{' '}
        {saved && <span className="muted">zapisano</span>}
      </p>
    </div>
  );
}
