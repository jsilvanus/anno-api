/**
 * A small OpenID provider for tests: discovery, JWKS, authorize (302 back with code + state),
 * token (PKCE + client_secret_basic checked, RS256 ID token) and userinfo.
 * `nextUser` is the identity the next /authorize call signs in.
 */

import { createServer, type Server } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';

export interface FakeUser {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  /** Leave e-mail out of the ID token so the client has to call userinfo. */
  emailOnlyInUserinfo?: boolean;
}

interface Grant {
  user: FakeUser;
  clientId: string;
  redirectUri: string;
  nonce: string | undefined;
  challenge: string | undefined;
}

export interface FakeOidcProvider {
  issuer: string;
  clientId: string;
  clientSecret: string;
  nextUser: FakeUser;
  close(): Promise<void>;
}

export async function startFakeOidcProvider(): Promise<FakeOidcProvider> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const codes = new Map<string, Grant>();
  const accessTokens = new Map<string, FakeUser>();
  let issuer = '';

  const provider: FakeOidcProvider = {
    issuer: '',
    clientId: 'kirkkovuosi-mcp',
    clientSecret: 'client-secret',
    nextUser: { sub: 'user-1' },
    close: () => new Promise(resolve => server.close(() => resolve())),
  };

  const json = (res: import('node:http').ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  const readBody = (req: import('node:http').IncomingMessage) => new Promise<string>(resolve => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
  });

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', issuer);
    const path = url.pathname.slice(new URL(issuer).pathname.length - 1);

    if (path === '/.well-known/openid-configuration') {
      return json(res, 200, {
        issuer,
        authorization_endpoint: issuer + 'authorize',
        token_endpoint: issuer + 'token',
        userinfo_endpoint: issuer + 'userinfo',
        jwks_uri: issuer + 'jwks',
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
      });
    }
    if (path === '/jwks') return json(res, 200, { keys: [jwk] });

    if (path === '/authorize') {
      const p = url.searchParams;
      const redirectUri = p.get('redirect_uri')!;
      const code = randomBytes(16).toString('base64url');
      codes.set(code, {
        user: provider.nextUser,
        clientId: p.get('client_id')!,
        redirectUri,
        nonce: p.get('nonce') ?? undefined,
        challenge: p.get('code_challenge') ?? undefined,
      });
      const target = new URL(redirectUri);
      target.searchParams.set('code', code);
      target.searchParams.set('state', p.get('state') ?? '');
      res.writeHead(302, { location: target.toString() });
      return res.end();
    }

    if (path === '/token' && req.method === 'POST') {
      const form = new URLSearchParams(await readBody(req));
      // client_secret_basic: form-urlencoded id and secret (RFC 6749 §2.3.1), then base64
      const [id, secret] = Buffer.from((req.headers.authorization ?? '').replace(/^Basic /, ''), 'base64').toString().split(':')
        .map(part => decodeURIComponent(part.replaceAll('+', ' ')));
      if (id !== provider.clientId || secret !== provider.clientSecret) return json(res, 401, { error: 'invalid_client' });
      const grant = codes.get(form.get('code') ?? '');
      codes.delete(form.get('code') ?? '');
      const verifier = form.get('code_verifier') ?? '';
      if (!grant || grant.redirectUri !== form.get('redirect_uri') ||
          createHash('sha256').update(verifier).digest('base64url') !== grant.challenge) {
        return json(res, 400, { error: 'invalid_grant' });
      }
      const { emailOnlyInUserinfo, ...user } = grant.user;
      const idClaims: Record<string, unknown> = { ...user };
      if (emailOnlyInUserinfo) { delete idClaims.email; delete idClaims.email_verified; }
      if (grant.nonce) idClaims.nonce = grant.nonce;
      const idToken = await new SignJWT(idClaims)
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setAudience(grant.clientId)
        .setSubject(user.sub)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey as CryptoKey);
      const accessToken = randomBytes(16).toString('base64url');
      accessTokens.set(accessToken, grant.user);
      return json(res, 200, { access_token: accessToken, token_type: 'Bearer', expires_in: 300, id_token: idToken });
    }

    if (path === '/userinfo') {
      const user = accessTokens.get((req.headers.authorization ?? '').replace(/^Bearer /, ''));
      if (!user) return json(res, 401, { error: 'invalid_token' });
      const { emailOnlyInUserinfo: _, ...claims } = user;
      return json(res, 200, claims);
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  // Like authentik: an application path and a trailing slash
  issuer = `http://127.0.0.1:${port}/application/o/kirkkovuosi/`;
  provider.issuer = issuer;
  return provider;
}
