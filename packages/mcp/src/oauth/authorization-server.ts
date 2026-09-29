import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hash, verify } from '@node-rs/argon2';
import { SignJWT, jwtVerify } from 'jose';
import type { AuthStore, McpUser, UserStore } from '../storage/interface.js';
import { fetchCimdMetadata, isCimdClientId, type CimdMetadata } from './cimd.js';
import { randomToken, verifyS256 } from './pkce.js';
import { issueAccessToken } from './jwt.js';
import { contentSecurityPolicy, redirectSource } from '../csp.js';
import { RateLimiter } from './rate-limit.js';
import { OidcRelyingParty, type OidcClaims, type OidcConfig } from './oidc.js';

export interface RegistrationOptions {
  /** Allow new users to create an account on the sign-in page (default true). */
  enabled: boolean;
  /** When non-empty, only these e-mail domains may register (e.g. ["evl.fi"]). */
  allowedEmailDomains: string[];
  /** Minimum password length (default 10). */
  minPasswordLength: number;
}

export interface AuthorizationServerOptions {
  registration?: Partial<RegistrationOptions>;
  /** Resolves a CIMD client_id to its metadata. Replaceable in tests. */
  fetchClientMetadata?: (clientId: string) => Promise<CimdMetadata>;
  /** OpenID Connect sign-in with an external identity provider. Unset = off (no button, no /oidc routes). */
  oidc?: OidcConfig;
}

const LOGIN_TICKET_TTL = '10m';

function escapeHtml(value: string): string {
  return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
}

function page(title: string, body: string): string {
  return '<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escapeHtml(title) +
    '</title><style>body{font-family:system-ui,sans-serif;background:#f6f7f9;margin:0;padding:4rem 1rem;color:#1d1d1f}main{max-width:420px;margin:0 auto;background:#fff;padding:2rem;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.08)}h1{margin-top:0;font-size:1.5rem}h2{font-size:1.1rem;margin:0}label{display:block;margin:.9rem 0 .35rem}input{display:block;width:100%;box-sizing:border-box;padding:.7rem;border:1px solid #ccc;border-radius:7px;font:inherit}button{margin-top:1rem;padding:.7rem 1.1rem;border:0;border-radius:7px;cursor:pointer;background:#5b2a86;color:#fff;font:inherit}.secondary{margin-left:.5rem;background:#eee;color:#1d1d1f}.error{color:#b00020}.hint{color:#555;font-size:.9rem}a.button{display:inline-block;padding:.7rem 1.1rem;border-radius:7px;background:#5b2a86;color:#fff;text-decoration:none}.or{color:#555;font-size:.9rem;margin-top:1.5rem}details{margin-top:2rem;border-top:1px solid #e5e5e5;padding-top:1.2rem}summary{cursor:pointer;font-weight:600}</style></head><body><main>' +
    body +
    '</main></body></html>';
}

interface LoginPageState {
  loginError?: string;
  registerError?: string;
  registration: RegistrationOptions;
  /** Label of the single sign-on button; the button is shown only when OIDC is configured. */
  sso?: string;
  values?: { email?: string; name?: string };
}

