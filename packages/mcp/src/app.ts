import Fastify, { type FastifyInstance } from 'fastify';
import formbody from '@fastify/formbody';
import { KirkkovuosiConnector } from './connector.js';
import { mountMcpHttp } from './mcp/http.js';
import { mountOAuthMetadata } from './oauth-metadata.js';
import { mountAuthorizationServer, type AuthorizationServerOptions } from './oauth/authorization-server.js';
import type { AuthStore, UserStore } from './storage/interface.js';

export interface AppOptions {
  publicUrl: string;
  jwtSecret: Uint8Array;
  store: AuthStore;
  users: UserStore;
  authorization?: AuthorizationServerOptions;
  logger?: boolean;
  /** Fastify trustProxy: set to the reverse proxy's address so request.ip is the client's. */
  trustProxy?: boolean | string | string[];
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true, trustProxy: options.trustProxy ?? false });
  await app.register(formbody);

  const resource = options.publicUrl + '/mcp';
  await mountOAuthMetadata(app, options.publicUrl);
  await mountAuthorizationServer(app, options.publicUrl, resource, options.jwtSecret, options.store, options.users, options.authorization);
  await mountMcpHttp(app, {
    connector: new KirkkovuosiConnector(),
    publicUrl: options.publicUrl,
    jwtSecret: options.jwtSecret,
    resource,
  });

  app.get('/health', async () => ({ ok: true }));
  return app;
}
