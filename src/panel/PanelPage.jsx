import { useEffect, useState } from 'react';

import { panelApi, refusalText } from '../api.js';
import { fullMoment, hourIn, plural } from '../format.js';
import { HoursEditor } from './HoursEditor.jsx';
import { TakeBookingForm } from './TakeBookingForm.jsx';

const TABS = [
  ['bookings', 'Rezerwacje'],
  ['lanes', 'Osie'],
  ['hours', 'Grafik'],
  ['closures', 'Blokady'],
  ['settings', 'Ustawienia'],
  ['widget', 'Widget'],
];

/**
 * The range staff's panel.
 *
 * Signs in against its own endpoint with its own cookie, so being signed in here says
 * nothing about being signed in as a shooter, and vice versa (ADR 0008).
 */
export function PanelPage() {
  const [overview, setOverview] = useState(null);
  const [tab, setTab] = useState('bookings');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    panelApi
      .overview()
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null;
  if (!overview) return <PanelLogin onDone={setOverview} />;

  const reload = () => panelApi.overview().then(setOverview);

  return (
    <div className="page">
      <div className="bar">
        <h1>{overview.range.name}</h1>
        <span className="muted">
          {overview.staff.name}{' '}
          <button
            className="plain"
            onClick={() => panelApi.logout().then(() => setOverview(null))}
          >
            Wyloguj
          </button>
        </span>
      </div>

      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className="plain"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'bookings' && (
        <BookingsTab timeZone={overview.range.timeZone} lanes={overview.lanes} />
      )}
      {tab === 'lanes' && <LanesTab overview={overview} reload={reload} />}
      {tab === 'hours' && <HoursTab overview={overview} reload={reload} />}
      {tab === 'closures' && <ClosuresTab overview={overview} />}
      {tab === 'settings' && <SettingsTab overview={overview} reload={reload} />}
      {tab === 'widget' && <WidgetTab overview={overview} />}
    </div>
  );
}

function PanelLogin({ onDone }) {
  const [fields, setFields] = useState({ email: '', password: '' });
  const [problem, setProblem] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setProblem(null);
    try {
      onDone(await panelApi.login(fields));
    } catch (error) {
      setProblem(error);
    }
  }

  return (
    <div className="page">
      <div className="bar">
        <h1>Panel strzelnicy</h1>
      </div>
      <form className="stack" onSubmit={submit}>
        <label>
          E-mail
          <input
            type="email"
            value={fields.email}
            onChange={(event) => setFields({ ...fields, email: event.target.value })}
            required
          />
        </label>
        <label>
          Hasło
          <input
            type="password"
            value={fields.password}
            onChange={(event) => setFields({ ...fields, password: event.target.value })}
            required
          />
        </label>
        {problem && <div className="notice bad">{refusalText(problem)}</div>}
        <div>
          <button className="primary">Zaloguj</button>
        </div>
      </form>
    </div>
  );
}

function BookingsTab({ timeZone, lanes }) {
  const [bookings, setBookings] = useState(null);
  const [problem, setProblem] = useState(null);

  const load = () => panelApi.bookings().then((data) => setBookings(data.bookings));
  useEffect(() => {
    load();
  }, []);

  async function cancel(booking) {
    const note = window.prompt(
      `Powód anulowania rezerwacji: ${booking.customer.name}, ${fullMoment(booking.startUtc, timeZone)}`,
    );
    if (!note?.trim()) return;
    setProblem(null);
    try {
      await panelApi.cancelBooking(booking.id, note);
      await load();
    } catch (error) {
      setProblem(error);
    }
  }

  if (!bookings) return <p className="muted">Wczytywanie…</p>;

  return (
    <>
      {problem && <div className="notice bad">{refusalText(problem)}</div>}

      {bookings.length === 0 ? (
        <p className="muted">Brak nadchodzących rezerwacji.</p>
      ) : (
        bookings.map((booking) => (
          <div className="card" key={booking.id}>
            <div>
              <strong>{fullMoment(booking.startUtc, timeZone)}</strong>
              {booking.hours > 1 ? ` (${booking.hours} h)` : ''} — {booking.lane.name}
              <div className="muted">
                {booking.customer.name} · {booking.customer.phone}
                {booking.customer.email ? ` · ${booking.customer.email}` : ''}
                {booking.takenByStaff ? ' · przyjęta przez obsługę' : ''}
              </div>
            </div>
            <button className="plain" onClick={() => cancel(booking)}>
              Anuluj
            </button>
          </div>
        ))
      )}

      <TakeBookingForm lanes={lanes} onBooked={load} />
    </>
  );
}

