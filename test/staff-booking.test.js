import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, firstFreeSlot, registerShooter, startTestServer } from './helpers.js';

const TARCZOWNIA = { email: 'obsluga@tarczownia.example', password: 'obsluga123' };
const BEMOWO = { email: 'obsluga@bemowo.example', password: 'obsluga123' };

async function signInStaff(base, credentials) {
  const client = createClient(base);
  const response = await client.post('/api/panel/login', credentials);
  if (response.status !== 200) throw new Error('Panel login failed');
  return { client, overview: response.body };
}

describe('Rezerwacja przyjęta przez obsługę', () => {
  let server;
  let panel;
  let os25;
  let termin;

  beforeEach(async () => {
    if (server) await server.stop();
    server = await startTestServer();
    panel = await signInStaff(server.base, TARCZOWNIA);
    os25 = panel.overview.lanes.find((lane) => lane.distanceM === 25);

    const przegladajacy = createClient(server.base);
    await registerShooter(przegladajacy, { email: 'ktos@example.com' });
    termin = await firstFreeSlot(przegladajacy, 'tarczownia', 25);
  });
  after(() => server.stop());

  it('zapisuje gościa po imieniu i telefonie, bez zakładania mu konta', async () => {
    const { status, body } = await panel.client.post('/api/panel/bookings', {
      laneId: os25.id,
      startUtc: termin.startUtc,
      guest: { name: 'Adam Dzwoniący', phone: '+48 501 002 003' },
    });

    assert.equal(status, 201);
    assert.ok(body.id);

    const lista = await panel.client.get('/api/panel/bookings');
    const zapisana = lista.body.bookings.find((booking) => booking.id === body.id);
    assert.equal(zapisana.customer.kind, 'guest');
    assert.equal(zapisana.customer.name, 'Adam Dzwoniący');
    assert.equal(zapisana.customer.phone, '+48 501 002 003');
    assert.equal(zapisana.takenByStaff, true);
  });

  it('zajmuje slot tak samo jak rezerwacja strzelca', async () => {
    await panel.client.post('/api/panel/bookings', {
      laneId: os25.id,
      startUtc: termin.startUtc,
      guest: { name: 'Adam Dzwoniący', phone: '+48 501 002 003' },
    });

    const dzien = termin.startUtc.slice(0, 10);
    const { body } = await createClient(server.base).get(
      `/api/ranges/tarczownia/availability?from=${dzien}&to=${dzien}`,
    );
    const slot = body.lanes
      .find((lane) => lane.id === os25.id)
      .days[0].slots.find((candidate) => candidate.startUtc === termin.startUtc);

    assert.equal(slot.state, 'unavailable');
  });

  it('nie ujawnia publicznie danych gościa', async () => {
    await panel.client.post('/api/panel/bookings', {
      laneId: os25.id,
      startUtc: termin.startUtc,
      guest: { name: 'Adam Dzwoniący', phone: '+48 501 002 003' },
    });

    const dzien = termin.startUtc.slice(0, 10);
    const { body } = await createClient(server.base).get(
      `/api/ranges/tarczownia/availability?from=${dzien}&to=${dzien}`,
    );

    assert.doesNotMatch(JSON.stringify(body), /Dzwoniący|501 002 003/);
  });

  it('wymaga zarówno imienia, jak i telefonu gościa', async () => {
    const bezTelefonu = await panel.client.post('/api/panel/bookings', {
      laneId: os25.id,
      startUtc: termin.startUtc,
      guest: { name: 'Adam', phone: '   ' },
    });

    assert.equal(bezTelefonu.status, 400);
    assert.equal(bezTelefonu.body.error, 'missing_fields');
  });

  it('pomija limity strzelca, bo rezerwację przyjmuje człowiek przy ladzie', async () => {
    // Tarczownia dopuszcza 2 sloty dziennie; obsługa zapisuje klub na 4 godziny.
    const { status } = await panel.client.post('/api/panel/bookings', {
      laneId: os25.id,
      startUtc: termin.startUtc,
      slotCount: 4,
      guest: { name: 'Klub Sportowy', phone: '+48 501 000 000' },
    });

    assert.equal(status, 201);
  });

  it('odmawia terminu poza grafikiem, ale zaznacza, że da się to potwierdzić', async () => {
    const os100 = panel.overview.lanes.find((lane) => lane.distanceM === 100);

    // Oś 100 m jest czynna 10-18 lokalnie; 06:00 UTC to 08:00 lokalnie.
    const { status, body } = await panel.client.post('/api/panel/bookings', {
      laneId: os100.id,
      startUtc: '2026-09-08T06:00:00Z',
      guest: { name: 'Grupa Poranna', phone: '+48 501 111 222' },
    });

    assert.equal(status, 422);
    assert.equal(body.error, 'outside_schedule');
    assert.equal(body.waivable, true);
  });

  it('po potwierdzeniu zapisuje termin poza godzinami otwarcia', async () => {
    const os100 = panel.overview.lanes.find((lane) => lane.distanceM === 100);

    const { status } = await panel.client.post('/api/panel/bookings', {
      laneId: os100.id,
      startUtc: '2026-09-08T06:00:00Z',
      guest: { name: 'Grupa Poranna', phone: '+48 501 111 222' },
      acknowledged: true,
    });

    assert.equal(status, 201);
  });

  it('NIE pozwala zapisać na slot już zajęty, nawet z potwierdzeniem', async () => {
    await panel.client.post('/api/panel/bookings', {
      laneId: os25.id,
      startUtc: termin.startUtc,
      guest: { name: 'Pierwszy', phone: '+48 501 000 001' },
    });

    const { status, body } = await panel.client.post('/api/panel/bookings', {
      laneId: os25.id,
      startUtc: termin.startUtc,
      guest: { name: 'Drugi', phone: '+48 501 000 002' },
      acknowledged: true,
    });

    assert.equal(status, 409, 'dwie osoby zmieściły się na jednej osi');
    assert.equal(body.error, 'slot_taken');
  });

  it('NIE pozwala zapisać na oś objętą blokadą, nawet z potwierdzeniem', async () => {
    await panel.client.post('/api/panel/closures', {
      laneId: os25.id,
      startUtc: termin.startUtc,
      endUtc: new Date(Date.parse(termin.startUtc) + 3600000).toISOString(),
      reason: 'Remont',
    });

    const { status } = await panel.client.post('/api/panel/bookings', {
      laneId: os25.id,
      startUtc: termin.startUtc,
      guest: { name: 'Uparty', phone: '+48 501 000 003' },
      acknowledged: true,
    });

    assert.equal(status, 409, 'blokada została obejściem, zamiast zdjęta');
  });

  it('NIE pozwala zapisać terminu z przeszłości', async () => {
    const { status, body } = await panel.client.post('/api/panel/bookings', {
      laneId: os25.id,
      startUtc: '2026-08-01T10:00:00Z',
      guest: { name: 'Spóźniony', phone: '+48 501 000 004' },
      acknowledged: true,
    });

    assert.equal(status, 422);
    assert.equal(body.error, 'in_the_past');
  });
});

