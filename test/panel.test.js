import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, firstFreeSlot, registerShooter, startTestServer } from './helpers.js';

const TARCZOWNIA = { email: 'obsluga@tarczownia.example', password: 'obsluga123' };
const BEMOWO = { email: 'obsluga@bemowo.example', password: 'obsluga123' };

async function signInStaff(base, credentials) {
  const client = createClient(base);
  const response = await client.post('/api/panel/login', credentials);
  if (response.status !== 200) {
    throw new Error(`Panel login failed: ${JSON.stringify(response.body)}`);
  }
  return { client, overview: response.body };
}

describe('Panel — dostęp', () => {
  let server;

  beforeEach(async () => {
    if (server) await server.stop();
    server = await startTestServer();
  });
  after(() => server.stop());

  it('loguje obsługę i pokazuje wyłącznie jej strzelnicę', async () => {
    const { overview } = await signInStaff(server.base, TARCZOWNIA);

    assert.equal(overview.range.slug, 'tarczownia');
    assert.equal(overview.staff.name, 'Ewa Wójcik');
    assert.deepEqual(
      overview.lanes.map((lane) => lane.distanceM).sort((a, b) => a - b),
      [25, 100],
    );
  });

  it('nie wpuszcza do panelu bez logowania', async () => {
    const anonim = createClient(server.base);

    assert.equal((await anonim.get('/api/panel')).status, 401);
    assert.equal((await anonim.get('/api/panel/bookings')).status, 401);
  });

  it('nie wpuszcza do panelu na sesji strzelca', async () => {
    const strzelec = createClient(server.base);
    await registerShooter(strzelec);

    const { status, body } = await strzelec.get('/api/panel');

    assert.equal(status, 401, 'sesja strzelca otworzyła panel');
    assert.equal(body.error, 'unauthenticated');
  });

  it('nie wpuszcza obsługi na punkty strzelca', async () => {
    const { client } = await signInStaff(server.base, TARCZOWNIA);

    assert.equal((await client.get('/api/auth/me')).status, 401);
    assert.equal((await client.get('/api/bookings')).status, 401);
  });

  it('kończy sesję panelu przy wylogowaniu', async () => {
    const { client } = await signInStaff(server.base, TARCZOWNIA);

    assert.equal((await client.post('/api/panel/logout')).status, 204);
    assert.equal((await client.get('/api/panel')).status, 401);
  });

  it('odrzuca złe hasło obsługi', async () => {
    const client = createClient(server.base);

    const { status } = await client.post('/api/panel/login', {
      email: TARCZOWNIA.email,
      password: 'nie-to',
    });

    assert.equal(status, 401);
  });
});