function LanesTab({ overview, reload }) {
  const [draft, setDraft] = useState({ name: '', distanceM: 25 });
  const [problem, setProblem] = useState(null);

  async function act(action) {
    setProblem(null);
    try {
      await action();
      await reload();
    } catch (error) {
      setProblem(error);
    }
  }

  return (
    <>
      {problem && <div className="notice bad">{refusalText(problem)}</div>}

      {overview.lanes.map((lane) => (
        <div className="card" key={lane.id}>
          <div>
            <strong>{lane.name}</strong> <span className="muted">{lane.distanceM} m</span>
            <div className="muted">
              {lane.inheritsHours ? 'grafik dziedziczony ze strzelnicy' : 'grafik własny'}
            </div>
          </div>
          <button
            className="plain"
            onClick={() => act(() => panelApi.removeLane(lane.id))}
          >
            Usuń
          </button>
        </div>
      ))}

      <h2>Dodaj oś</h2>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          act(async () => {
            await panelApi.addLane(draft);
            setDraft({ name: '', distanceM: 25 });
          });
        }}
      >
        <label>
          Nazwa
          <input
            value={draft.name}
            placeholder="Oś 50 m"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            required
          />
        </label>
        <label>
          Dystans (m)
          <input
            type="number"
            min="1"
            value={draft.distanceM}
            onChange={(event) => setDraft({ ...draft, distanceM: Number(event.target.value) })}
            required
          />
        </label>
        <div>
          <button className="primary">Dodaj</button>
        </div>
      </form>
    </>
  );
}

function HoursTab({ overview, reload }) {
  const [problem, setProblem] = useState(null);

  const save = (action) => async (days) => {
    setProblem(null);
    try {
      await action(days);
      await reload();
    } catch (error) {
      setProblem(error);
      throw error;
    }
  };

  return (
    <>
      {problem && <div className="notice bad">{refusalText(problem)}</div>}

      <h2>Godziny strzelnicy</h2>
      <HoursEditor
        key={`range-${JSON.stringify(overview.rangeHours)}`}
        week={overview.rangeHours}
        note="Obowiązują każdą oś, która nie ma własnego grafiku."
        onSave={save(panelApi.setRangeHours)}
      />

      {overview.lanes.map((lane) => (
        <div key={lane.id}>
          <h2>{lane.name}</h2>
          <HoursEditor
            key={`lane-${lane.id}-${JSON.stringify(lane.hours)}`}
            week={lane.hours}
            note={
              lane.inheritsHours
                ? 'Ta oś dziedziczy godziny strzelnicy. Zaznaczenie czegokolwiek nadaje jej własny grafik; odznaczenie wszystkiego przywraca dziedziczenie.'
                : 'Ta oś ma własny grafik. Odznaczenie wszystkich dni przywraca dziedziczenie.'
            }
            onSave={save((days) => panelApi.setLaneHours(lane.id, days))}
          />
        </div>
      ))}
    </>
  );
}

