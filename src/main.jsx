import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';

import { api } from './api.js';
import { HomePage } from './routes/HomePage.jsx';
import { WidgetPage } from './routes/WidgetPage.jsx';
import { BookPage } from './routes/BookPage.jsx';
import { MyBookingsPage } from './routes/MyBookingsPage.jsx';
import './styles.css';

function App() {
  const [shooter, setShooter] = useState(null);
  const [checked, setChecked] = useState(false);
  const embedded = useLocation().pathname.startsWith('/w/');

  useEffect(() => {
    // The widget never asks who is logged in: inside a frame the cookie is not sent, so
    // the answer would be a misleading "nobody".
    if (embedded) {
      setChecked(true);
      return;
    }
    api
      .me()
      .then(setShooter)
      .catch(() => setShooter(null))
      .finally(() => setChecked(true));
  }, [embedded]);

  async function signOut() {
    await api.logout();
    setShooter(null);
  }

  if (!checked) return null;

  return (
    <>
      {!embedded && (
        <nav className="page" style={{ paddingBottom: 0 }}>
          <div className="tabs">
            <Link to="/">Strzelnice</Link>
            <Link to="/moje">Moje rezerwacje</Link>
            {shooter && (
              <button className="plain" onClick={signOut}>
                Wyloguj
              </button>
            )}
          </div>
        </nav>
      )}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/w/:slug" element={<WidgetPage />} />
        <Route
          path="/book"
          element={<BookPage shooter={shooter} onShooterChange={setShooter} />}
        />
        <Route
          path="/moje"
          element={<MyBookingsPage shooter={shooter} onShooterChange={setShooter} />}
        />
        <Route path="*" element={<div className="page">Nie ma takiej strony.</div>} />
      </Routes>
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
