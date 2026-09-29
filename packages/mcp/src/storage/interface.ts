export interface AuthorizationCodeRecord {
  code: string;
  clientId: string;
  redirectUri: string;
  challenge: string;
  subject: string;
  scope: string;
  expires: number;
}

export interface RefreshTokenRecord {
  token: string;
  clientId: string;
  subject: string;
  scope: string;
  expires: number;
}

/** A pending OIDC sign-in (between /oidc/login and /oidc/callback), stored under SHA-256(state). */
export interface OidcStateRecord {
  stateHash: string;
  codeVerifier: string;
  nonce: string;
  purpose: 'oauth';
  /** The encoded MCP authorization request the sign-in continues. */
  oauth: string;
  expires: number;
}

export interface AuthStore {
  saveAuthorizationCode(record: AuthorizationCodeRecord): void;
  consumeAuthorizationCode(code: string): AuthorizationCodeRecord | undefined;
  saveRefreshToken(record: RefreshTokenRecord): void;
  getRefreshToken(token: string): RefreshTokenRecord | undefined;
  /** Saves a pending OIDC sign-in and deletes expired ones. */
  saveOidcState(record: OidcStateRecord): void;
  /** Returns and deletes a pending OIDC sign-in (single use); undefined when unknown or expired. */
  consumeOidcState(stateHash: string): OidcStateRecord | undefined;
}

export interface McpUser {
  id: string;
  name: string;
  email?: string;
  passwordHash?: string;
  createdAt: number;
}

export interface UserStore {
  createUser(user: McpUser): void;
  listUsers(): McpUser[];
  getUser(id: string): McpUser | undefined;
  getUserByEmail(email: string): McpUser | undefined;
  updateUser(id: string, patch: { name?: string; email?: string; passwordHash?: string }): McpUser | undefined;
  deleteUser(id: string): boolean;
  /** The user linked to an OIDC identity (issuer + subject). */
  getUserIdByOidcIdentity(issuer: string, subject: string): string | undefined;
  linkOidcIdentity(issuer: string, subject: string, userId: string): void;
  unlinkOidcIdentity(issuer: string, subject: string): void;
  touchOidcIdentity(issuer: string, subject: string): void;
}