function ClosuresTab({ overview }) {
  const [closures, setClosures] = useState(null);
  const [draft, setDraft] = useState({
    laneId: overview.lanes[0]?.id ?? 0,
    date: '',
    startHour: 8,
    endHour: 14,
    reason: '',
  });
  const [problem, setProblem] = useState(null);
  const [collisions, setCollisions] = useState(null);

  const load = () => panelApi.closures().then((data) => setClosures(data.closures));
  useEffect(() => {
    load();
  }, []);

  async function submit(acknowledged) {
    setProblem(null);
    const body = {
      laneId: Number(draft.laneId),
      // Hours are entered as the range's local time; the server keeps instants in UTC.
      startUtc: localToIso(draft.date, draft.startHour, overview.range.timeZone),
      endUtc: localToIso(draft.date, draft.endHour, overview.range.timeZone),
      reason: draft.reason,
      acknowledged,
    };
    try {
      await panelApi.addClosure(body);
      setCollisions(null);
      setDraft({ ...draft, reason: '' });
      await load();
    } catch (error) {
      if (error.reason === 'closure_collides') setCollisions(error.detail.bookings);
      else setProblem(error);
    }
  }

  return (
    <>
      {problem && <div className="notice bad">{refusalText(problem)}</div>}

      {closures?.length === 0 && <p className="muted">Brak nadchodzących blokad.</p>}
      {closures?.map((closure) => (
        <div className="card" key={closure.id}>
          <div>
            <strong>{closure.laneName}</strong> — {closure.reason}
            <div className="muted">
              {fullMoment(closure.startUtc, overview.range.timeZone)} –{' '}
              {hourIn(closure.endUtc, overview.range.timeZone)}
            </div>
          </div>
          <button
            className="plain"
            onClick={() => panelApi.removeClosure(closure.id).then(load)}
          >
            Zdejmij
          </button>
        </div>
      ))}

      <h2>Nowa blokada</h2>

      {collisions && (
        <div className="notice bad">
          <strong>
            Ta blokada obejmuje {collisions.length}{' '}
            {plural(collisions.length, 'istniejącą rezerwację', 'istniejące rezerwacje', 'istniejących rezerwacji')}.
          </strong>
          <p>
            Zakładanie blokady nie anuluje niczyjej rezerwacji. Jeśli te osoby nie mają
            przyjść — zadzwoń i anuluj każdą ręcznie w zakładce Rezerwacje.
          </p>
          <ul>
            {collisions.map((booking) => (
              <li key={booking.id}>
                {fullMoment(booking.startUtc, overview.range.timeZone)} —{' '}
                {booking.customer.name}, {booking.customer.phone}
              </li>
            ))}
          </ul>
          <button className="primary" onClick={() => submit(true)}>
            Rozumiem, załóż blokadę mimo to
          </button>{' '}
          <button className="plain" onClick={() => setCollisions(null)}>
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
            {overview.lanes.map((lane) => (
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
          Od godziny
          <input
            type="number"
            min="0"
            max="23"
            value={draft.startHour}
            onChange={(event) => setDraft({ ...draft, startHour: Number(event.target.value) })}
          />
        </label>
        <label>
          Do godziny
          <input
            type="number"
            min="1"
            max="24"
            value={draft.endHour}
            onChange={(event) => setDraft({ ...draft, endHour: Number(event.target.value) })}
          />
        </label>
        <label>
          Powód
          <input
            value={draft.reason}
            placeholder="Zawody klubowe"
            onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            required
          />
          <span className="muted">Widoczny tylko dla obsługi, nigdy dla strzelców.</span>
        </label>
        <div>
          <button className="primary">Załóż blokadę</button>
        </div>
      </form>
    </>
  );
}

function SettingsTab({ overview, reload }) {
  const [fields, setFields] = useState({
    phone: overview.range.phone,
    horizonDays: overview.range.horizonDays,
    maxActiveBookings: overview.range.maxActiveBookings,
    maxSlotsPerDay: overview.range.maxSlotsPerDay,
    cancellationWindowHours: overview.range.cancellationWindowHours,
  });
  const [problem, setProblem] = useState(null);
  const [saved, setSaved] = useState(false);

  const number = (name, label, hint) => (
    <label>
      {label}
      <input
        type="number"
        min="0"
        value={fields[name]}
        onChange={(event) => {
          setSaved(false);
          setFields({ ...fields, [name]: Number(event.target.value) });
        }}
      />
      <span className="muted">{hint}</span>
    </label>
  );

  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setProblem(null);
        try {
          await panelApi.setSettings(fields);
          setSaved(true);
          await reload();
        } catch (error) {
          setProblem(error);
        }
      }}
    >
      <label>
        Telefon
        <input
          value={fields.phone}
          onChange={(event) => setFields({ ...fields, phone: event.target.value })}
        />
        <span className="muted">Pokazywany strzelcowi, gdy na anulowanie jest za późno.</span>
      </label>
      {number('horizonDays', 'Horyzont rezerwacji (dni)', 'Jak daleko w przód można rezerwować.')}
      {number('maxActiveBookings', 'Maks. aktywnych rezerwacji', 'Na jednego strzelca, w tej strzelnicy.')}
      {number('maxSlotsPerDay', 'Maks. godzin dziennie', 'Na jednego strzelca, w jednym dniu.')}
      {number('cancellationWindowHours', 'Okno anulowania (godz.)', 'Po tym czasie anuluje tylko obsługa.')}

      {problem && <div className="notice bad">{refusalText(problem)}</div>}

      <div>
        <button className="primary">Zapisz</button> {saved && <span className="muted">zapisano</span>}
      </div>
    </form>
  );
}

function WidgetTab({ overview }) {
  const src = `${window.location.origin}/w/${overview.range.slug}?embed=1`;
  const snippet = `<iframe src="${src}" title="Rezerwacja osi" width="100%" height="600" style="border:0"></iframe>`;

  return (
    <>
      <h2>Kod do wklejenia na stronę strzelnicy</h2>
      <pre className="snippet">{snippet}</pre>

      <h2>Strony, którym wolno osadzić widget</h2>
      {overview.range.embedOrigins.length === 0 ? (
        <p className="muted">Żadna — widget nie wyświetli się nigdzie poza tym systemem.</p>
      ) : (
        <ul>
          {overview.range.embedOrigins.map((origin) => (
            <li key={origin}>
              <code>{origin}</code>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Listę zmienia admin platformy: <code>node tools/admin.js allow-origin {overview.range.slug} https://…</code>
      </p>
    </>
  );
}

/** A local wall-clock hour at a range, as a UTC instant. */
function localToIso(date, hour, timeZone) {
  if (!date) return '';
  const naive = Date.UTC(...date.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)), hour);
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
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute')) - instant;
  };
  let instant = naive - shift(naive);
  instant = naive - shift(instant);
  return new Date(instant).toISOString().replace('.000', '');
}