function loginPage(oauth: string, state: LoginPageState): string {
  const v = state.values ?? {};
  const reg = state.registration;
  const domains = reg.allowedEmailDomains;
  const registerSection = !reg.enabled ? '' :
    '<details' + (state.registerError ? ' open' : '') + '><summary>Uusi käyttäjä? Luo tunnus</summary>' +
    (state.registerError ? '<p class="error">' + escapeHtml(state.registerError) + '</p>' : '') +
    '<form method="post" action="/oauth/register">' +
    '<input type="hidden" name="oauth" value="' + escapeHtml(oauth) + '">' +
    '<label for="reg-name">Nimi <span class="hint">(valinnainen)</span></label><input id="reg-name" name="name" autocomplete="name" maxlength="100" value="' + escapeHtml(v.name ?? '') + '">' +
    '<label for="reg-email">Sähköposti</label><input id="reg-email" name="email" type="email" autocomplete="email" required value="' + escapeHtml(state.registerError ? v.email ?? '' : '') + '">' +
    (domains.length ? '<p class="hint">Sallitut sähköpostiosoitteet: ' + domains.map(d => '@' + escapeHtml(d)).join(', ') + '</p>' : '') +
    '<label for="reg-password">Salasana</label><input id="reg-password" name="password" type="password" autocomplete="new-password" minlength="' + reg.minPasswordLength + '" required>' +
    '<label for="reg-password2">Salasana uudelleen</label><input id="reg-password2" name="password2" type="password" autocomplete="new-password" minlength="' + reg.minPasswordLength + '" required>' +
    '<p class="hint">Vähintään ' + reg.minPasswordLength + ' merkkiä. Tunnukseen tallennetaan vain sähköposti, nimi ja salasanan tiiviste.</p>' +
    '<button type="submit">Luo tunnus ja jatka</button></form></details>';

  return page('Kirjaudu – Kirkkovuosi MCP',
    '<h1>Kirjaudu sisään</h1><p>Kirjaudu sisään, jotta MCP-sovellus voi käyttää Kirkkovuosi-palvelua.</p>' +
    (state.loginError ? '<p class="error">' + escapeHtml(state.loginError) + '</p>' : '') +
    (state.sso ? '<p><a class="button" href="/oidc/login?oauth=' + encodeURIComponent(oauth) + '">' + escapeHtml(state.sso) + '</a></p><p class="or">tai sähköpostilla ja salasanalla</p>' : '') +
    '<form method="post" action="/oauth/authorize">' +
    '<input type="hidden" name="oauth" value="' + escapeHtml(oauth) + '">' +
    '<label for="email">Sähköposti</label><input id="email" name="email" type="email" autocomplete="username" required autofocus value="' + escapeHtml(state.registerError ? '' : v.email ?? '') + '">' +
    '<label for="password">Salasana</label><input id="password" name="password" type="password" autocomplete="current-password" required>' +
    '<button type="submit">Kirjaudu</button></form>' +
    registerSection);
}

function consentPage(oauth: string, ticket: string, userName: string, clientName: string): string {
  return page('Salli pääsy – Kirkkovuosi MCP',
    '<h1>Salli pääsy</h1><p><strong>' + escapeHtml(clientName) +
    '</strong> pyytää pääsyä Kirkkovuosi-palveluun käyttäjänä <strong>' + escapeHtml(userName) +
    '</strong>.</p><form method="post" action="/oauth/authorize">' +
    '<input type="hidden" name="oauth" value="' + escapeHtml(oauth) + '">' +
    '<input type="hidden" name="ticket" value="' + escapeHtml(ticket) + '">' +
    '<button type="submit" name="action" value="approve">Salli</button>' +
    '<button class="secondary" type="submit" name="action" value="deny">Estä</button></form>');
}

function errorPage(title: string, message?: string): string {
  return page(title, '<h1>' + escapeHtml(title) + '</h1>' + (message ? '<p>' + escapeHtml(message) + '</p>' : ''));
}

function encodeOAuth(query: Record<string,string|undefined>): string {
  return Buffer.from(new URLSearchParams(Object.entries(query).filter((entry): entry is [string,string] => typeof entry[1] === 'string')).toString()).toString('base64url');
}

function decodeOAuth(value: string): Record<string,string|undefined> {
  return Object.fromEntries(new URLSearchParams(Buffer.from(value,'base64url').toString('utf8')));
}

function sendHtml(reply: FastifyReply, html: string, formAction: string[] = [], status = 200) {
  return reply.code(status).header('Content-Security-Policy', contentSecurityPolicy(formAction)).header('Cache-Control', 'no-store').type('text/html').send(html);
}

const oauthHash = (oauth: string) => createHash('sha256').update(oauth).digest('base64url');

