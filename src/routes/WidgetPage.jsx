import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { api } from '../api.js';
import { addDays, today } from '../format.js';
import { SlotGrid } from '../components/SlotGrid.jsx';

const DAYS_SHOWN = 7;

/**
 * The widget: a range's availability, embedded in the range's own website.
 *
 * Anonymous by design. It never logs anyone in and never reads a session -- inside a
 * third-party frame the cookie would not arrive anyway. Picking a slot leaves the frame
 * (ADR 0002): the whole window navigates to the app, where the shooter is first-party and
 * the session works.
 */
export function WidgetPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const embedded = params.get('embed') === '1';

  const [state, setState] = useState({ status: 'loading' });
  const root = useRef(null);

  const from = today();
  const to = addDays(from, DAYS_SHOWN);

  useEffect(() => {
    let live = true;
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
  }, [embedded, slug, state.status]);

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

  return (
    <div className={embedded ? 'widget' : 'page'} ref={root}>
      {!embedded && (
        <div className="bar">
          <h1>{data.range.name}</h1>
          <span className="muted">Wybierz termin</span>
        </div>
      )}

      {data.lanes.map((lane) => (
        <SlotGrid key={lane.id} lane={lane} timeZone={data.range.timeZone} onPick={pick} />
      ))}

      <p className="muted">
        Kliknij godzinę, aby zarezerwować. Rezerwację potwierdzisz na stronie systemu.
      </p>
    </div>
  );
}
