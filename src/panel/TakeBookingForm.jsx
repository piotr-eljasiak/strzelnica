import { useState } from 'react';

import { panelApi, refusalText } from '../api.js';

/**
 * Taking a booking at the counter or over the phone.
 *
 * Two ways in: a customer this range already knows, or someone new given by name and
 * phone. Searching is deliberately limited to people who have booked here before -- the
 * panel is not a directory of the platform's users (ADR 0009).
 */
export function TakeBookingForm({ lanes, onBooked }) {
  const [draft, setDraft] = useState({
    laneId: lanes[0]?.id ?? 0,
    date: '',
    hour: 10,
    slotCount: 1,
  });
  const [term, setTerm] = useState('');
  const [found, setFound] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [guest, setGuest] = useState({ name: '', phone: '' });
  const [problem, setProblem] = useState(null);
  const [needsConfirming, setNeedsConfirming] = useState(false);
  const [done, setDone] = useState(null);

  async function search(value) {
    setTerm(value);
    setChosen(null);
    if (value.trim().length < 3) {
      setFound(null);
      return;
    }
    const { shooters } = await panelApi.knownShooters(value.trim());
    setFound(shooters);
  }

  async function submit(acknowledged) {
    setProblem(null);
    setDone(null);

    if (!draft.date) {
      setProblem({ reason: 'missing_fields' });
      return;
    }

    try {
      await panelApi.takeBooking({
        laneId: Number(draft.laneId),
        startUtc: localHourToIso(draft.date, Number(draft.hour)),
        slotCount: Number(draft.slotCount),
        ...(chosen ? { shooterId: chosen.id } : { guest }),
        acknowledged,
      });
      setDone(chosen ? chosen.name : guest.name);
      setNeedsConfirming(false);
      setGuest({ name: '', phone: '' });
      setChosen(null);
      setTerm('');
      setFound(null);
      onBooked?.();
    } catch (error) {
      // Outside opening hours is the one refusal staff are allowed to overrule.
      if (error.reason === 'outside_schedule' && error.detail?.waivable) {
        setNeedsConfirming(true);
      } else {
        setProblem(error);
      }
    }
  }

  return (
    <>
      <h2>Zapisz klienta</h2>
      <p className="muted">
        Dla rezerwacji przyjętych przy ladzie i przez telefon. Limity strzelca tu nie
        obowiązują.
      </p>

      {done && <div className="notice">Zapisano: {done}.</div>}
      {problem && <div className="notice bad">{refusalText(problem)}</div>}

      {needsConfirming && (
        <div className="notice bad">
          <strong>Ten termin wypada poza godzinami otwarcia osi.</strong>
          <p>Zapisz tylko wtedy, gdy strzelnica faktycznie będzie wtedy otwarta.</p>
          <button className="primary" onClick={() => submit(true)}>
            Zapisz mimo to
          </button>{' '}
          <button className="plain" onClick={() => setNeedsConfirming(false)}>
            Anuluj
          </button>
        </div>
      )}

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          submit(false);
        }}
      >
        <label>
          Oś
          <select
            value={draft.laneId}
            onChange={(event) => setDraft({ ...draft, laneId: event.target.value })}
          >
            {lanes.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Dzień
          <input
            type="date"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            required
          />
        </label>

        <label>
          Godzina
          <input
            type="number"
            min="0"
            max="23"
            value={draft.hour}
            onChange={(event) => setDraft({ ...draft, hour: event.target.value })}
          />
        </label>

        <label>
          Liczba godzin
          <input
            type="number"
            min="1"
            max="8"
            value={draft.slotCount}
            onChange={(event) => setDraft({ ...draft, slotCount: event.target.value })}
          />
        </label>

        <label>
          Stały klient
          <input
            value={term}
            placeholder="nazwisko, e-mail lub telefon"
            onChange={(event) => search(event.target.value)}
          />
          <span className="muted">
            Szuka wyłącznie wśród osób, które już u nas rezerwowały.
          </span>
        </label>

        {found?.length === 0 && (
          <p className="muted">Nikogo takiego u nas nie było — wpisz dane poniżej.</p>
        )}

        {found?.map((shooter) => (
          <label className="inline" key={shooter.id}>
            <input
              type="radio"
              name="klient"
              checked={chosen?.id === shooter.id}
              onChange={() => setChosen(shooter)}
            />
            {shooter.name} · {shooter.phone} · {shooter.email}
          </label>
        ))}

        {!chosen && (
          <>
            <label>
              Imię i nazwisko
              <input
                value={guest.name}
                onChange={(event) => setGuest({ ...guest, name: event.target.value })}
                required
              />
            </label>
            <label>
              Telefon
              <input
                value={guest.phone}
                onChange={(event) => setGuest({ ...guest, phone: event.target.value })}
                required
              />
            </label>
          </>
        )}

        <div>
          <button className="primary">Zapisz rezerwację</button>
        </div>
      </form>
    </>
  );
}

/** A local wall-clock hour at the range, as a UTC instant. */
function localHourToIso(date, hour, timeZone = 'Europe/Warsaw') {
  const [year, month, day] = date.split('-').map(Number);
  const naive = Date.UTC(year, month - 1, day, hour);
  const shift = (instant) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(instant));
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    return (
      Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute')) -
      instant
    );
  };
  let instant = naive - shift(naive);
  instant = naive - shift(instant);
  return new Date(instant).toISOString().replace('.000', '');
}