describe('Panel — izolacja strzelnic', () => {
  let server;
  let tarczownia;
  let bemowo;

  beforeEach(async () => {
    if (server) await server.stop();
    server = await startTestServer();
    tarczownia = await signInStaff(server.base, TARCZOWNIA);
    bemowo = await signInStaff(server.base, BEMOWO);
  });
  after(() => server.stop());

  it('nie pozwala edytować osi drugiej strzelnicy', async () => {
    const cudzaOs = bemowo.overview.lanes[0].id;

    const { status } = await tarczownia.client.post(`/api/panel/lanes/${cudzaOs}`, {
      name: 'Przejęta',
      distanceM: 25,
    });

    assert.equal(status, 404, 'oś obcej strzelnicy została zmieniona');
  });

  it('nie pozwala usunąć osi drugiej strzelnicy', async () => {
    const cudzaOs = bemowo.overview.lanes[0].id;

    assert.equal(
      (await tarczownia.client.post(`/api/panel/lanes/${cudzaOs}/delete`)).status,
      404,
    );
  });

  it('nie pozwala zablokować osi drugiej strzelnicy', async () => {
    const cudzaOs = bemowo.overview.lanes[0].id;

    const { status } = await tarczownia.client.post('/api/panel/closures', {
      laneId: cudzaOs,
      startUtc: '2026-09-20T08:00:00Z',
      endUtc: '2026-09-20T12:00:00Z',
      reason: 'Nie moja oś',
    });

    assert.equal(status, 404);
  });

  it('pokazuje wyłącznie rezerwacje własnej strzelnicy', async () => {
    const strzelec = createClient(server.base);
    await registerShooter(strzelec);
    const termin = await firstFreeSlot(strzelec, 'tarczownia', 25);
    await strzelec.post('/api/ranges/tarczownia/bookings', {
      laneId: termin.laneId,
      startUtc: termin.startUtc,
    });

    const uSiebie = await tarczownia.client.get('/api/panel/bookings');
    const uSasiada = await bemowo.client.get('/api/panel/bookings');

    assert.equal(uSiebie.body.bookings.length, 1);
    assert.equal(uSasiada.body.bookings.length, 0, 'rezerwacja przeciekła do drugiej strzelnicy');
  });

  it('nie pozwala anulować rezerwacji drugiej strzelnicy', async () => {
    const strzelec = createClient(server.base);
    await registerShooter(strzelec);
    const termin = await firstFreeSlot(strzelec, 'tarczownia', 25);
    const rezerwacja = (
      await strzelec.post('/api/ranges/tarczownia/bookings', {
        laneId: termin.laneId,
        startUtc: termin.startUtc,
      })
    ).body;

    const { status } = await bemowo.client.post(`/api/panel/bookings/${rezerwacja.id}/cancel`, {
      note: 'Nie moja sprawa',
    });

    assert.equal(status, 404);
  });
});

describe('Panel — osie i grafik', () => {
  let server;
  let panel;

  beforeEach(async () => {
    if (server) await server.stop();
    server = await startTestServer();
    panel = await signInStaff(server.base, TARCZOWNIA);
  });
  after(() => server.stop());

  it('dodaje oś, która od razu jest widoczna publicznie', async () => {
    const { status } = await panel.client.post('/api/panel/lanes', {
      name: 'Oś 50 m',
      distanceM: 50,
    });

    assert.equal(status, 201);
    const publiczne = await createClient(server.base).get('/api/ranges/tarczownia');
    assert.ok(publiczne.body.lanes.some((lane) => lane.name === 'Oś 50 m'));
  });

  it('odmawia drugiej osi o tej samej nazwie', async () => {
    const { status, body } = await panel.client.post('/api/panel/lanes', {
      name: 'Oś 25 m',
      distanceM: 25,
    });

    assert.equal(status, 409);
    assert.equal(body.error, 'lane_name_taken');
  });

  it('nie pozwala usunąć osi, na którą ktoś ma rezerwację', async () => {
    const strzelec = createClient(server.base);
    await registerShooter(strzelec);
    const termin = await firstFreeSlot(strzelec, 'tarczownia', 25);
    await strzelec.post('/api/ranges/tarczownia/bookings', {
      laneId: termin.laneId,
      startUtc: termin.startUtc,
    });

    const { status, body } = await panel.client.post(
      `/api/panel/lanes/${termin.laneId}/delete`,
    );

    assert.equal(status, 409);
    assert.equal(body.error, 'lane_has_bookings');
  });

  it('zmienia grafik osi, co widać w dostępności', async () => {
    const os25 = panel.overview.lanes.find((lane) => lane.distanceM === 25);
    assert.equal(os25.inheritsHours, true, 'oś 25 m miała dziedziczyć godziny');

    await panel.client.post(`/api/panel/lanes/${os25.id}/hours`, {
      days: [{ weekday: 3, open: true, startHour: 10, endHour: 12 }],
    });

    const publiczne = createClient(server.base);
    const { body } = await publiczne.get(
      '/api/ranges/tarczownia/availability?from=2026-09-09&to=2026-09-09',
    );
    const sroda = body.lanes.find((lane) => lane.id === os25.id).days[0];

    assert.equal(sroda.slots.length, 2, 'nowy grafik nie zadziałał');
  });

  it('pusty grafik przywraca dziedziczenie godzin strzelnicy', async () => {
    const os100 = panel.overview.lanes.find((lane) => lane.distanceM === 100);
    assert.equal(os100.inheritsHours, false);

    await panel.client.post(`/api/panel/lanes/${os100.id}/hours`, { days: [] });

    const { body } = await panel.client.get('/api/panel');
    const po = body.lanes.find((lane) => lane.id === os100.id);
    assert.equal(po.inheritsHours, true);
  });

  it('odrzuca grafik, w którym dzień kończy się przed rozpoczęciem', async () => {
    const os25 = panel.overview.lanes[0];

    const { status, body } = await panel.client.post(`/api/panel/lanes/${os25.id}/hours`, {
      days: [{ weekday: 1, open: true, startHour: 18, endHour: 9 }],
    });

    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_hours');
  });

  it('zmienia limity strzelnicy, co od razu wiąże strzelca', async () => {
    await panel.client.post('/api/panel/settings', {
      phone: '+48 58 111 22 33',
      horizonDays: 30,
      maxActiveBookings: 1,
      maxSlotsPerDay: 1,
      cancellationWindowHours: 24,
    });

    const strzelec = createClient(server.base);
    await registerShooter(strzelec);
    const pierwszy = await firstFreeSlot(strzelec, 'tarczownia', 25);
    assert.equal(
      (await strzelec.post('/api/ranges/tarczownia/bookings', {
        laneId: pierwszy.laneId,
        startUtc: pierwszy.startUtc,
      })).status,
      201,
    );

    const drugi = await firstFreeSlot(strzelec, 'tarczownia', 25);
    const { status, body } = await strzelec.post('/api/ranges/tarczownia/bookings', {
      laneId: drugi.laneId,
      startUtc: drugi.startUtc,
    });

    assert.equal(status, 422);
    assert.equal(body.error, 'too_many_active');
  });
});

