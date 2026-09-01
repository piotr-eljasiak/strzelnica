import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SHOOTER,
  createClient,
  firstFreeSlot,
  registerShooter,
  startTestServer,
} from './helpers.js';

describe('Konto strzelca', () => {
  let server;
  let client;

  beforeEach(async () => {
    if (server) await server.stop();
    server = await startTestServer();
    client = server.client;
  });
  after(() => server.stop());

  it('zakłada konto i od razu loguje', async () => {
    const { status, body } = await client.post('/api/auth/register', SHOOTER);

    assert.equal(status, 201);
    assert.equal(body.email, SHOOTER.email);
    assert.equal((await client.get('/api/auth/me')).status, 200);
  });

  it('nigdy nie zwraca hasła ani jego skrótu', async () => {
    const { body } = await client.post('/api/auth/register', SHOOTER);

    assert.doesNotMatch(JSON.stringify(body), /haslo|password|scrypt/i);
  });

  it('odmawia drugiego konta na ten sam adres', async () => {
    await registerShooter(client);
    const inny = createClient(server.base);

    const { status, body } = await inny.post('/api/auth/register', SHOOTER);

    assert.equal(status, 409);
    assert.equal(body.error, 'email_taken');
  });

  it('loguje poprawnym hasłem', async () => {
    await registerShooter(client);
    client.forget();

    const { status } = await client.post('/api/auth/login', {
      email: SHOOTER.email,
      password: SHOOTER.password,
    });

    assert.equal(status, 200);
  });

  it('odrzuca złe hasło tak samo jak nieznany adres', async () => {
    await registerShooter(client);
    const obcy = createClient(server.base);

    const zleHaslo = await obcy.post('/api/auth/login', {
      email: SHOOTER.email,
      password: 'nie-to-haslo',
    });
    const nieznanyAdres = await obcy.post('/api/auth/login', {
      email: 'nikt@example.com',
      password: 'cokolwiek',
    });

    assert.equal(zleHaslo.status, 401);
    assert.deepEqual(zleHaslo.body, nieznanyAdres.body, 'odpowiedzi zdradzają, czy konto istnieje');
  });

  it('trzyma sesję w ciasteczku HttpOnly, którego nie wyśle obca ramka', async () => {
    const odpowiedz = await fetch(`${server.base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SHOOTER),
    });

    const ciasteczko = odpowiedz.headers.get('set-cookie');
    assert.match(ciasteczko, /HttpOnly/i, 'skrypt na stronie mógłby odczytać sesję');
    assert.match(ciasteczko, /SameSite=Lax/i, 'sesja szłaby z kontekstu third-party');
  });

  it('kończy sesję przy wylogowaniu', async () => {
    await registerShooter(client);

    assert.equal((await client.post('/api/auth/logout')).status, 204);
    assert.equal((await client.get('/api/auth/me')).status, 401);
  });

  it('nie pozwala rezerwować bez konta', async () => {
    const anonim = createClient(server.base);
    const przegladajacy = createClient(server.base);
    await registerShooter(przegladajacy);
    const { laneId, startUtc } = await firstFreeSlot(przegladajacy, 'tarczownia', 25);

    const { status, body } = await anonim.post('/api/ranges/tarczownia/bookings', {
      laneId,
      startUtc,
    });

    assert.equal(status, 401);
    assert.equal(body.error, 'unauthenticated');
  });

  it('nie pokazuje cudzych rezerwacji', async () => {
    await registerShooter(client);
    const { laneId, startUtc } = await firstFreeSlot(client, 'tarczownia', 25);
    await client.post('/api/ranges/tarczownia/bookings', { laneId, startUtc });

    const inny = createClient(server.base);
    await registerShooter(inny, { email: 'obcy@example.com' });

    assert.deepEqual((await inny.get('/api/bookings')).body.bookings, []);
  });

  it('zbiera rezerwacje ze wszystkich strzelnic w jednym miejscu', async () => {
    await registerShooter(client);
    const a = await firstFreeSlot(client, 'tarczownia', 25);
    const b = await firstFreeSlot(client, 'bemowo', 25);
    await client.post('/api/ranges/tarczownia/bookings', { laneId: a.laneId, startUtc: a.startUtc });
    await client.post('/api/ranges/bemowo/bookings', { laneId: b.laneId, startUtc: b.startUtc });

    const { body } = await client.get('/api/bookings');

    assert.deepEqual(
      [...new Set(body.bookings.map((booking) => booking.range.slug))].sort(),
      ['bemowo', 'tarczownia'],
    );
  });
});
