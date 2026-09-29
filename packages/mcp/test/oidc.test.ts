/**
 * OIDC sign-in against a fake OpenID provider: the SSO button → /oidc/login → provider →
 * /oidc/callback → consent → PKCE token exchange → /mcp. The CIMD client metadata fetch is stubbed.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from '@node-rs/argon2';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { SqliteAuthStore, SqliteUserStore } from '../src/storage/sqlite.js';
import { parseOidcConfig, type OidcConfig } from '../src/oauth/oidc.js';
import { startFakeOidcProvider, type FakeOidcProvider } from './fake-oidc-provider.js';

const CLIENT_ID = 'https://client.example/oauth/client.json';
const REDIRECT_URI = 'https://client.example/callback';
const PUBLIC_URL = 'http://127.0.0.1';

interface Running { app: FastifyInstance; base: string; users: SqliteUserStore }

let dir: string;
let idp: FakeOidcProvider;
let oidcConfig: OidcConfig;
let withOidc: Running;
let withoutOidc: Running;

async function start(name: string, oidc?: OidcConfig): Promise<Running> {
  const store = new SqliteAuthStore(join(dir, name + '.sqlite'));
  const users = new SqliteUserStore(store.getDatabase());
  const app = await buildApp({
    publicUrl: PUBLIC_URL,
    jwtSecret: randomBytes(32),
    store,
    users,
    logger: false,
    authorization: {
      fetchClientMetadata: async (clientId: string) => ({ client_id: clientId, client_name: 'Testiasiakas', redirect_uris: [REDIRECT_URI] }),
      ...(oidc ? { oidc } : {}),
    },
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  const base = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : '';
  return { app, base, users };
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'kirkkovuosi-oidc-'));
  idp = await startFakeOidcProvider();
  oidcConfig = parseOidcConfig({ OIDC_ISSUER: idp.issuer, OIDC_CLIENT_ID: idp.clientId, OIDC_CLIENT_SECRET: idp.clientSecret })!;
  withOidc = await start('on', oidcConfig);
  withoutOidc = await start('off');
});

after(async () => {
  await withOidc.app.close();
  await withoutOidc.app.close();
  await idp.close();
  rmSync(dir, { recursive: true, force: true });
});

function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

const authorizeQuery = (challenge: string) => new URLSearchParams({
  response_type: 'code', client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, code_challenge: challenge,
  code_challenge_method: 'S256', state: 'xyz', scope: 'mcp', resource: PUBLIC_URL + '/mcp',
});

const hidden = (html: string, name: string) => html.match(new RegExp(`name="${name}" value="([^"]*)"`))?.[1];
const cookieOf = (res: Response) => res.headers.get('set-cookie')?.match(/anno_oidc=([^;]*)/)?.[1];

/** Starts an SSO sign-in from the authorize page; returns the provider's redirect back to the callback. */
async function startSso(base: string, challenge = pkce().challenge) {
  const page = await fetch(base + '/oauth/authorize?' + authorizeQuery(challenge));
  const html = await page.text();
  const href = html.match(/href="(\/oidc\/login\?oauth=[^"]+)"/)?.[1];
  assert.ok(href, 'SSO button');
  const login = await fetch(base + href.replaceAll('&amp;', '&'), { redirect: 'manual' });
  assert.equal(login.status, 302);
  const cookie = cookieOf(login)!;
  assert.ok(cookie);
  assert.match(login.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax/);
  assert.match(login.headers.get('set-cookie')!, /Path=\/oidc/);
  const atIdp = await fetch(login.headers.get('location')!, { redirect: 'manual' });
  assert.equal(atIdp.status, 302);
  const back = new URL(atIdp.headers.get('location')!);
  assert.equal(back.origin + back.pathname, PUBLIC_URL + '/oidc/callback');
  return { cookie, callback: base + '/oidc/callback' + back.search, oauth: hidden(html, 'oauth')! };
}

const callback = (url: string, cookie?: string) =>
  fetch(url, { redirect: 'manual', ...(cookie ? { headers: { cookie: 'anno_oidc=' + cookie } } : {}) });

