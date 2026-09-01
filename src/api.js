/**
 * The one place that talks to the API.
 *
 * `credentials: 'include'` matters: the session cookie is SameSite=Lax, so it travels on
 * top-level navigation but not from inside a third-party frame. That is by design -- the
 * widget never needs it, because booking is finished outside the frame (ADR 0002).
 */

async function request(method, path, body) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const error = new Error(payload?.error ?? 'unknown');
    error.reason = payload?.error;
    error.detail = payload;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  range: (slug) => request('GET', `/ranges/${slug}`),
  availability: (slug, from, to) =>
    request('GET', `/ranges/${slug}/availability?from=${from}&to=${to}`),
  me: () => request('GET', '/auth/me'),
  register: (fields) => request('POST', '/auth/register', fields),
  login: (fields) => request('POST', '/auth/login', fields),
  logout: () => request('POST', '/auth/logout', {}),
  bookings: () => request('GET', '/bookings'),
  book: (slug, fields) => request('POST', `/ranges/${slug}/bookings`, fields),
  cancel: (id) => request('POST', `/bookings/${id}/cancel`, {}),
};

/** Refusals the API can return, in Polish, for the shooter to read. */
export const REFUSAL_TEXT = {
  slot_taken: 'Ten termin został właśnie zajęty. Wybierz inny.',
  too_many_active: 'Masz już maksymalną liczbę rezerwacji w tej strzelnicy.',
  too_many_slots_today: 'Przekraczasz dzienny limit godzin w tej strzelnicy.',
  beyond_horizon: 'Ten termin jest zbyt odległy.',
  in_the_past: 'Ten termin już minął.',
  outside_schedule: 'Oś nie jest wtedy czynna.',
  not_contiguous: 'Godziny muszą następować po sobie.',
  spans_two_days: 'Rezerwacja nie może przechodzić przez północ.',
  too_late: 'Na anulowanie jest już za późno.',
  already_started: 'Ten termin już się rozpoczął.',
  already_cancelled: 'Ta rezerwacja jest już anulowana.',
  bad_credentials: 'Nieprawidłowy adres e-mail lub hasło.',
  email_taken: 'Konto o tym adresie już istnieje.',
  missing_fields: 'Wypełnij wszystkie pola.',
  unauthenticated: 'Zaloguj się, aby kontynuować.',
  not_found: 'Nie znaleziono.',
};

export const refusalText = (error) =>
  REFUSAL_TEXT[error?.reason] ?? 'Coś poszło nie tak. Spróbuj ponownie.';