describe('Panel — blokady i rezerwacje', () => {
  let server;
  let panel;
  let strzelec;
  let rezerwacja;

  beforeEach(async () => {
    if (server) await server.stop();
    server = await startTestServer();
    panel = await signInStaff(server.base, TARCZOWNIA);

    strzelec = createClient(server.base);
    await registerShooter(strzelec);
    const termin = await firstFreeSlot(strzelec, 'tarczownia', 25);
    rezerwacja = (
      await strzelec.post('/api/ranges/tarczownia/bookings', {
        laneId: termin.laneId,
        startUtc: termin.startUtc,
      })
    ).body;
  });
  after(() => server.stop());

  it('pokazuje obsłudze dane kontaktowe strzelca', async () => {
    const { body } = await panel.client.get('/api/panel/bookings');

    assert.equal(body.bookings[0].shooter.name, 'Anna Nowak');
    assert.equal(body.bookings[0].shooter.phone, '+48 600 300 400');
  });

  it('odmawia blokady kolidującej z rezerwacją i pokazuje kogo dotyczy', async () => {
    const { status, body } = await panel.client.post('/api/panel/closures', {
      laneId: rezerwacja.lane.id,
      startUtc: rezerwacja.startUtc,
      endUtc: rezerwacja.endUtc,
      reason: 'Remont',
    });

    assert.equal(status, 409);
    assert.equal(body.error, 'closure_collides');
    assert.equal(body.bookings.length, 1);
    assert.equal(body.bookings[0].shooter.name, 'Anna Nowak');
  });

  it('po potwierdzeniu zakłada blokadę, ale NIE kasuje rezerwacji', async () => {
    const { status } = await panel.client.post('/api/panel/closures', {
      laneId: rezerwacja.lane.id,
      startUtc: rezerwacja.startUtc,
      endUtc: rezerwacja.endUtc,
      reason: 'Remont',
      acknowledged: true,
    });

    assert.equal(status, 201);
    const uStrzelca = await strzelec.get('/api/bookings');
    assert.equal(
      uStrzelca.body.bookings[0].status,
      'confirmed',
      'blokada anulowała cudzą rezerwację',
    );
  });

  it('zakłada blokadę bez potwierdzenia, gdy nic z nią nie koliduje', async () => {
    const os100 = panel.overview.lanes.find((lane) => lane.distanceM === 100);

    const { status } = await panel.client.post('/api/panel/closures', {
      laneId: os100.id,
      startUtc: '2026-09-16T08:00:00Z',
      endUtc: '2026-09-16T12:00:00Z',
      reason: 'Przegląd techniczny',
    });

    assert.equal(status, 201);
  });

  it('blokada czyni sloty niedostępnymi publicznie, bez podania powodu', async () => {
    const os100 = panel.overview.lanes.find((lane) => lane.distanceM === 100);
    await panel.client.post('/api/panel/closures', {
      laneId: os100.id,
      startUtc: '2026-09-16T08:00:00Z',
      endUtc: '2026-09-16T12:00:00Z',
      reason: 'Przegląd techniczny',
    });

    const { body } = await createClient(server.base).get(
      '/api/ranges/tarczownia/availability?from=2026-09-16&to=2026-09-16',
    );

    const dzien = body.lanes.find((lane) => lane.id === os100.id).days[0];
    assert.ok(dzien.slots.some((slot) => slot.state === 'unavailable'));
    assert.doesNotMatch(JSON.stringify(body), /Przegląd/i);
  });

  it('zdejmuje blokadę', async () => {
    const os100 = panel.overview.lanes.find((lane) => lane.distanceM === 100);
    const { body } = await panel.client.post('/api/panel/closures', {
      laneId: os100.id,
      startUtc: '2026-09-16T08:00:00Z',
      endUtc: '2026-09-16T12:00:00Z',
      reason: 'Przegląd techniczny',
    });

    assert.equal((await panel.client.post(`/api/panel/closures/${body.id}/delete`)).status, 204);
    assert.equal((await panel.client.get('/api/panel/closures')).body.closures.length, 0);
  });

  it('pozwala obsłudze anulować rezerwację po terminie 24 h, którego strzelec już nie ma', async () => {
    server.travelTo(new Date(Date.parse(rezerwacja.startUtc) - 3600000).toISOString());

    const uStrzelca = await strzelec.post(`/api/bookings/${rezerwacja.id}/cancel`);
    assert.equal(uStrzelca.status, 422, 'strzelec nie powinien móc anulować godzinę przed');

    const uObslugi = await panel.client.post(`/api/panel/bookings/${rezerwacja.id}/cancel`, {
      note: 'Awaria wentylacji',
    });
    assert.equal(uObslugi.status, 204);
  });

  it('wymaga od obsługi podania powodu anulowania', async () => {
    const { status, body } = await panel.client.post(
      `/api/panel/bookings/${rezerwacja.id}/cancel`,
      { note: '  ' },
    );

    assert.equal(status, 400);
    assert.equal(body.error, 'missing_fields');
  });

  it('anulowanie przez obsługę zwalnia slot', async () => {
    await panel.client.post(`/api/panel/bookings/${rezerwacja.id}/cancel`, {
      note: 'Awaria wentylacji',
    });

    const dzien = rezerwacja.startUtc.slice(0, 10);
    const { body } = await createClient(server.base).get(
      `/api/ranges/tarczownia/availability?from=${dzien}&to=${dzien}`,
    );
    const slot = body.lanes
      .find((lane) => lane.id === rezerwacja.lane.id)
      .days[0].slots.find((candidate) => candidate.startUtc === rezerwacja.startUtc);

    assert.equal(slot.state, 'free');
  });
});