async function ssoToConsent(base: string, challenge?: string) {
  const { cookie, callback: url, oauth } = await startSso(base, challenge);
  const res = await callback(url, cookie);
  return { res, html: await res.text(), oauth };
}

async function postForm(base: string, path: string, form: Record<string, string>) {
  return fetch(base + path, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(), redirect: 'manual',
  });
}

describe('OIDC configuration', () => {
  it('is off without OIDC_ISSUER', () => {
    assert.equal(parseOidcConfig({}), undefined);
    assert.equal(parseOidcConfig({ OIDC_ISSUER: '  ', OIDC_CLIENT_ID: 'x' }), undefined);
  });

  it('applies defaults', () => {
    const cfg = parseOidcConfig({ OIDC_ISSUER: 'https://auth.example.org/application/o/kv/', OIDC_CLIENT_ID: 'kv' })!;
    assert.equal(cfg.issuer, 'https://auth.example.org/application/o/kv/');
    assert.equal(cfg.scopes, 'openid email profile');
    assert.equal(cfg.buttonLabel, 'Kirjaudu kertakirjautumisella');
    assert.equal(cfg.createUsers, false);
    assert.equal(cfg.trustEmail, false);
    assert.equal(cfg.clientSecret, undefined);
  });

  it('rejects invalid settings', () => {
    const ok = { OIDC_ISSUER: 'https://auth.example.org/', OIDC_CLIENT_ID: 'kv' };
    assert.throws(() => parseOidcConfig({ OIDC_ISSUER: 'https://auth.example.org/' }), /OIDC_CLIENT_ID/);
    assert.throws(() => parseOidcConfig({ ...ok, OIDC_ISSUER: 'auth.example.org' }), /absolute URL/);
    assert.throws(() => parseOidcConfig({ ...ok, OIDC_ISSUER: 'http://auth.example.org/', NODE_ENV: 'production' }), /https/);
    assert.throws(() => parseOidcConfig({ ...ok, OIDC_SCOPES: 'email profile' }), /openid/);
    assert.throws(() => parseOidcConfig({ ...ok, OIDC_CREATE_USERS: 'yes' }), /OIDC_CREATE_USERS/);
    assert.throws(() => parseOidcConfig({ ...ok, OIDC_TRUST_EMAIL: '1' }), /OIDC_TRUST_EMAIL/);
    assert.ok(parseOidcConfig({ ...ok, OIDC_ISSUER: 'http://localhost:9000/' }));
  });
});

describe('OIDC off', () => {
  it('shows no SSO button and has no /oidc routes', async () => {
    const page = await fetch(withoutOidc.base + '/oauth/authorize?' + authorizeQuery(pkce().challenge));
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.doesNotMatch(html, /oidc|kertakirjautumisella/i);
    assert.equal((await fetch(withoutOidc.base + '/oidc/login?oauth=' + hidden(html, 'oauth'))).status, 404);
    assert.equal((await fetch(withoutOidc.base + '/oidc/callback?code=x&state=y')).status, 404);
  });

  it('adds no OIDC-provider fields to the metadata, even with OIDC on', async () => {
    const meta = await (await fetch(withOidc.base + '/.well-known/openid-configuration')).json() as Record<string, unknown>;
    assert.equal(meta.jwks_uri, undefined);
    assert.equal(meta.userinfo_endpoint, undefined);
    assert.equal(meta.id_token_signing_alg_values_supported, undefined);
  });
});

