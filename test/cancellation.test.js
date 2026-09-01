import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, firstFreeSlot, registerShooter, startTestServer } from './helpers.js';

const GODZINA = 3600000;

describe('Anulowanie rezerwacji', () => {
  let server;
  let client;
  let rezerwacja;

  beforeEach(async () => {
    if (server) await server.stop();
    server = await startTestServer();
    client = server.client;
    await registerShooter(client);

    const { laneId, startUtc } = await firstFreeSlot(client, 'tarczownia', 25);
    rezerwacja = (await client.post('/api/ranges/tarczownia/bookings', { laneId, startUtc })).body;
  });
  after(() => server.stop());

  it('pozwala anulować z wyprzedzeniem', async () => {
    const { status, body } = await client.post(`/api/bookings/${rezerwacja.id}/cancel`);

    assert.equal(status, 200);
    assert.equal(body.status, 'cancelled');
  });

  it('podaje, do kiedy można anulować', async () => {
    assert.equal(
      Date.parse(rezerwacja.startUtc) - Date.parse(rezerwacja.cancellableUntilUtc),
      24 * GODZINA,
    );
  });

  it('zwalnia slot, który wraca do puli wolnych', async () => {
    await client.post(`/api/bookings/${rezerwacja.id}/cancel`);

    const dzien = rezerwacja.startUtc.slice(0, 10);
    const { body } = await client.get(
      `/api/ranges/tarczownia/availability?from=${dzien}&to=${dzien}`,
    );
    const slot = body.lanes
      .find((lane) => lane.id === rezerwacja.lane.id)
      .days[0].slots.find((candidate) => candidate.startUtc === rezerwacja.startUtc);

    assert.equal(slot.state, 'free');
  });

  it('pozwala komuś innemu zająć zwolniony termin', async () => {
    await client.post(`/api/bookings/${rezerwacja.id}/cancel`);

    const inny = createClient(server.base);
    await registerShooter(inny, { email: 'kolejny@example.com' });
    const { status } = await inny.post('/api/ranges/tarczownia/bookings', {
      laneId: rezerwacja.lane.id,
      startUtc: rezerwacja.startUtc,
    });

    assert.equal(status, 201);
  });

  it('dopuszcza anulowanie dokładnie 24 godziny przed', async () => {
    server.travelTo(new Date(Date.parse(rezerwacja.startUtc) - 24 * GODZINA).toISOString());

    assert.equal((await client.post(`/api/bookings/${rezerwacja.id}/cancel`)).status, 200);
  });

  it('odmawia anulowania na 23 godziny przed i podaje telefon do strzelnicy', async () => {
    server.travelTo(new Date(Date.parse(rezerwacja.startUtc) - 23 * GODZINA).toISOString());

    const { status, body } = await client.post(`/api/bookings/${rezerwacja.id}/cancel`);

    assert.equal(status, 422);
    assert.equal(body.error, 'too_late');
    assert.equal(body.rangePhone, '+48 58 111 22 33');
  });

  it('odmawia anulowania terminu, który już się zaczął', async () => {
    server.travelTo(new Date(Date.parse(rezerwacja.startUtc) + GODZINA).toISOString());

    const { status, body } = await client.post(`/api/bookings/${rezerwacja.id}/cancel`);

    assert.equal(status, 422);
    assert.equal(body.error, 'already_started');
  });

  it('odmawia powtórnego anulowania', async () => {
    await client.post(`/api/bookings/${rezerwacja.id}/cancel`);

    const { status, body } = await client.post(`/api/bookings/${rezerwacja.id}/cancel`);

    assert.equal(status, 422);
    assert.equal(body.error, 'already_cancelled');
  });

  it('nie pozwala anulować cudzej rezerwacji i nie zdradza, że istnieje', async () => {
    const inny = createClient(server.base);
    await registerShooter(inny, { email: 'ciekawski@example.com' });

    const cudza = await inny.post(`/api/bookings/${rezerwacja.id}/cancel`);
    const nieistniejaca = await inny.post('/api/bookings/999999/cancel');

    assert.equal(cudza.status, 404);
    assert.deepEqual(cudza.body, nieistniejaca.body, 'odpowiedź zdradza istnienie cudzej rezerwacji');
  });

  it('nie pozwala anulować bez logowania', async () => {
    const anonim = createClient(server.base);

    assert.equal((await anonim.post(`/api/bookings/${rezerwacja.id}/cancel`)).status, 401);
  });
});
