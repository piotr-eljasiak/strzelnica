import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createClient,
  dayAfter,
  firstFreeSlot,
  registerShooter,
  startTestServer,
} from './helpers.js';

describe('Składanie rezerwacji', () => {
  let server;
  let client;

  beforeEach(async () => {
    if (server) await server.stop();
    server = await startTestServer();
    client = server.client;
    await registerShooter(client);
  });
  after(() => server.stop());

  it('rezerwuje wolny slot i od razu go potwierdza', async () => {
    const { laneId, startUtc } = await firstFreeSlot(client, 'tarczownia', 25);

    const { status, body } = await client.post('/api/ranges/tarczownia/bookings', {
      laneId,
      startUtc,
    });

    assert.equal(status, 201);
    assert.equal(body.status, 'confirmed');
    assert.equal(body.startUtc, startUtc);
    assert.equal(body.range.slug, 'tarczownia');
  });

  it('zajmuje slot, który po rezerwacji przestaje być wolny', async () => {
    const { laneId, startUtc } = await firstFreeSlot(client, 'tarczownia', 25);
    await client.post('/api/ranges/tarczownia/bookings', { laneId, startUtc });

    const dzien = startUtc.slice(0, 10);
    const { body } = await client.get(
      `/api/ranges/tarczownia/availability?from=${dzien}&to=${dzien}`,
    );
    const slot = body.lanes
      .find((lane) => lane.id === laneId)
      .days[0].slots.find((candidate) => candidate.startUtc === startUtc);

    assert.equal(slot.state, 'unavailable');
  });

  it('łączy kilka sąsiadujących slotów w jedną rezerwację', async () => {
    const { laneId, startUtc } = await firstFreeSlot(client, 'bemowo', 25);

    const { status, body } = await client.post('/api/ranges/bemowo/bookings', {
      laneId,
      startUtc,
      slotCount: 3,
    });

    assert.equal(status, 201);
    assert.equal(
      Date.parse(body.endUtc) - Date.parse(body.startUtc),
      3 * 3600000,
      'rezerwacja powinna obejmować trzy godziny',
    );
  });

  it('odmawia, gdy ktoś zajął slot pierwszy', async () => {
    const { laneId, startUtc } = await firstFreeSlot(client, 'tarczownia', 25);
    await client.post('/api/ranges/tarczownia/bookings', { laneId, startUtc });

    const inny = createClient(server.base);
    await registerShooter(inny, { email: 'drugi@example.com' });
    const { status, body } = await inny.post('/api/ranges/tarczownia/bookings', {
      laneId,
      startUtc,
    });

    assert.equal(status, 409);
    assert.equal(body.error, 'slot_taken');
  });

  it('odmawia rezerwacji slotu objętego blokadą, nie zdradzając powodu', async () => {
    // Sobotnia blokada 8-14 UTC na osi 50 m w Bemowie pochodzi z danych startowych.
    const { body: dostepnosc } = await client.get(
      `/api/ranges/bemowo/availability?from=${dayAfter(1)}&to=${dayAfter(10)}`,
    );
    const os50 = dostepnosc.lanes.find((lane) => lane.distanceM === 50);
    const zablokowany = os50.days
      .flatMap((day) => day.slots)
      .find((slot) => slot.state === 'unavailable');

    const { status, body } = await client.post('/api/ranges/bemowo/bookings', {
      laneId: os50.id,
      startUtc: zablokowany.startUtc,
    });

    assert.equal(status, 409);
    assert.equal(body.error, 'slot_taken', 'blokada powinna wyglądać jak zajęty slot');
    assert.doesNotMatch(JSON.stringify(body), /Zawody/i);
  });

  it('odmawia slotów, które ze sobą nie sąsiadują', async () => {
    const { laneId, startUtc } = await firstFreeSlot(client, 'bemowo', 25);
    const zaDwieGodziny = new Date(Date.parse(startUtc) + 2 * 3600000).toISOString();
    await client.post('/api/ranges/bemowo/bookings', { laneId, startUtc: zaDwieGodziny });

    // Trzy sloty od startUtc obejmują godzinę zajętą przez rezerwację powyżej.
    const { status, body } = await client.post('/api/ranges/bemowo/bookings', {
      laneId,
      startUtc,
      slotCount: 3,
    });

    assert.equal(status, 409);
    assert.equal(body.error, 'slot_taken');
  });

  it('odmawia terminu poza grafikiem osi', async () => {
    const { body: strzelnica } = await client.get('/api/ranges/tarczownia');
    const os100 = strzelnica.lanes.find((lane) => lane.distanceM === 100);

    // Oś 100 m jest czynna 10-18 lokalnie; 08:00 lokalnie (06:00 UTC) jest poza grafikiem.
    const { status, body } = await client.post('/api/ranges/tarczownia/bookings', {
      laneId: os100.id,
      startUtc: `${dayAfter(6)}T06:00:00Z`,
    });

    assert.equal(status, 422);
    assert.equal(body.error, 'outside_schedule');
  });

  it('odmawia terminu poza horyzontem strzelnicy', async () => {
    const { body: strzelnica } = await client.get('/api/ranges/bemowo');
    const os = strzelnica.lanes[0];

    const { status, body } = await client.post('/api/ranges/bemowo/bookings', {
      laneId: os.id,
      startUtc: `${dayAfter(40)}T10:00:00Z`,
    });

    assert.equal(status, 422);
    assert.equal(body.error, 'beyond_horizon');
  });

  it('odmawia terminu z przeszłości', async () => {
    const { laneId } = await firstFreeSlot(client, 'bemowo', 25);

    const { status, body } = await client.post('/api/ranges/bemowo/bookings', {
      laneId,
      startUtc: '2026-08-01T10:00:00Z',
    });

    assert.equal(status, 422);
    assert.equal(body.error, 'in_the_past');
  });
});