describe('Wyszukiwanie stałych klientów', () => {
  let server;
  let panel;
  let bemowo;

  beforeEach(async () => {
    if (server) await server.stop();
    server = await startTestServer();
    panel = await signInStaff(server.base, TARCZOWNIA);
    bemowo = await signInStaff(server.base, BEMOWO);

    // Strzelec, który rezerwował w Tarczowni.
    const staly = createClient(server.base);
    await registerShooter(staly, { email: 'staly@example.com' });
    const termin = await firstFreeSlot(staly, 'tarczownia', 25);
    await staly.post('/api/ranges/tarczownia/bookings', {
      laneId: termin.laneId,
      startUtc: termin.startUtc,
    });
  });
  after(() => server.stop());

  it('znajduje klienta, który już tu rezerwował', async () => {
    const { body } = await panel.client.get('/api/panel/shooters?q=Nowak');

    assert.equal(body.shooters.length, 1);
    assert.equal(body.shooters[0].email, 'staly@example.com');
  });

  it('NIE znajduje klientów innej strzelnicy', async () => {
    const { body } = await bemowo.client.get('/api/panel/shooters?q=Nowak');

    assert.deepEqual(body.shooters, [], 'obsługa Bemowa widzi klientów Tarczowni');
  });

  it('nie wyszukuje po zbyt krótkiej frazie, żeby nie wypisać całej listy', async () => {
    const { body } = await panel.client.get('/api/panel/shooters?q=No');

    assert.deepEqual(body.shooters, []);
  });

  it('zapisuje rezerwację na konto znanego klienta i pokazuje ją w jego rezerwacjach', async () => {
    const { body: znalezieni } = await panel.client.get('/api/panel/shooters?q=Nowak');
    const klient = znalezieni.shooters[0];

    const wolny = await (async () => {
      const { body } = await panel.client.get('/api/panel');
      const os = body.lanes.find((lane) => lane.distanceM === 100);
      return { laneId: os.id, startUtc: '2026-09-08T08:00:00Z' }; // 10:00 lokalnie, w grafiku
    })();

    const { status } = await panel.client.post('/api/panel/bookings', {
      laneId: wolny.laneId,
      startUtc: wolny.startUtc,
      shooterId: klient.id,
    });

    assert.equal(status, 201);

    const jako = createClient(server.base);
    await jako.post('/api/auth/login', {
      email: 'staly@example.com',
      password: 'tajne-haslo',
    });
    const moje = await jako.get('/api/bookings');

    assert.ok(
      moje.body.bookings.some((booking) => booking.startUtc === wolny.startUtc),
      'rezerwacja przyjęta przez obsługę nie trafiła do rezerwacji klienta',
    );
  });

  it('odmawia zapisu na konto, którego ta strzelnica nie zna', async () => {
    const obcy = createClient(server.base);
    await registerShooter(obcy, { email: 'obcy@example.com' });

    const { body: znalezieni } = await panel.client.get('/api/panel/shooters?q=Nowak');
    const nieistniejacyTutaj = znalezieni.shooters[0].id + 1000;

    const { status } = await panel.client.post('/api/panel/bookings', {
      laneId: panel.overview.lanes[0].id,
      startUtc: '2026-09-08T08:00:00Z',
      shooterId: nieistniejacyTutaj,
    });

    assert.equal(status, 404);
  });
});
