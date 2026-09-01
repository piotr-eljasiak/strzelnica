import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { startTestServer } from './helpers.js';

/**
 * The widget is served by the web layer, but which sites may frame it is the range's data.
 * These tests cover the part the server owns: telling the truth about that list.
 */
describe('Osadzanie widgetu', () => {
  let server;
  let client;

  before(async () => {
    server = await startTestServer();
    client = server.client;
  });
  after(() => server.stop());

  it('podaje domeny, którym wolno osadzić widget', async () => {
    const { status, body } = await client.get('/api/ranges/tarczownia/embed-origins');

    assert.equal(status, 200);
    assert.deepEqual(body.origins, ['http://localhost:5174']);
  });

  it('nie podaje domen nieistniejącej strzelnicy', async () => {
    assert.equal((await client.get('/api/ranges/nie-ma/embed-origins')).status, 404);
  });

  it('wystawia dostępność bez ciasteczka sesji, bo w ramce ono nie dojdzie', async () => {
    const odpowiedz = await fetch(
      `${server.base}/api/ranges/tarczownia/availability?from=2026-09-03&to=2026-09-03`,
    );

    assert.equal(odpowiedz.status, 200);
    assert.equal(odpowiedz.headers.get('set-cookie'), null, 'anonim dostał sesję');
  });
});
