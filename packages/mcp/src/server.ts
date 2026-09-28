import { hash } from '@node-rs/argon2';
import { buildApp } from './app.js';
import { SqliteAuthStore, SqliteUserStore } from './storage/sqlite.js';

const port = Number(process.env.PORT ?? '5999');
const publicUrl = process.env.MCP_PUBLIC_URL ?? ('http://localhost:' + port);
const secretText = process.env.JWT_SECRET;

if (!Number.isInteger(port) || port <= 0) throw new Error('Invalid PORT: ' + process.env.PORT);
if (!secretText) throw new Error('JWT_SECRET is required');

const secret = Buffer.from(secretText, 'base64');
if (secret.length < 32) throw new Error('JWT_SECRET must decode to at least 32 bytes');

const storagePath = process.env.STORAGE_PATH ?? './data/app.sqlite';
const store = new SqliteAuthStore(storagePath);
const users = new SqliteUserStore(store.getDatabase());

// Optional bootstrap account (users can also register on the sign-in page)
const defaultUserEmail = process.env.MCP_DEFAULT_USER_EMAIL;
const defaultUserPassword = process.env.MCP_DEFAULT_USER_PASSWORD;
const defaultUserId = process.env.MCP_DEFAULT_USER_ID ?? 'admin';
if (defaultUserEmail && defaultUserPassword && !users.getUser(defaultUserId) && !users.getUserByEmail(defaultUserEmail)) {
  users.createUser({ id: defaultUserId, name: process.env.MCP_DEFAULT_USER_NAME ?? defaultUserEmail, email: defaultUserEmail.toLowerCase(), passwordHash: await hash(defaultUserPassword, { algorithm: 2 }), createdAt: Date.now() });
}

const list = (value: string | undefined) => (value ?? '').split(',').map(s => s.trim()).filter(Boolean);
const trustProxy = process.env.TRUST_PROXY;

const app = await buildApp({
  publicUrl,
  jwtSecret: secret,
  store,
  users,
  authorization: {
    registration: {
      enabled: (process.env.MCP_REGISTRATION ?? 'open') !== 'closed',
      allowedEmailDomains: list(process.env.MCP_REGISTRATION_EMAIL_DOMAINS),
      ...(process.env.MCP_MIN_PASSWORD_LENGTH ? { minPasswordLength: Number(process.env.MCP_MIN_PASSWORD_LENGTH) } : {}),
    },
  },
  ...(trustProxy ? { trustProxy: trustProxy === 'true' ? true : list(trustProxy) } : {}),
});

await app.listen({
  host: process.env.HOST ?? '0.0.0.0',
  port,
});
