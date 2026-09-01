import { dateLabel, hourIn } from '../format.js';

/**
 * The availability grid, shared by the widget and the app.
 *
 * It renders exactly what the API returns: free or unavailable. It has no way of telling a
 * closure from a booking, because the API does not tell it (ADR 0002) -- there is nothing
 * here to leak even if someone reads the bundle.
 */
export function SlotGrid({ lane, timeZone, onPick, selected }) {
  const openDays = lane.days.filter((day) => day.slots.length > 0);

  return (
    <section className="lane">
      <div className="lane-head">
        <h3>{lane.name}</h3>
        <span className="muted">{lane.distanceM} m</span>
      </div>

      {openDays.length === 0 ? (
        <p className="muted">Brak wolnych terminów w tym zakresie dat.</p>
      ) : (
        openDays.map((day) => (
          <div className="day" key={day.date}>
            <div className="day-name">{dateLabel(day.date)}</div>
            <div className="slots">
              {day.slots.map((slot) => {
                const taken = slot.state !== 'free';
                return (
                  <button
                    key={slot.startUtc}
                    type="button"
                    className="slot"
                    disabled={taken}
                    aria-pressed={selected === slot.startUtc}
                    title={taken ? 'Termin niedostępny' : 'Wolne'}
                    onClick={() => onPick?.(lane, slot)}
                  >
                    {hourIn(slot.startUtc, timeZone)}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
