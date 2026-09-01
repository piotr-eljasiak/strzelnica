import { useState } from 'react';

import { api, refusalText } from '../api.js';

/** Logging in or signing up, in one form. Used on its own page and inline at booking. */
export function AuthForm({ onDone }) {
  const [mode, setMode] = useState('login');
  const [fields, setFields] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (name) => (event) => setFields({ ...fields, [name]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const shooter = mode === 'login' ? await api.login(fields) : await api.register(fields);
      onDone?.(shooter);
    } catch (error) {
      setProblem(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="tabs">
        <button
          type="button"
          className="plain"
          aria-pressed={mode === 'login'}
          onClick={() => setMode('login')}
        >
          Mam konto
        </button>
        <button
          type="button"
          className="plain"
          aria-pressed={mode === 'register'}
          onClick={() => setMode('register')}
        >
          Zakładam konto
        </button>
      </div>

      <label>
        E-mail
        <input type="email" value={fields.email} onChange={set('email')} required />
      </label>

      <label>
        Hasło
        <input type="password" value={fields.password} onChange={set('password')} required />
      </label>

      {mode === 'register' && (
        <>
          <label>
            Imię
            <input value={fields.firstName} onChange={set('firstName')} required />
          </label>
          <label>
            Nazwisko
            <input value={fields.lastName} onChange={set('lastName')} required />
          </label>
          <label>
            Telefon
            <input value={fields.phone} onChange={set('phone')} required />
            <span className="muted">Obsługa strzelnicy zadzwoni, jeśli coś się zmieni.</span>
          </label>
        </>
      )}

      {problem && <div className="notice bad">{refusalText(problem)}</div>}

      <div>
        <button className="primary" disabled={busy}>
          {mode === 'login' ? 'Zaloguj' : 'Załóż konto'}
        </button>
      </div>
    </form>
  );
}
