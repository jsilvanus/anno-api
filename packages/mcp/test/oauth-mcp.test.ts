/**
 * End-to-end: register on the OAuth sign-in page → consent → PKCE token
 * exchange → MCP tool calls. The CIMD client metadata fetch is stubbed.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { SqliteAuthStore, SqliteUserStore } from '../src/storage/sqlite.js';

const CLIENT_ID = 'https://client.example/oauth/client.json';
const REDIRECT_URI = 'https://client.example/callback';

let app: FastifyInstance;
let base: string;
let dir: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'kirkkovuosi-mcp-'));
  const store = new SqliteAuthStore(join(dir, 'test.sqlite'));
  const users = new SqliteUserStore(store.getDatabase());
  app = await buildApp({
    publicUrl: 'http://127.0.0.1',
    jwtSecret: randomBytes(32),
    store,
    users,
    logger: false,
    authorization: {
      registration: { enabled: true, allowedEmailDomains: ['seurakunta.fi', 'evl.fi'] },
      fetchClientMetadata: async (clientId: string) => ({ client_id: clientId, client_name: 'Testiasiakas', redirect_uris: [REDIRECT_URI] }),
    },
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  base = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : '';
});

after(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

// The tokens are bound to the configured public URL; requests go to the ephemeral port.
function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function authorizeQuery(challenge: string) {
  return new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
    scope: 'mcp',
    resource: 'http://127.0.0.1/mcp',
  });
}

async function postForm(path: string, form: Record<string, string>) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
    redirect: 'manual',
  });
}

const hidden = (html: string, name: string) => html.match(new RegExp(`name="${name}" value="([^"]*)"`))?.[1];

async function signInPage(challenge: string) {
  const res = await fetch(base + '/oauth/authorize?' + authorizeQuery(challenge));
  const html = await res.text();
  return { res, html, oauth: hidden(html, 'oauth')! };
}

async function approve(oauth: string, ticket: string) {
  const res = await postForm('/oauth/authorize', { oauth, ticket, action: 'approve' });
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location')!);
  assert.equal(location.origin + location.pathname, REDIRECT_URI);
  assert.equal(location.searchParams.get('state'), 'xyz');
  return location.searchParams.get('code')!;
}

async function exchange(code: string, verifier: string) {
  const res = await postForm('/oauth/token', {
    grant_type: 'authorization_code', code, client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, code_verifier: verifier,
  });
  assert.equal(res.status, 200);
  return (await res.json()) as { access_token: string; refresh_token: string };
}

async function mcp(token: string | null, body: unknown) {
  const res = await fetch(base + '/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text.split('\n').filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6)));
  return { status: res.status, headers: res.headers, message: data[0] ?? (text ? JSON.parse(text) : null) };
}

let accessToken = '';

describe('OAuth sign-in page with registration', () => {
  it('shows sign-in and registration forms on the same page', async () => {
    const { res, html } = await signInPage(pkce().challenge);
    assert.equal(res.status, 200);
    assert.match(html, /action="\/oauth\/authorize"/);
    assert.match(html, /action="\/oauth\/register"/);
    assert.match(html, /@seurakunta\.fi/);
    assert.match(res.headers.get('content-security-policy') ?? '', /form-action 'self'/);
  });

  it('registers a user, asks for consent and issues tokens', async () => {
    const { verifier, challenge } = pkce();
    const { oauth } = await signInPage(challenge);
    const res = await postForm('/oauth/register', {
      oauth, name: 'Testi Pappi', email: 'Pappi@Seurakunta.fi', password: 'pitkä-salasana-1', password2: 'pitkä-salasana-1',
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Testiasiakas/);
    assert.match(html, /Testi Pappi/);
    // The consent page must allow the redirect to the client
    assert.match(res.headers.get('content-security-policy') ?? '', /https:\/\/client\.example/);
    const code = await approve(oauth, hidden(html, 'ticket')!);
    const tokens = await exchange(code, verifier);
    assert.ok(tokens.access_token && tokens.refresh_token);
    accessToken = tokens.access_token;
  });

  it('signs in a registered user (e-mail is case-insensitive)', async () => {
    const { verifier, challenge } = pkce();
    const { oauth } = await signInPage(challenge);
    const res = await postForm('/oauth/authorize', { oauth, email: 'pappi@seurakunta.fi', password: 'pitkä-salasana-1' });
    assert.equal(res.status, 200);
    const code = await approve(oauth, hidden(await res.text(), 'ticket')!);
    await exchange(code, verifier);
  });

  it('rejects a wrong password', async () => {
    const { oauth } = await signInPage(pkce().challenge);
    const res = await postForm('/oauth/authorize', { oauth, email: 'pappi@seurakunta.fi', password: 'väärä-salasana' });
    assert.equal(res.status, 401);
  });

  it('rejects consent without a valid login ticket', async () => {
    const { oauth } = await signInPage(pkce().challenge);
    assert.equal((await postForm('/oauth/authorize', { oauth, action: 'approve' })).status, 401);
    assert.equal((await postForm('/oauth/authorize', { oauth, action: 'approve', ticket: 'forged' })).status, 401);
  });

  it('does not accept a ticket issued for another authorization request', async () => {
    const first = await signInPage(pkce().challenge);
    const res = await postForm('/oauth/authorize', { oauth: first.oauth, email: 'pappi@seurakunta.fi', password: 'pitkä-salasana-1' });
    const ticket = hidden(await res.text(), 'ticket')!;
    const second = await signInPage(pkce().challenge);
    assert.equal((await postForm('/oauth/authorize', { oauth: second.oauth, ticket, action: 'approve' })).status, 401);
  });

  it('validates registrations', async () => {
    const { oauth } = await signInPage(pkce().challenge);
    const register = (form: Record<string, string>) => postForm('/oauth/register', { oauth, name: '', ...form });
    assert.equal((await register({ email: 'pappi@seurakunta.fi', password: 'pitkä-salasana-2', password2: 'pitkä-salasana-2' })).status, 409);
    assert.equal((await register({ email: 'uusi@seurakunta.fi', password: 'lyhyt', password2: 'lyhyt' })).status, 400);
    assert.equal((await register({ email: 'uusi@seurakunta.fi', password: 'pitkä-salasana-2', password2: 'eri-salasana-22' })).status, 400);
    assert.equal((await register({ email: 'ulkopuolinen@example.com', password: 'pitkä-salasana-2', password2: 'pitkä-salasana-2' })).status, 403);
    assert.equal((await register({ email: 'ei-sähköposti', password: 'pitkä-salasana-2', password2: 'pitkä-salasana-2' })).status, 400);
  });

  it('escapes user input on the page', async () => {
    const { oauth } = await signInPage(pkce().challenge);
    const res = await postForm('/oauth/register', { oauth, name: '<script>x</script>', email: 'x@seurakunta.fi', password: 'a', password2: 'a' });
    const html = await res.text();
    assert.doesNotMatch(html, /<script>x<\/script>/);
  });
});

describe('MCP', () => {
  it('answers 401 with WWW-Authenticate without a token', async () => {
    const res = await mcp(null, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.equal(res.status, 401);
    assert.match(res.headers.get('www-authenticate') ?? '', /resource_metadata=/);
  });

  it('lists the church year tools', async () => {
    const init = await mcp(accessToken, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
    });
    assert.equal(init.status, 200);
    assert.match(init.message.result.instructions, /Evangelical-Lutheran Church of Finland/);
    const list = await mcp(accessToken, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const names = list.message.result.tools.map((t: { name: string }) => t.name);
    for (const name of ['church_day', 'holy_day', 'upcoming_holy_days', 'church_year_calendar', 'list_holy_days', 'church_year_periods', 'search_bible_reference', 'liturgical_texts']) {
      assert.ok(names.includes(name), name);
    }
  });

  const call = async (name: string, args: Record<string, unknown>) => {
    const res = await mcp(accessToken, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: args } });
    const result = res.message.result;
    return { isError: result.isError, value: result.isError ? result.content[0].text : JSON.parse(result.content[0].text) };
  };

  it('church_day returns the day with texts, colour and rubrics', async () => {
    const { value } = await call('church_day', { date: '2026-03-22' });
    assert.equal(value.holyDay.slug, 'marian-ilmestyspaiva');
    assert.ok(value.holyDay.texts.gospel.text);
    assert.equal(value.liturgicalColor.color, 'valkoinen');
    assert.equal(typeof value.liturgy.gloria, 'boolean');
  });

  it('church_day can return references only', async () => {
    const { value } = await call('church_day', { date: '2025-12-24', include_texts: false });
    assert.equal(value.holyDay.slug, 'jouluaatto');
    assert.equal(typeof value.holyDay.texts.gospel.reference, 'string');
    assert.equal(value.holyDay.texts.gospel.text, undefined);
  });

  it('holy_day finds a day by Latin name', async () => {
    const { value } = await call('holy_day', { name: 'Laetare', year_cycle: 1 });
    assert.equal(value.slug, '4-paastonajan-sunnuntai');
    assert.equal(value.texts.yearCycle, 1);
  });

  it('upcoming_holy_days lists the next days', async () => {
    const { value } = await call('upcoming_holy_days', { from: '2026-12-20', count: 5 });
    assert.equal(value.entries[0].slug, '4-adventtisunnuntai');
    assert.equal(value.entries.length, 5);
  });

  it('search_bible_reference finds readings', async () => {
    const { value } = await call('search_bible_reference', { query: 'Luuk. 15' });
    assert.ok(value.readings.count > 0);
  });

  it('returns a tool error for an invalid date', async () => {
    const res = await call('church_day', { date: '2026-02-30' });
    assert.equal(res.isError, true);
  });
});
