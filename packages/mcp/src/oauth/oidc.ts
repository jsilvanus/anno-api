import * as client from 'openid-client';

/**
 * OpenID Connect sign-in: this server is a Relying Party of an external identity provider (e.g. authentik).
 * It never issues ID tokens itself; the MCP access tokens stay its own (see authorization-server.ts).
 */
export interface OidcConfig {
  /** Issuer URL exactly as the provider publishes it (authentik keeps a trailing slash). */
  issuer: string;
  clientId: string;
  /** Set = confidential client (client_secret_basic); unset = public client. PKCE is always used. */
  clientSecret?: string;
  scopes: string;
  buttonLabel: string;
  /** Create a local account for a provider user who has none. */
  createUsers: boolean;
  /** Link to an existing account by e-mail even when email_verified is not true. */
  trustEmail: boolean;
  /** Production: https issuer required, Secure cookie. */
  production: boolean;
}

export const DEFAULT_OIDC_SCOPES = 'openid email profile';
export const DEFAULT_OIDC_BUTTON_LABEL = 'Kirjaudu kertakirjautumisella';

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  const v = (value ?? '').trim().toLowerCase();
  if (v === '') return fallback;
  if (v === 'true') return true;
  if (v === 'false') return false;
  throw new Error(`${name} must be true or false, got: ${value}`);
}

/**
 * Reads the OIDC_* variables. Returns undefined when OIDC_ISSUER is unset or empty (OIDC is off).
 * Throws a descriptive error for an invalid configuration, so the server refuses to start.
 */
export function parseOidcConfig(env: Record<string, string | undefined>): OidcConfig | undefined {
  const issuer = (env.OIDC_ISSUER ?? '').trim();
  if (!issuer) return undefined;
  const production = env.NODE_ENV === 'production';

  let url: URL;
  try {
    url = new URL(issuer);
  } catch {
    throw new Error('OIDC_ISSUER must be an absolute URL: ' + issuer);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('OIDC_ISSUER must be an http(s) URL: ' + issuer);
  if (production && url.protocol !== 'https:') throw new Error('OIDC_ISSUER must use https in production');

  const clientId = (env.OIDC_CLIENT_ID ?? '').trim();
  if (!clientId) throw new Error('OIDC_CLIENT_ID is required when OIDC_ISSUER is set');

  const scopes = (env.OIDC_SCOPES ?? '').trim().split(/\s+/).filter(Boolean).join(' ') || DEFAULT_OIDC_SCOPES;
  if (!scopes.split(' ').includes('openid')) throw new Error('OIDC_SCOPES must contain openid');

  const clientSecret = env.OIDC_CLIENT_SECRET?.trim();
  return {
    issuer,
    clientId,
    ...(clientSecret ? { clientSecret } : {}),
    scopes,
    buttonLabel: (env.OIDC_BUTTON_LABEL ?? '').trim() || DEFAULT_OIDC_BUTTON_LABEL,
    createUsers: parseBoolean('OIDC_CREATE_USERS', env.OIDC_CREATE_USERS, false),
    trustEmail: parseBoolean('OIDC_TRUST_EMAIL', env.OIDC_TRUST_EMAIL, false),
    production,
  };
}

export interface OidcStart {
  url: URL;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface OidcClaims {
  sub: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  preferredUsername?: string;
}

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

export class OidcRelyingParty {
  private discovered: Promise<client.Configuration> | undefined;

  constructor(readonly config: OidcConfig, readonly redirectUri: string) {}

  /** Discovery runs on first use and is cached; a failure is not cached, so a later request retries. */
  private configuration(): Promise<client.Configuration> {
    if (!this.discovered) {
      const insecure = new URL(this.config.issuer).protocol === 'http:' && !this.config.production;
      this.discovered = client.discovery(
        new URL(this.config.issuer),
        this.config.clientId,
        undefined,
        this.config.clientSecret ? client.ClientSecretBasic(this.config.clientSecret) : client.None(),
        insecure ? { execute: [client.allowInsecureRequests] } : undefined,
      );
      this.discovered.catch(() => { this.discovered = undefined; });
    }
    return this.discovered;
  }

  async start(): Promise<OidcStart> {
    const configuration = await this.configuration();
    const codeVerifier = client.randomPKCECodeVerifier();
    const state = client.randomState();
    const nonce = client.randomNonce();
    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri,
      scope: this.config.scopes,
      code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { url, state, nonce, codeVerifier };
  }

  /** Exchanges the code (PKCE, state and nonce checked) and returns the identity claims. */
  async finish(query: string, checks: { state: string; nonce: string; codeVerifier: string }): Promise<OidcClaims> {
    const configuration = await this.configuration();
    const currentUrl = new URL(this.redirectUri);
    currentUrl.search = query;
    const tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    });
    const idClaims = tokens.claims();
    if (!idClaims) throw new Error('ID token missing');
    let claims: Record<string, unknown> = idClaims;
    if (!str(idClaims.email)) {
      const userinfo = await client.fetchUserInfo(configuration, tokens.access_token, idClaims.sub);
      claims = { ...userinfo, ...idClaims, email: userinfo.email, email_verified: userinfo.email_verified };
    }
    const email = str(claims.email);
    const name = str(claims.name);
    const preferredUsername = str(claims.preferred_username);
    return {
      sub: idClaims.sub,
      ...(email ? { email } : {}),
      emailVerified: claims.email_verified === true,
      ...(name ? { name } : {}),
      ...(preferredUsername ? { preferredUsername } : {}),
    };
  }
}