describe('OIDC sign-in for an MCP client', () => {
  it('shows the SSO button next to the password form', async () => {
    const html = await (await fetch(withOidc.base + '/oauth/authorize?' + authorizeQuery(pkce().challenge))).text();
    assert.match(html, /Kirjaudu kertakirjautumisella/);
    assert.match(html, /name="password"/);
  });

  it('refuses /oidc/login without a valid authorization request', async () => {
    assert.equal((await fetch(withOidc.base + '/oidc/login', { redirect: 'manual' })).status, 400);
    const bogus = Buffer.from('response_type=code&client_id=' + encodeURIComponent(CLIENT_ID)).toString('base64url');
    assert.equal((await fetch(withOidc.base + '/oidc/login?oauth=' + bogus, { redirect: 'manual' })).status, 400);
  });

  it('refuses an unknown identity when OIDC_CREATE_USERS is off', async () => {
    oidcConfig.createUsers = false;
    idp.nextUser = { sub: 'nobody', email: 'nobody@seurakunta.fi', email_verified: true };
    const { res, html } = await ssoToConsent(withOidc.base);
    assert.equal(res.status, 403);
    assert.match(html, /ylläpitäjää/);
    assert.doesNotMatch(html, /name="ticket"/);
  });

  it('creates a user when OIDC_CREATE_USERS is on, then runs consent → token → /mcp', async () => {
    oidcConfig.createUsers = true;
    idp.nextUser = { sub: 'sso-1', email: 'Kanttori@Seurakunta.fi', email_verified: true, name: 'Kaisa Kanttori' };
    const { verifier, challenge } = pkce();
    const { res, html, oauth } = await ssoToConsent(withOidc.base, challenge);
    assert.equal(res.status, 200);
    assert.match(html, /Kaisa Kanttori/);
    assert.match(res.headers.get('content-security-policy') ?? '', /https:\/\/client\.example/);
    assert.match(res.headers.get('set-cookie') ?? '', /anno_oidc=; Path=\/oidc; Max-Age=0/);
    const created = withOidc.users.getUserByEmail('kanttori@seurakunta.fi');
    assert.equal(created?.name, 'Kaisa Kanttori');
    assert.equal(created?.passwordHash, undefined);

    const approve = await postForm(withOidc.base, '/oauth/authorize', { oauth, ticket: hidden(html, 'ticket')!, action: 'approve' });
    assert.equal(approve.status, 302);
    const location = new URL(approve.headers.get('location')!);
    assert.equal(location.searchParams.get('state'), 'xyz');
    const token = await postForm(withOidc.base, '/oauth/token', {
      grant_type: 'authorization_code', code: location.searchParams.get('code')!, client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, code_verifier: verifier,
    });
    assert.equal(token.status, 200);
    const { access_token } = await token.json() as { access_token: string };
    const mcp = await fetch(withOidc.base + '/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: 'Bearer ' + access_token },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.equal(mcp.status, 200);
    assert.match(await mcp.text(), /church_day/);
  });

  it('signs a linked identity in again even after its e-mail changes', async () => {
    oidcConfig.createUsers = false;
    idp.nextUser = { sub: 'sso-1', email: 'uusi@example.com', email_verified: false, name: 'Kaisa Kanttori' };
    const { res, html } = await ssoToConsent(withOidc.base);
    assert.equal(res.status, 200);
    assert.match(html, /Kaisa Kanttori/);
  });

  it('reads the e-mail from userinfo when the ID token has none', async () => {
    oidcConfig.createUsers = false;
    withOidc.users.createUser({ id: 'u-userinfo', name: 'Userinfo Käyttäjä', email: 'ui@seurakunta.fi', createdAt: Date.now() });
    idp.nextUser = { sub: 'sso-ui', email: 'ui@seurakunta.fi', email_verified: true, emailOnlyInUserinfo: true };
    const { res, html } = await ssoToConsent(withOidc.base);
    assert.equal(res.status, 200);
    assert.match(html, /Userinfo Käyttäjä/);
  });

  it('links an existing password account by verified e-mail; password sign-in keeps working', async () => {
    oidcConfig.createUsers = false;
    withOidc.users.createUser({ id: 'u-pw', name: 'Pertti Pappi', email: 'pertti@seurakunta.fi', passwordHash: await hash('pitkä-salasana-1', { algorithm: 2 }), createdAt: Date.now() });
    idp.nextUser = { sub: 'sso-pertti', email: 'PERTTI@seurakunta.fi', email_verified: true };
    const { res, html } = await ssoToConsent(withOidc.base);
    assert.equal(res.status, 200);
    assert.match(html, /Pertti Pappi/);
    assert.equal(withOidc.users.getUserIdByOidcIdentity(oidcConfig.issuer, 'sso-pertti'), 'u-pw');

    const html2 = await (await fetch(withOidc.base + '/oauth/authorize?' + authorizeQuery(pkce().challenge))).text();
    const pw = await postForm(withOidc.base, '/oauth/authorize', { oauth: hidden(html2, 'oauth')!, email: 'pertti@seurakunta.fi', password: 'pitkä-salasana-1' });
    assert.equal(pw.status, 200);
    assert.match(await pw.text(), /name="ticket"/);
  });

  it('does not link by an unverified e-mail unless OIDC_TRUST_EMAIL is set', async () => {
    oidcConfig.createUsers = false;
    withOidc.users.createUser({ id: 'u-unv', name: 'Unto Vahvistamaton', email: 'unto@seurakunta.fi', createdAt: Date.now() });
    idp.nextUser = { sub: 'sso-unto', email: 'unto@seurakunta.fi', email_verified: false };
    assert.equal((await ssoToConsent(withOidc.base)).res.status, 403);
    assert.equal(withOidc.users.getUserIdByOidcIdentity(oidcConfig.issuer, 'sso-unto'), undefined);

    oidcConfig.trustEmail = true;
    try {
      const { res, html } = await ssoToConsent(withOidc.base);
      assert.equal(res.status, 200);
      assert.match(html, /Unto Vahvistamaton/);
    } finally {
      oidcConfig.trustEmail = false;
    }
  });

  it('does not store an unverified e-mail on a created user', async () => {
    oidcConfig.createUsers = true;
    try {
      idp.nextUser = { sub: 'sso-new', email: 'someone@example.com', email_verified: false, preferred_username: 'someone' };
      const { res, html } = await ssoToConsent(withOidc.base);
      assert.equal(res.status, 200);
      const user = withOidc.users.getUser(withOidc.users.getUserIdByOidcIdentity(oidcConfig.issuer, 'sso-new')!);
      assert.equal(user?.name, 'someone');
      assert.equal(user?.email, undefined);
      assert.match(html, /someone/);
    } finally {
      oidcConfig.createUsers = false;
    }
  });

  it('refuses a deleted user', async () => {
    oidcConfig.createUsers = false;
    withOidc.users.createUser({ id: 'u-del', name: 'Poistettava', email: 'del@seurakunta.fi', createdAt: Date.now() });
    idp.nextUser = { sub: 'sso-del', email: 'del@seurakunta.fi', email_verified: true };
    assert.equal((await ssoToConsent(withOidc.base)).res.status, 200);
    withOidc.users.deleteUser('u-del');
    const { res } = await ssoToConsent(withOidc.base);
    assert.equal(res.status, 403);
  });

  it('refuses a callback whose state does not match the cookie', async () => {
    idp.nextUser = { sub: 'sso-1' };
    const { callback: url } = await startSso(withOidc.base);
    assert.equal((await callback(url)).status, 400);
    assert.equal((await callback(url, 'other-state')).status, 400);
  });

  it('refuses a replayed state', async () => {
    idp.nextUser = { sub: 'sso-1' };
    const { cookie, callback: url } = await startSso(withOidc.base);
    assert.equal((await callback(url, cookie)).status, 200);
    const replay = await callback(url, cookie);
    assert.equal(replay.status, 400);
    assert.doesNotMatch(await replay.text(), /name="ticket"/);
  });

  it('shows an error page when the provider returns an error', async () => {
    const { cookie, callback: url } = await startSso(withOidc.base);
    const state = new URL(url).searchParams.get('state')!;
    const res = await callback(withOidc.base + '/oidc/callback?error=access_denied&state=' + state, cookie);
    assert.equal(res.status, 400);
    assert.match(await res.text(), /Kertakirjautuminen epäonnistui/);
    // The pending sign-in was consumed
    assert.equal((await callback(url, cookie)).status, 400);
  });
});
