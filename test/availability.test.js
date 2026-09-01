import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { dayAfter, firstFreeSlot, laneId, registerShooter, startTestServer } from './helpers.js';

describe('Dostępność osi', () => {
  let server;
  let client;

  before(async () => {
    server = await startTestServer();
    client = server.client;
  });
  after(() => server.stop());

  it('pokazuje osie strzelnicy każdemu, bez logowania', async () => {
    const { status, body } = await client.get('/api/ranges/tarczownia');

    assert.equal(status, 200);
    assert.equal(body.name, 'Strzelnica Tarczownia');
    assert.deepEqual(
      body.lanes.map((lane) => lane.distanceM).sort((a, b) => a - b),
      [25, 100],
    );
  });

  it('nie zna strzelnicy o nieistniejącym slugu', async () => {
    const { status, body } = await client.get('/api/ranges/nie-ma-takiej');

    assert.equal(status, 404);
    assert.equal(body.error, 'not_found');
  });

  it('wystawia dostępność anonimowo', async () => {
    const dzien = dayAfter(1);
    const { status, body } = await client.get(
      `/api/ranges/tarczownia/availability?from=${dzien}&to=${dzien}`,
    );

    assert.equal(status, 200);
    assert.ok(body.lanes[0].days[0].slots.length > 0);
  });

  it('nie ujawnia w dostępności kto rezerwował ani dlaczego oś jest wyłączona', async () => {
    const { laneId: os, startUtc } = await firstFreeSlot(client, 'tarczownia', 25);
    await registerShooter(client);
    await client.post('/api/ranges/tarczownia/bookings', { laneId: os, startUtc });

    const dzien = startUtc.slice(0, 10);
    const { body } = await client.get(
      `/api/ranges/bemowo/availability?from=${dzien}&to=${dayAfter(6)}`,
    );

    const tekst = JSON.stringify(body);
    assert.doesNotMatch(tekst, /Zawody/i, 'powód blokady wyciekł do dostępności');
    assert.doesNotMatch(tekst, /shooter|email|Nowak|phone/i, 'dane strzelca wyciekły');
  });

  it('oś bez własnego grafiku dziedziczy godziny strzelnicy, oś z własnym ma krótszy dzień', async () => {
    // Oś 25 m dziedziczy 9-20, oś 100 m ma własne 10-18 (dane startowe).
    const wtorek = dayAfter(6); // środa 02.09 + 6 = wtorek 08.09
    const { body } = await client.get(
      `/api/ranges/tarczownia/availability?from=${wtorek}&to=${wtorek}`,
    );

    const os25 = body.lanes.find((lane) => lane.distanceM === 25).days[0].slots;
    const os100 = body.lanes.find((lane) => lane.distanceM === 100).days[0].slots;

    assert.equal(os25.length, 11, 'oś 25 m powinna dziedziczyć 9-20');
    assert.equal(os100.length, 8, 'oś 100 m ma własny grafik 10-18');
  });

  it('nie oferuje dnia, w którym strzelnica jest zamknięta', async () => {
    // Tarczownia nie ma wiersza dla niedzieli.
    const niedziela = dayAfter(4); // środa + 4 = niedziela
    const { body } = await client.get(
      `/api/ranges/tarczownia/availability?from=${niedziela}&to=${niedziela}`,
    );

    assert.equal(body.lanes[0].days[0].slots.length, 0);
  });

  it('nie oferuje slotów, które już się zaczęły', async () => {
    const lokalny = await startTestServer({ now: '2026-09-02T12:00:00Z' }); // 14:00 w Warszawie
    try {
      const { body } = await lokalny.client.get(
        '/api/ranges/tarczownia/availability?from=2026-09-02&to=2026-09-02',
      );
      const godziny = body.lanes.find((lane) => lane.distanceM === 25).days[0].slots;

      assert.ok(godziny.every((slot) => slot.hour >= 14), 'przeszłość trafiła do dostępności');
    } finally {
      await lokalny.stop();
    }
  });

  it('nie sięga poza horyzont rezerwacji strzelnicy', async () => {
    // Tarczownia ma 30 dni, Bemowo 14 -- każda swoje.
    const daleko = dayAfter(60);
    const tarczownia = await client.get(
      `/api/ranges/tarczownia/availability?from=${daleko}&to=${daleko}`,
    );
    const bemowo = await client.get(`/api/ranges/bemowo/availability?from=${daleko}&to=${daleko}`);

    assert.ok(tarczownia.body.to < daleko, 'horyzont Tarczowni nie został przycięty');
    assert.ok(bemowo.body.to < tarczownia.body.to, 'Bemowo powinno mieć krótszy horyzont');
  });

  it('blokada czyni sloty niedostępnymi, nieodróżnialnie od rezerwacji', async () => {
    // W danych startowych oś 50 m w Bemowie ma blokadę "Zawody klubowe" w sobotę 8-14 UTC.
    const { body } = await client.get(
      `/api/ranges/bemowo/availability?from=${dayAfter(1)}&to=${dayAfter(10)}`,
    );

    const os50 = body.lanes.find((lane) => lane.distanceM === 50);
    const zablokowane = os50.days
      .flatMap((day) => day.slots)
      .filter((slot) => slot.state === 'unavailable');

    assert.ok(zablokowane.length > 0, 'blokada nie zablokowała ani jednego slotu');
    assert.deepEqual(
      [...new Set(zablokowane.map((slot) => Object.keys(slot).sort().join(',')))],
      ['hour,startUtc,state'],
      'niedostępny slot niesie więcej pól niż wolny',
    );
  });

  it('rezerwacja u jednej strzelnicy nie zajmuje osi u drugiej', async () => {
    const swiezy = await startTestServer();
    try {
      await registerShooter(swiezy.client);
      const { laneId: os, startUtc } = await firstFreeSlot(swiezy.client, 'tarczownia', 25);
      await swiezy.client.post('/api/ranges/tarczownia/bookings', { laneId: os, startUtc });

      const dzien = startUtc.slice(0, 10);
      const { body } = await swiezy.client.get(
        `/api/ranges/bemowo/availability?from=${dzien}&to=${dzien}`,
      );

      const oTejSamejPorze = body.lanes
        .flatMap((lane) => lane.days.flatMap((day) => day.slots))
        .filter((slot) => slot.startUtc === startUtc);

      assert.ok(oTejSamejPorze.length > 0);
      assert.ok(
        oTejSamejPorze.every((slot) => slot.state === 'free'),
        'rezerwacja przeciekła do drugiej strzelnicy',
      );
    } finally {
      await swiezy.stop();
    }
  });

  it('nie pozwala rezerwować osi należącej do innej strzelnicy', async () => {
    const swiezy = await startTestServer();
    try {
      await registerShooter(swiezy.client);
      const osBemowa = await laneId(swiezy.client, 'bemowo', 50);
      const { startUtc } = await firstFreeSlot(swiezy.client, 'tarczownia', 25);

      const { status } = await swiezy.client.post('/api/ranges/tarczownia/bookings', {
        laneId: osBemowa,
        startUtc,
      });

      assert.equal(status, 404, 'oś obcej strzelnicy została przyjęta');
    } finally {
      await swiezy.stop();
    }
  });
});

