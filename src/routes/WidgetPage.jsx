import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { api } from '../api.js';
import { addDays, dateLabel, today } from '../format.js';
import { SlotGrid } from '../components/SlotGrid.jsx';

const DAYS_PER_PAGE = 7;

/**
 * The widget: a range's availability, embedded in the range's own website.
 *
 * Anonymous by design. It never logs anyone in and never reads a session -- inside a
 * third-party frame the cookie would not arrive anyway. Picking a slot leaves the frame
 * (ADR 0002): the whole window navigates to the app, where the shooter is first-party and
 * the session works.
 *
 * A week at a time, paged: thirty days of hourly buttons at once is a wall nobody reads.
 * How far the paging may go comes from the range's horizon, not from a constant here.
 */
export function WidgetPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const embedded = params.get('embed') === '1';

  const [offset, setOffset] = useState(0);
  const [state, setState] = useState({ status: 'loading' });
  const root = useRef(null);

  const from = addDays(today(), offset);
  const to = addDays(from, DAYS_PER_PAGE - 1);

  useEffect(() => {
    let live = true;
    setState((previous) => ({ ...previous, loading: true }));
    api
      .availability(slug, from, to)
      .then((data) => live && setState({ status: 'ready', data }))
      .catch((error) => live && setState({ status: 'error', error }));
    return () => {
      live = false;
    };
  }, [slug, from, to]);

  // Tell the embedding page how tall we are, so it can size the frame instead of
  // showing an inner scrollbar (story 35).
  useEffect(() => {
    if (!embedded || !root.current) return undefined;

    const report = () =>
      window.parent.postMessage(
        { type: 'strzelnica:height', slug, height: root.current.scrollHeight },
        '*',
      );

    report();
    const observer = new ResizeObserver(report);
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [embedded, slug, state.status, offset]);

  function pick(lane, slot) {
    const target = new URL('/book', window.location.origin);
    target.searchParams.set('range', slug);
    target.searchParams.set('lane', String(lane.id));
    target.searchParams.set('start', slot.startUtc);

    // The whole window, not the frame. Finishing inside the frame would need a session
    // cookie that browsers will not send there.
    window.top.location.href = target.toString();
  }

  if (state.status === 'loading') return <div className="widget muted">Wczytywanie…</div>;
  if (state.status === 'error') {
    return <div className="widget notice bad">Nie udało się wczytać terminów.</div>;
  }

  const { data } = state;
  const canGoBack = offset > 0;
  // The server knows the horizon; asking for days past it would only be clamped back.
  const canGoForward = to < data.latestDate;

  return (
    <div className={embedded ? 'widget' : 'page'} ref={root}>
      {!embedded && (
        <div className="bar">
          <h1>{data.range.name}</h1>
          <span className="muted">Wybierz termin</span>
        </div>
      )}

      <div className="paging">
        <button
          type="button"
          className="plain"
          disabled={!canGoBack}
          onClick={() => setOffset(Math.max(0, offset - DAYS_PER_PAGE))}
        >
          ← Wcześniej
        </button>
        <span className="muted">
          {dateLabel(data.from)} – {dateLabel(data.to)}
        </span>
        <button
          type="button"
          className="plain"
          disabled={!canGoForward}
          onClick={() => setOffset(offset + DAYS_PER_PAGE)}
        >
          Później →
        </button>
      </div>

      {data.lanes.map((lane) => (
        <SlotGrid key={lane.id} lane={lane} timeZone={data.range.timeZone} onPick={pick} />
      ))}

      <p className="muted">
        Kliknij godzinę, aby zarezerwować. Rezerwację potwierdzisz na stronie systemu.
        {!canGoForward && ' Dalej niż do ' + dateLabel(data.latestDate) + ' rezerwacji nie przyjmujemy.'}
      </p>
    </div>
  );
}
