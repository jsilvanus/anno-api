/**
 * HTTP tests for the REST API (server on an ephemeral port).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/index.js';

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise(resolve => server.close(resolve)));

async function get(path) {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
}

describe('REST API', () => {
  it('lists endpoints at the root', async () => {
    const { status, body } = await get('/');
    assert.equal(status, 200);
    assert.ok(body.endpoints.length > 20);
  });

  it('resolves a date with texts, colour, propers and rubrics', async () => {
    const { status, body } = await get('/api/v1/date/2026-03-22');
    assert.equal(status, 200);
    assert.equal(body.holyDay.slug, 'marian-ilmestyspaiva');
    assert.equal(body.holyDay.replaces, '5-paastonajan-sunnuntai');
    assert.equal(body.churchYear.yearCycle, 2);
    assert.ok(body.holyDay.texts.gospel.text);
    assert.equal(body.liturgicalColor.color, 'valkoinen');
    assert.equal(typeof body.liturgy.gloria, 'boolean');
  });

  it('omits other year cycles with ?cycles=false', async () => {
    const { body } = await get('/api/v1/date/2025-11-30?cycles=false');
    assert.equal(body.holyDay.allYearCycles, undefined);
    assert.ok(body.holyDay.texts);
  });

  it('returns texts of a requested cycle', async () => {
    const { body } = await get('/api/v1/date/2025-11-30/texts?cycle=1');
    assert.equal(body.yearCycle, 1);
    assert.equal(body.texts.gospel.reference, 'Matt. 21:1--9');
  });

  it('rejects invalid dates and cycles', async () => {
    assert.equal((await get('/api/v1/date/2026-02-30')).status, 400);
    assert.equal((await get('/api/v1/date/2026-02-03/texts?cycle=4')).status, 400);
  });

  it('returns 404 for an unknown holy day', async () => {
    assert.equal((await get('/api/v1/holy-day/ei-ole')).status, 404);
  });

  it('serves every date view for today', async () => {
    for (const view of ['texts', 'prayer', 'gospel', 'propers', 'color', 'liturgy']) {
      const { status } = await get(`/api/v1/today/${view}`);
      assert.equal(status, 200, view);
    }
  });

  it('searches readings by reference', async () => {
    const { body } = await get('/api/v1/search/text?q=Matt.%2021');
    assert.ok(body.count > 0);
  });

  it('lists the periods of the church year', async () => {
    const { body } = await get('/api/v1/periods');
    assert.ok(body.periods.find(p => p.name === 'Paastonaika'));
  });

  it('serves post-communion prayers', async () => {
    const { body } = await get('/api/v1/propers/kiitosrukoukset-ehtoollinen');
    assert.ok(body.kiitosrukouksetEhtoollinen.length >= 7);
  });
});
