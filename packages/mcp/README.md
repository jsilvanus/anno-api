# Kirkkovuosi MCP

MCP server for the church year of the Evangelical-Lutheran Church of Finland. It answers from `@anno-api/core` in-process: dates of holy days, readings of the three-year lectionary, psalms, prayers, hymns, liturgical colours, propers and rubrics. Tools and configuration: [`docs/mcp.md`](../../docs/mcp.md).

Built from the Codestash scaffold `mcp/api-connector-style` (jsilvanus/codestash). The church year logic is in `src/connector.ts` and the tools in `src/mcp/server.ts`; OAuth, CIMD, storage and transport follow the scaffold. Changes to the shared plumbing made here are listed in `LEARNED.md`.

## Differences from the scaffold

- `src/connector.ts` — `KirkkovuosiConnector` calls `@anno-api/core` directly (no external API)
- `src/mcp/server.ts` — church year tools, server instructions, read-only tool annotations
- `src/app.ts` — `buildApp()` builds the Fastify app; `src/server.ts` reads the environment and listens (the tests use `buildApp()`)
- `src/oauth/authorization-server.ts` — registration form on the sign-in page (`POST /oauth/register`), a signed login ticket between sign-in and consent, per-IP rate limiting, Finnish pages, refresh tokens of deleted users are refused
- The bootstrap account is optional (`MCP_DEFAULT_USER_EMAIL` + `MCP_DEFAULT_USER_PASSWORD`), since users can register

## Modern baseline

- MCP Streamable HTTP
- stateless request handling
- OAuth authorization code + PKCE S256
- issuer- and MCP-resource-bound JWT access tokens
- refresh tokens
- **CIMD-first client identification**
- OAuth Protected Resource Metadata (at `/.well-known/oauth-protected-resource/mcp` and the root)
- `/mcp` answers requests without a valid token with 401 + `WWW-Authenticate` (`requireAuth`, default on)
- OAuth Authorization Server Metadata
- embedded authorization server
- Content-Security-Policy on the OAuth pages whose `form-action` allows the client's redirect (see `LEARNED.md`)

CIMD is the normal client-registration mechanism. Dynamic Client Registration is intentionally not part of the default scaffold.

## Start

    cp .env.example .env    # set MCP_PUBLIC_URL and JWT_SECRET (openssl rand -base64 48)
    npm install             # in the repository root (npm workspaces)
    npm run build
    npm start

The embedded authorization server has a SQLite-backed user store, password sign-in and registration on the same page, a consent screen, authorization-code + PKCE handling, and durable token/code storage.

    npm test                # OAuth + registration + MCP end-to-end tests

## Architecture

    MCP client
        |
        | Streamable HTTP + Bearer token
        v
    MCP resource server
        |
        +---- OAuth discovery
        |
        +---- embedded OAuth authorization server
        |       CIMD -> authorize -> PKCE -> token
        |
        v
    connector.ts
        |
        v
    External API

The connector should not know about OAuth or MCP transport details.

See `LEARNED.md` for the design decisions and client quirks learned from ptv-mcp and farcmd-mcp. Read it before changing the OAuth plumbing.

### Persistence

The scaffold uses a local SQLite file by default. OAuth authorization codes and refresh tokens survive process restarts without requiring a database server.

Set `STORAGE_PATH` to change the database location:

```env
STORAGE_PATH=./data/app.sqlite
```

The storage API is deliberately small and lives under `src/storage/`. A future Postgres implementation can replace `SqliteAuthStore` without changing the MCP or connector layers. The SQLite file is gitignored.


### MCP user CRUD

The scaffold includes a small development/admin CLI using the same SQLite database:

    npm run user -- create --name "Demo User" --email "demo@example.com" --password "change-me"
    npm run user -- list
    npm run user -- get <id>
    npm run user -- update <id> --name "New Name" --email "new@example.com" --password "new-secret"
    npm run user -- delete <id>

Passwords are stored as Argon2id hashes and are never printed by the CLI.

When MCP_DEFAULT_USER_EMAIL and MCP_DEFAULT_USER_PASSWORD are set, that account is created on first start. Otherwise users register on the sign-in page. The OAuth flow is:

    MCP client
        |
        | authorization request
        v
    /oauth/authorize
        |
        +--> sign-in (email + password)  or  register (/oauth/register)
        |
        +--> consent (approve / deny)
        |
        +--> authorization code
        |
        v
    /oauth/token


## Development continuation

This scaffold is intended to be copied into a new MCP connector project. The normal development loop is:

1. Copy this directory into a new connector location.
2. Implement the external API calls in `src/connector.ts`.
3. Adjust the connector-specific MCP tools in `src/mcp/server.ts`.
4. Configure `.env`, especially `MCP_PUBLIC_URL`, `JWT_SECRET`, and the default user credentials.
5. Run `npm install`, then `npm run build` and `npm run dev`.
6. Exercise the OAuth flow with a real MCP client and verify that the authenticated user's ID and bearer token reach the connector through `ConnectorContext`.

Keep the generic OAuth, CIMD, persistence, and HTTP/MCP plumbing unchanged unless the connector has a concrete reason to diverge. Connector-specific behavior should stay in `connector.ts` and the MCP tool definitions.

## Production hardening still required

The included user management and login flow is deliberately a small scaffold, not a complete identity-management system. Before exposing it to production users, add the user/account controls appropriate to the deployment, including:

- password reset and account recovery
- email verification, if email is used as an account identifier
- password-change flow for authenticated users
- account disable/enable and other administrative lifecycle controls
- login/session abuse protection, such as rate limiting and brute-force protection
- secure session handling if browser login sessions are introduced
- CSRF protection for browser-based state-changing endpoints
- audit logging for authentication, authorization, and user administration
- appropriate password policy and credential handling
- secret rotation and secure secret storage
- refresh-token revocation/rotation and logout semantics
- protection against stale/deleted users retaining access through existing tokens
- a real production identity/bootstrap process instead of relying on the demo account environment variables

The current CRUD CLI is a development/admin primitive. It intentionally does not attempt to become a general-purpose identity-management interface.

The default OAuth login and consent pages are also intentionally minimal. Replace their presentation and, where necessary, their surrounding account/session flow with the host application's production UX and security controls.

## Suggested first production step

Do not expand the scaffold into a large authentication framework prematurely. First use the scaffold with one real connector and validate the complete flow:

`CIMD client → OAuth login → consent → PKCE token exchange → /mcp → connector`.

Then add only the identity and account-management features that the target deployment actually requires.
