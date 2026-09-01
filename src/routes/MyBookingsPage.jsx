import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api, refusalText } from '../api.js';
import { fullMoment } from '../format.js';
import { AuthForm } from '../components/AuthForm.jsx';

/** A shooter's bookings across every range, in one place (story 26). */
export function MyBookingsPage({ shooter, onShooterChange }) {
  const [bookings, setBookings] = useState(null);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    if (!shooter) return;
    api.bookings().then((data) => setBookings(data.bookings));
  }, [shooter]);

  if (!shooter) {
    return (
      <div className="page">
        <div className="bar">
          <h1>Moje rezerwacje</h1>
        </div>
        <AuthForm onDone={onShooterChange} />
      </div>
    );
  }

  async function cancel(id) {
    setProblem(null);
    try {
      await api.cancel(id);
      setBookings((await api.bookings()).bookings);
    } catch (error) {
      setProblem(error);
    }
  }

  const now = Date.now();
  const upcoming = (bookings ?? []).filter(
    (booking) => booking.status === 'confirmed' && Date.parse(booking.endUtc) > now,
  );
  const past = (bookings ?? []).filter((booking) => !upcoming.includes(booking));

  return (
    <div className="page">
      <div className="bar">
        <h1>Moje rezerwacje</h1>
        <span className="muted">
          {shooter.firstName} {shooter.lastName}
        </span>
      </div>

      {problem && <div className="notice bad">{refusalText(problem)}{problem.detail?.rangePhone ? ` Zadzwoń: ${problem.detail.rangePhone}` : ''}</div>}

      {bookings === null && <p className="muted">Wczytywanie…</p>}

      {bookings !== null && upcoming.length === 0 && (
        <p className="muted">
          Nie masz nadchodzących rezerwacji. <Link to="/">Zobacz strzelnice</Link>.
        </p>
      )}

      {upcoming.map((booking) => (
        <div className="card" key={booking.id}>
          <div>
            <strong>{booking.range.name}</strong>, {booking.lane.name}
            <div className="muted">{fullMoment(booking.startUtc, booking.range.timeZone)}</div>
            <div className="muted">
              Anulowanie możliwe do{' '}
              {fullMoment(booking.cancellableUntilUtc, booking.range.timeZone)}
            </div>
          </div>
          <button className="plain" onClick={() => cancel(booking.id)}>
            Anuluj
          </button>
        </div>
      ))}

      {past.length > 0 && (
        <>
          <h2>Historia</h2>
          {past.map((booking) => (
            <div className="card gone" key={booking.id}>
              <div>
                <strong>{booking.range.name}</strong>, {booking.lane.name}
                <div className="muted">
                  {fullMoment(booking.startUtc, booking.range.timeZone)}
                  {booking.status === 'cancelled' ? ' — anulowana' : ''}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