describe('Limity strzelca', () => {
  let server;
  let client;

  beforeEach(async () => {
    if (server) await server.stop();
    server = await startTestServer();
    client = server.client;
    await registerShooter(client);
  });
  after(() => server.stop());

  it('nie pozwala przekroczyć liczby slotów w jednym dniu', async () => {
    // Tarczownia dopuszcza 2 sloty dziennie.
    const { laneId, startUtc } = await firstFreeSlot(client, 'tarczownia', 25);

    const { status, body } = await client.post('/api/ranges/tarczownia/bookings', {
      laneId,
      startUtc,
      slotCount: 3,
    });

    assert.equal(status, 422);
    assert.equal(body.error, 'too_many_slots_today');
    assert.equal(body.maxSlotsPerDay, 2);
  });

  it('nie pozwala przekroczyć liczby aktywnych rezerwacji', async () => {
    // Bemowo dopuszcza 2 aktywne rezerwacje i 4 sloty dziennie.
    const { body: dostepnosc } = await client.get(
      `/api/ranges/bemowo/availability?from=${dayAfter(1)}&to=${dayAfter(5)}`,
    );
    const os = dostepnosc.lanes.find((lane) => lane.distanceM === 25);
    const wolne = os.days.map((day) => day.slots.find((slot) => slot.state === 'free'));

    assert.equal((await client.post('/api/ranges/bemowo/bookings', { laneId: os.id, startUtc: wolne[0].startUtc })).status, 201);
    assert.equal((await client.post('/api/ranges/bemowo/bookings', { laneId: os.id, startUtc: wolne[1].startUtc })).status, 201);

    const trzecia = await client.post('/api/ranges/bemowo/bookings', {
      laneId: os.id,
      startUtc: wolne[2].startUtc,
    });

    assert.equal(trzecia.status, 422);
    assert.equal(trzecia.body.error, 'too_many_active');
  });

  it('liczy limity osobno w każdej strzelnicy', async () => {
    const { body: bemowo } = await client.get(
      `/api/ranges/bemowo/availability?from=${dayAfter(1)}&to=${dayAfter(5)}`,
    );
    const osBemowo = bemowo.lanes.find((lane) => lane.distanceM === 25);
    const wolne = osBemowo.days.map((day) => day.slots.find((slot) => slot.state === 'free'));

    await client.post('/api/ranges/bemowo/bookings', { laneId: osBemowo.id, startUtc: wolne[0].startUtc });
    await client.post('/api/ranges/bemowo/bookings', { laneId: osBemowo.id, startUtc: wolne[1].startUtc });

    // Limit Bemowa jest wyczerpany; Tarczownia ma go liczyć od zera.
    const { laneId, startUtc } = await firstFreeSlot(client, 'tarczownia', 25);
    const { status } = await client.post('/api/ranges/tarczownia/bookings', { laneId, startUtc });

    assert.equal(status, 201, 'limit jednej strzelnicy zablokował rezerwację w drugiej');
  });
});
