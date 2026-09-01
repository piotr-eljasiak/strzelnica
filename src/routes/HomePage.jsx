import { Link } from 'react-router-dom';

/**
 * A landing page for the local test only.
 *
 * In the real product a shooter never starts here -- they start on the range's own
 * website. This exists so the ranges in the seed data are reachable without typing URLs.
 */
export function HomePage() {
  return (
    <div className="page">
      <div className="bar">
        <h1>Rezerwacja osi strzeleckich</h1>
        <span className="muted">wersja testowa</span>
      </div>

      <p className="muted">
        Strzelnice udostępniają kalendarz na własnych stronach. Poniżej te z danych
        startowych.
      </p>

      <div className="card">
        <div>
          <strong>Strzelnica Tarczownia</strong>
          <div className="muted">Oś 25 m i oś 100 m, horyzont 30 dni</div>
        </div>
        <Link to="/w/tarczownia">Kalendarz</Link>
      </div>

      <div className="card">
        <div>
          <strong>Strzelnica Bemowo</strong>
          <div className="muted">Oś 25 m i oś 50 m, horyzont 14 dni</div>
        </div>
        <Link to="/w/bemowo">Kalendarz</Link>
      </div>

      <p className="muted">
        Widget osadzony na prawdziwej stronie strzelnicy zobaczysz pod adresem{' '}
        <a href="http://localhost:5174">http://localhost:5174</a> — tam zaczyna klient.
      </p>

      <p className="muted">
        Prowadzisz strzelnicę? <Link to="/panel">Panel obsługi</Link>.
      </p>
    </div>
  );
}