describe('Horyzont i stronicowanie dostępności', () => {
  let server;
  let client;

  before(async () => {
    server = await startTestServer();
    client = server.client;
  });
  after(() => server.stop());

  it('podaje granice okna rezerwacji, żeby interfejs wiedział, dokąd może przewijać', async () => {
    const { body } = await client.get('/api/ranges/tarczownia/availability');

    assert.equal(body.earliestDate, '2026-09-02', 'okno powinno zaczynać się dziś');
    assert.equal(body.latestDate, '2026-10-02', 'Tarczownia ma horyzont 30 dni');
  });

  it('okno kończy się wcześniej w strzelnicy o krótszym horyzoncie', async () => {
    const { body } = await client.get('/api/ranges/bemowo/availability');

    assert.equal(body.latestDate, '2026-09-16', 'Bemowo ma horyzont 14 dni');
  });

  it('wydaje terminy w drugim i czwartym tygodniu, nie tylko w pierwszym', async () => {
    const drugiTydzien = await client.get(
      '/api/ranges/tarczownia/availability?from=2026-09-09&to=2026-09-15',
    );
    const czwartyTydzien = await client.get(
      '/api/ranges/tarczownia/availability?from=2026-09-23&to=2026-09-29',
    );

    const wolne = (odpowiedz) =>
      odpowiedz.body.lanes
        .flatMap((lane) => lane.days.flatMap((day) => day.slots))
        .filter((slot) => slot.state === 'free').length;

    assert.ok(wolne(drugiTydzien) > 0, 'drugi tydzień jest pusty');
    assert.ok(wolne(czwartyTydzien) > 0, 'czwarty tydzień jest pusty');
  });

  it('przycina żądanie wykraczające poza horyzont zamiast zwracać błąd', async () => {
    const { status, body } = await client.get(
      '/api/ranges/tarczownia/availability?from=2026-12-01&to=2026-12-07',
    );

    assert.equal(status, 200);
    assert.equal(body.to, body.latestDate, 'zakres nie został przycięty do horyzontu');
  });
});
