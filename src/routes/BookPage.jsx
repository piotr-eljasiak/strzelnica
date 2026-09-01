import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { api, refusalText } from '../api.js';
import { fullMoment, hourIn } from '../format.js';
import { AuthForm } from '../components/AuthForm.jsx';

/**
 * Finishing a booking, always at the top level.
 *
 * This is where the shooter arrives from the widget. The chosen slot travels in the URL,
 * so it survives logging in (story 18) -- the alternative, keeping it in memory, loses it
 * the moment the session redirects.
 */
export function BookPage({ shooter, onShooterChange }) {
  const [params] = useSearchParams();
  const slug = params.get('range');
  const laneId = Number(params.get('lane'));
  const startUtc = params.get('start');
  const [slotCount, setSlotCount] = useState(1);

  const [range, setRange] = useState(null);
  const [problem, setProblem] = useState(null);
  const [booking, setBooking] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.range(slug).then(setRange).catch(() => setProblem({ reason: 'not_found' }));
  }, [slug]);

  if (!slug || !laneId || !startUtc) {
    return (
      <div className="page">
        <div className="notice bad">Brak wybranego terminu.</div>
        <p className="muted">Wróć do kalendarza strzelnicy i wybierz godzinę.</p>
      </div>
    );
  }

  const lane = range?.lanes.find((candidate) => candidate.id === laneId);

  if (booking) {
    return (
      <div className="page">
        <div className="bar">
          <h1>Rezerwacja potwierdzona</h1>
        </div>
        <div className="notice">
          <strong>{booking.range.name}</strong>, {booking.lane.name}
          <br />
          {fullMoment(booking.startUtc, booking.range.timeZone)}–
          {hourIn(booking.endUtc, booking.range.timeZone)}
        </div>
        <p className="muted">
          Możesz ją anulować do {fullMoment(booking.cancellableUntilUtc, booking.range.timeZone)}.
        </p>
        <p>
          <Link to="/moje">Moje rezerwacje</Link>
        </p>
      </div>
    );
  }

  async function confirm() {
    setSending(true);
    setProblem(null);
    try {
      setBooking(await api.book(slug, { laneId, startUtc, slotCount }));
    } catch (error) {
      setProblem(error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <div className="bar">
        <h1>Potwierdź rezerwację</h1>
        <Link to={`/w/${slug}`} className="muted">
          Zmień termin
        </Link>
      </div>

      <div className="notice">
        <strong>{range?.name ?? slug}</strong>
        {lane ? `, ${lane.name} (${lane.distanceM} m)` : ''}
        <br />
        {range ? fullMoment(startUtc, range.timeZone) : startUtc}
      </div>

      <label style={{ maxWidth: '12rem' }}>
        Liczba godzin
        <input
          type="number"
          min="1"
          max="4"
          value={slotCount}
          onChange={(event) => setSlotCount(Number(event.target.value))}
        />
      </label>

      {problem && <div className="notice bad">{refusalText(problem)}</div>}

      {shooter ? (
        <p style={{ marginTop: '1.25rem' }}>
          <button className="primary" onClick={confirm} disabled={sending}>
            {sending ? 'Rezerwuję…' : 'Rezerwuję'}
          </button>{' '}
          <span className="muted">
            jako {shooter.firstName} {shooter.lastName}
          </span>
        </p>
      ) : (
        <>
          <h2>Zaloguj się, aby dokończyć</h2>
          <p className="muted">Wybrany termin zostanie zachowany.</p>
          <AuthForm onDone={onShooterChange} />
        </>
      )}
    </div>
  );
}