const OIDC_COOKIE = 'anno_oidc';
const OIDC_STATE_TTL_MS = 10 * 60_000;

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function mountAuthorizationServer(
  app: FastifyInstance,
  issuer: string,
  resource: string,
  secret: Uint8Array,
  authStore: AuthStore,
  users: UserStore,
  options: AuthorizationServerOptions = {},
): Promise<void> {
  const registration: RegistrationOptions = {
    enabled: options.registration?.enabled ?? true,
    allowedEmailDomains: (options.registration?.allowedEmailDomains ?? []).map(d => d.toLowerCase().replace(/^@/, '')),
    minPasswordLength: options.registration?.minPasswordLength ?? 10,
  };
  const fetchClientMetadata = options.fetchClientMetadata ?? fetchCimdMetadata;
  const loginLimiter = new RateLimiter({ limit: 10, windowMs: 15 * 60_000 });
  const registerLimiter = new RateLimiter({ limit: 5, windowMs: 60 * 60_000 });
  const ticketAudience = issuer + '/oauth/authorize';
  const oidc = options.oidc;
  const loginState = (extra: Omit<LoginPageState, 'registration' | 'sso'>): LoginPageState =>
    ({ registration, ...(oidc ? { sso: oidc.buttonLabel } : {}), ...extra });

  async function validateRequest(query: Record<string,string|undefined>) {
    if (query.response_type !== 'code' || !query.client_id || !query.redirect_uri || !query.code_challenge || query.code_challenge_method !== 'S256') {
      throw new Error('Invalid OAuth request');
    }
    if (!isCimdClientId(query.client_id)) throw new Error('Invalid client_id');
    const metadata = await fetchClientMetadata(query.client_id);
    if (!metadata.redirect_uris.includes(query.redirect_uri)) throw new Error('Invalid redirect_uri');
    return metadata;
  }

  /** Signed, short-lived proof that the user signed in for this authorization request. */
  function issueLoginTicket(user: McpUser, oauth: string): Promise<string> {
    return new SignJWT({ typ: 'login', oauth: oauthHash(oauth) })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(issuer)
      .setAudience(ticketAudience)
      .setIssuedAt()
      .setExpirationTime(LOGIN_TICKET_TTL)
      .sign(secret);
  }

  async function verifyLoginTicket(ticket: string, oauth: string): Promise<McpUser | undefined> {
    try {
      const { payload } = await jwtVerify(ticket, secret, { algorithms: ['HS256'], issuer, audience: ticketAudience });
      if (payload.typ !== 'login' || payload.oauth !== oauthHash(oauth) || typeof payload.sub !== 'string') return undefined;
      return users.getUser(payload.sub);
    } catch {
      return undefined;
    }
  }

  async function showConsent(reply: FastifyReply, oauth: string, q: Record<string,string|undefined>, metadata: CimdMetadata, user: McpUser) {
    const ticket = await issueLoginTicket(user, oauth);
    // Approve/deny redirect to the client: form-action must allow its redirect_uri, or browsers block the redirect.
    return sendHtml(reply, consentPage(oauth, ticket, user.name, metadata.client_name ?? q.client_id!), [redirectSource(q.redirect_uri!)]);
  }

  async function parseOAuth(body: Record<string,string|undefined>) {
    if (!body.oauth) throw new Error('missing oauth');
    const q = decodeOAuth(body.oauth);
    const metadata = await validateRequest(q);
    return { q, metadata };
  }

  const clientIp = (request: FastifyRequest) => request.ip;

  app.get('/oauth/authorize', async (request, reply) => {
    const q = request.query as Record<string,string|undefined>;
    try {
      await validateRequest(q);
      return sendHtml(reply, loginPage(encodeOAuth(q), loginState({})));
    } catch {
      return sendHtml(reply, errorPage('Virheellinen valtuutuspyyntö'), [], 400);
    }
  });

  app.post('/oauth/authorize', async (request, reply) => {
    const body = request.body as Record<string,string|undefined>;
    let q: Record<string,string|undefined>;
    let metadata: CimdMetadata;
    try {
      ({ q, metadata } = await parseOAuth(body));
    } catch {
      return sendHtml(reply, errorPage('Virheellinen valtuutuspyyntö'), [], 400);
    }
    const oauth = body.oauth!;

    // Step 2: consent decision, authenticated by the login ticket from step 1
    if (body.action !== undefined) {
      const user = body.ticket ? await verifyLoginTicket(body.ticket, oauth) : undefined;
      if (!user) {
        return sendHtml(reply, loginPage(oauth, loginState({ loginError: 'Kirjautuminen on vanhentunut. Kirjaudu uudelleen.' })), [], 401);
      }

      if (body.action !== 'approve') {
        const target = new URL(q.redirect_uri!);
        target.searchParams.set('error','access_denied');
        target.searchParams.set('iss',issuer);
        if (q.state) target.searchParams.set('state',q.state);
        return reply.redirect(target.toString());
      }

      const code = randomToken();
      authStore.saveAuthorizationCode({
        code,
        clientId: q.client_id!,
        redirectUri: q.redirect_uri!,
        challenge: q.code_challenge!,
        subject: user.id,
        scope: q.scope ?? 'mcp',
        expires: Date.now() + 60_000,
      });

      const target = new URL(q.redirect_uri!);
      target.searchParams.set('code',code);
      target.searchParams.set('iss',issuer);
      if (q.state) target.searchParams.set('state',q.state);
      return reply.redirect(target.toString());
    }

    // Step 1: sign in
    if (!body.email || !body.password) {
      return sendHtml(reply, loginPage(oauth, loginState({ loginError: 'Anna sähköposti ja salasana.' })), [], 400);
    }
    if (!loginLimiter.allow(clientIp(request))) {
      return sendHtml(reply, loginPage(oauth, loginState({ loginError: 'Liian monta kirjautumisyritystä. Yritä myöhemmin uudelleen.', values: { email: body.email } })), [], 429);
    }
    const user = users.getUserByEmail(body.email.trim());
    if (!user?.passwordHash || !(await verify(user.passwordHash, body.password))) {
      loginLimiter.hit(clientIp(request));
      return sendHtml(reply, loginPage(oauth, loginState({ loginError: 'Väärä sähköposti tai salasana.', values: { email: body.email } })), [], 401);
    }
    return showConsent(reply, oauth, q, metadata, user);
  });

  app.post('/oauth/register', async (request, reply) => {
    const body = request.body as Record<string,string|undefined>;
    let q: Record<string,string|undefined>;
    let metadata: CimdMetadata;
    try {
      ({ q, metadata } = await parseOAuth(body));
    } catch {
      return sendHtml(reply, errorPage('Virheellinen valtuutuspyyntö'), [], 400);
    }
    const oauth = body.oauth!;
    if (!registration.enabled) {
      return sendHtml(reply, loginPage(oauth, loginState({})), [], 403);
    }

    const email = (body.email ?? '').trim().toLowerCase();
    const name = (body.name ?? '').trim().slice(0, 100);
    const values = { email, name };
    const fail = (message: string, status = 400) =>
      sendHtml(reply, loginPage(oauth, loginState({ registerError: message, values })), [], status);

    if (!registerLimiter.allow(clientIp(request))) return fail('Liian monta rekisteröitymistä. Yritä myöhemmin uudelleen.', 429);
    if (!EMAIL_RE.test(email) || email.length > 254) return fail('Anna kelvollinen sähköpostiosoite.');
    const domain = email.split('@')[1]!;
    if (registration.allowedEmailDomains.length && !registration.allowedEmailDomains.includes(domain)) {
      return fail('Tällä sähköpostiosoitteella ei voi luoda tunnusta.', 403);
    }
    const password = body.password ?? '';
    if (password.length < registration.minPasswordLength) return fail(`Salasanan on oltava vähintään ${registration.minPasswordLength} merkkiä.`);
    if (password.length > 1024) return fail('Salasana on liian pitkä.');
    if (password !== body.password2) return fail('Salasanat eivät täsmää.');

    registerLimiter.hit(clientIp(request));
    if (users.getUserByEmail(email)) {
      return fail('Tällä sähköpostiosoitteella on jo tunnus. Kirjaudu sisään.', 409);
    }

    const user: McpUser = {
      id: randomUUID(),
      name: name || email,
      email,
      passwordHash: await hash(password, { algorithm: 2 }),
      createdAt: Date.now(),
    };
    try {
      users.createUser(user);
    } catch {
      // Unique e-mail constraint: a concurrent registration won
      return fail('Tällä sähköpostiosoitteella on jo tunnus. Kirjaudu sisään.', 409);
    }
    request.log.info({ userId: user.id }, 'user registered');
    return showConsent(reply, oauth, q, metadata, user);
  });

  if (oidc) mountOidcSignIn();

  /**
   * Single sign-on with the external OIDC provider. The provider only authenticates the user;
   * the result continues to the same consent step as a password sign-in.
   */
  function mountOidcSignIn() {
    const cfg = oidc!;
    const rp = new OidcRelyingParty(cfg, issuer + '/oidc/callback');
    const oidcLimiter = new RateLimiter({ limit: 30, windowMs: 15 * 60_000 });
    const secureCookie = cfg.production || issuer.startsWith('https:');
    const cookie = (value: string, maxAge: number) =>
      `${OIDC_COOKIE}=${value}; Path=/oidc; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secureCookie ? '; Secure' : ''}`;
    const stateHash = (state: string) => createHash('sha256').update(state).digest('base64url');
    const failure = (reply: FastifyReply, message: string, status = 400) =>
      sendHtml(reply, errorPage('Kertakirjautuminen epäonnistui', message + ' Palaa MCP-sovellukseen ja yritä uudelleen.'), [], status);

    app.get('/oidc/login', async (request, reply) => {
      const oauth = (request.query as Record<string, string | undefined>).oauth;
      // This server has no web UI of its own: a sign-in always continues an MCP authorization request.
      if (!oauth) return sendHtml(reply, errorPage('Virheellinen valtuutuspyyntö'), [], 400);
      if (!oidcLimiter.allow(clientIp(request))) return failure(reply, 'Liian monta kirjautumisyritystä. Yritä myöhemmin uudelleen.', 429);
      oidcLimiter.hit(clientIp(request));
      try {
        await validateRequest(decodeOAuth(oauth));
      } catch {
        return sendHtml(reply, errorPage('Virheellinen valtuutuspyyntö'), [], 400);
      }
      let start;
      try {
        start = await rp.start();
      } catch (err) {
        request.log.error({ err: (err as Error).message }, 'oidc discovery failed');
        return failure(reply, 'Kirjautumispalveluun ei saatu yhteyttä.', 502);
      }
      authStore.saveOidcState({
        stateHash: stateHash(start.state),
        codeVerifier: start.codeVerifier,
        nonce: start.nonce,
        purpose: 'oauth',
        oauth,
        expires: Date.now() + OIDC_STATE_TTL_MS,
      });
      return reply.header('Set-Cookie', cookie(start.state, OIDC_STATE_TTL_MS / 1000)).header('Cache-Control', 'no-store').redirect(start.url.toString());
    });

    app.get('/oidc/callback', async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const cookieState = readCookie(request.headers.cookie, OIDC_COOKIE);
      reply.header('Set-Cookie', cookie('', 0));

      if (query.error) {
        request.log.warn({ error: String(query.error).slice(0, 100) }, 'oidc provider returned an error');
        if (query.state && cookieState === query.state) authStore.consumeOidcState(stateHash(query.state));
        return failure(reply, 'Kirjautumispalvelu ei hyväksynyt kirjautumista.');
      }
      // Login CSRF: the state must come back to the browser that started the sign-in
      if (!query.state || !cookieState || cookieState !== query.state) {
        request.log.warn('oidc callback state does not match the cookie');
        return failure(reply, 'Kirjautumisen tila ei täsmää.');
      }
      const pending = authStore.consumeOidcState(stateHash(query.state));
      if (!pending) {
        request.log.warn('oidc callback with an unknown, used or expired state');
        return failure(reply, 'Kirjautuminen on vanhentunut tai jo käytetty.');
      }

      let claims: OidcClaims;
      try {
        const rawQuery = request.raw.url?.split('?')[1] ?? '';
        claims = await rp.finish(rawQuery, { state: query.state, nonce: pending.nonce, codeVerifier: pending.codeVerifier });
      } catch (err) {
        request.log.warn({ err: (err as Error).message }, 'oidc code exchange failed');
        return failure(reply, 'Kirjautumista ei voitu vahvistaa.');
      }

      const user = findOrCreateOidcUser(claims, request);
      if (!user) {
        request.log.info('oidc sign-in without a local account');
        return failure(reply, 'Tällä kirjautumisella ei ole tunnusta. Pyydä ylläpitäjää luomaan tunnus.', 403);
      }
      request.log.info({ userId: user.id }, 'oidc sign-in');

      let q: Record<string, string | undefined>;
      let metadata: CimdMetadata;
      try {
        ({ q, metadata } = await parseOAuth({ oauth: pending.oauth }));
      } catch {
        return sendHtml(reply, errorPage('Virheellinen valtuutuspyyntö'), [], 400);
      }
      return showConsent(reply, pending.oauth, q, metadata, user);
    });

    /** Identity → local user: linked identity, then verified e-mail, then (optionally) a new account. */
    function findOrCreateOidcUser(claims: OidcClaims, request: FastifyRequest): McpUser | undefined {
      const linkedId = users.getUserIdByOidcIdentity(cfg.issuer, claims.sub);
      if (linkedId) {
        const linked = users.getUser(linkedId);
        if (linked) {
          users.touchOidcIdentity(cfg.issuer, claims.sub);
          return linked;
        }
        users.unlinkOidcIdentity(cfg.issuer, claims.sub); // the user was deleted
      }

      const trustedEmail = claims.email && (claims.emailVerified || cfg.trustEmail) ? claims.email.toLowerCase() : undefined;
      if (trustedEmail) {
        const existing = users.getUserByEmail(trustedEmail);
        if (existing) {
          users.linkOidcIdentity(cfg.issuer, claims.sub, existing.id);
          request.log.info({ userId: existing.id }, 'oidc identity linked by e-mail');
          return existing;
        }
      }

      if (!cfg.createUsers) return undefined;
      const user: McpUser = {
        id: randomUUID(),
        name: (claims.name ?? claims.preferredUsername ?? claims.email ?? claims.sub).slice(0, 100),
        ...(trustedEmail ? { email: trustedEmail } : {}),
        createdAt: Date.now(),
      };
      try {
        users.createUser(user);
      } catch {
        return undefined; // a concurrent sign-in created the e-mail first
      }
      users.linkOidcIdentity(cfg.issuer, claims.sub, user.id);
      request.log.info({ userId: user.id }, 'user created from oidc sign-in');
      return user;
    }
  }

  app.post('/oauth/token', async (request, reply) => {
    const b = request.body as Record<string,string|undefined>;
    reply.header('Cache-Control', 'no-store'); // RFC 6749 §5.1

    if (b.grant_type === 'authorization_code') {
      const code = b.code ? authStore.consumeAuthorizationCode(b.code) : undefined;
      if (!code || b.client_id !== code.clientId || b.redirect_uri !== code.redirectUri || !b.code_verifier || !verifyS256(b.code_verifier,code.challenge)) {
        return reply.code(400).send({error:'invalid_grant'});
      }
      const access = await issueAccessToken(secret,issuer,resource,code.subject,code.clientId,code.scope);
      const refreshToken = randomToken();
      authStore.saveRefreshToken({token:refreshToken,clientId:code.clientId,subject:code.subject,scope:code.scope,expires:Date.now()+30*86_400_000});
      return {access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refreshToken,scope:code.scope};
    }

    if (b.grant_type === 'refresh_token') {
      const refreshToken = b.refresh_token ? authStore.getRefreshToken(b.refresh_token) : undefined;
      if (!refreshToken || b.client_id !== refreshToken.clientId) return reply.code(400).send({error:'invalid_grant'});
      // A deleted user keeps no access through old refresh tokens
      if (!users.getUser(refreshToken.subject)) return reply.code(400).send({error:'invalid_grant'});
      const access = await issueAccessToken(secret,issuer,resource,refreshToken.subject,refreshToken.clientId,refreshToken.scope);
      return {access_token:access,token_type:'Bearer',expires_in:3600,scope:refreshToken.scope};
    }

    return reply.code(400).send({error:'unsupported_grant_type'});
  });
}
