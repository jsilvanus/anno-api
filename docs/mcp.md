# Kirkkovuosi MCP server

`packages/mcp` serves the church year to MCP clients (Claude, ChatGPT, Cursor, …) over Streamable HTTP at `/mcp`. Clients sign in with OAuth 2.1 (authorization code + PKCE, CIMD client identification) on the server's own sign-in page, where new users can also register. That page is the only web UI.

## Tools

All tools are read-only.

| Tool | Arguments | Returns |
|---|---|---|
| `church_day` | `date?`, `include_texts?` | The [day response](day-response.md) for a date (default: today in Finland). `include_texts: false` returns references only. |
| `daily_lectionary` | `date?` | The weekly lectionary for a date with full texts: morning, midday and evening prayer, day's psalm, first and second vespers, week's psalm and apocrypha, for every day and service on the date |
| `holy_day` | `name`, `year_cycle?`, `church_year?`, `include_texts?` | One holy day by slug or Finnish/Latin name ("Laetare", "mikkelinpäivä") |
| `upcoming_holy_days` | `from?`, `count?` | The next Sundays, feasts and services |
| `church_year_calendar` | `start_year?` | Every dated day of a church year |
| `list_holy_days` | — | Names, slugs, themes and Latin names |
| `church_year_periods` | — | Period introductions |
| `search_bible_reference` | `query` | Where a passage is read (Evankeliumikirja and the weekly lectionary) |
| `liturgical_texts` | `kind` | Prefaatiot, Kyrie litanies, absolutions, thanksgiving prayers, post-communion prayers, psalm refrains, Improperia |

## Sign-in and registration

`GET /oauth/authorize` shows a sign-in form and, below it, a "Luo tunnus" (register) form. Registration asks for an e-mail address, an optional name and a password (twice), creates the account and continues straight to the consent step. Only the e-mail, the name and an Argon2id hash of the password are stored.

| Variable | Default | Description |
|---|---|---|
| `MCP_REGISTRATION` | `open` | `closed` hides the registration form and rejects registrations |
| `MCP_REGISTRATION_EMAIL_DOMAINS` | — | Comma-separated allowlist, e.g. `evl.fi,seurakunta.fi` |
| `MCP_MIN_PASSWORD_LENGTH` | `10` | Minimum password length |

Failed sign-ins are limited to 10 per 15 minutes and registrations to 5 per hour per IP address. Behind a reverse proxy, set `TRUST_PROXY` so the limits see client addresses.

## Single sign-on (OIDC)

The sign-in page can also offer single sign-on with an OpenID Connect provider such as authentik. The server is then an OIDC *Relying Party*: it sends the browser to the provider, receives the code at `/oidc/callback` and verifies the ID token (authorization code + PKCE, state and nonce). It does not become an OpenID provider itself: the `.well-known` metadata is unchanged, and the MCP access tokens are still its own. Password sign-in and registration keep working next to the button.

| Variable | Default | Description |
|---|---|---|
| `OIDC_ISSUER` | — | Issuer URL exactly as the provider publishes it (authentik: `https://auth.example.org/application/o/<slug>/`, with the trailing slash). **Unset or empty = OIDC is off**: no button, and `/oidc/*` answers 404. Must be `https` when `NODE_ENV=production`. |
| `OIDC_CLIENT_ID` | — | Required when `OIDC_ISSUER` is set |
| `OIDC_CLIENT_SECRET` | — | Set = confidential client (`client_secret_basic`); unset = public client. PKCE is always used. |
| `OIDC_SCOPES` | `openid email profile` | Must contain `openid` |
| `OIDC_BUTTON_LABEL` | `Kirjaudu kertakirjautumisella` | Button text |
| `OIDC_CREATE_USERS` | `false` | `true` creates an account (no password) for a provider user who has none |
| `OIDC_TRUST_EMAIL` | `false` | `true` links to an existing account by e-mail even when the provider does not say `email_verified: true` |

Invalid values (a relative issuer, a missing client id, scopes without `openid`, a boolean other than `true`/`false`) stop the server at startup. The provider's discovery document is fetched on the first sign-in, not at startup.

Flow: the button opens `/oidc/login?oauth=<the pending authorization request>`, which re-validates the request, stores the state, nonce and PKCE verifier in SQLite (`oidc_states`, keyed by the SHA-256 of the state, 10 minutes, single use), sets an `anno_oidc` cookie (HttpOnly, SameSite=Lax, Path=/oidc, Secure with an https public URL or in production) and redirects to the provider. `/oidc/callback` requires the cookie to match the returned state, then maps the identity to a local account:

1. an identity already linked to an account (`oidc_identities`: issuer + subject → user) signs in as that account;
2. otherwise an account with the same e-mail (case-insensitive) is linked, if the e-mail is verified (or `OIDC_TRUST_EMAIL=true`);
3. otherwise, with `OIDC_CREATE_USERS=true`, a new account is created and linked (name from `name`, `preferred_username` or the e-mail; the e-mail is stored only when it is trusted as in step 2);
4. otherwise the page says there is no account and to ask the administrator.

The user then sees the same consent page as after a password sign-in. The e-mail domain allowlist of registration does not apply to SSO: the provider's application policy decides who may sign in. Deleting an account (`npm run user -- delete`) also removes its links.

### authentik

1. *Applications → Providers → Create → OAuth2/OpenID Provider*: client type *Confidential*, redirect URI `<MCP_PUBLIC_URL>/oidc/callback` (strict), a signing key selected (so ID tokens are RS256), scopes `openid`, `email`, `profile`.
2. *Applications → Create*: an application using that provider; bind policies/groups to decide who may sign in.
3. Copy the *OpenID Configuration Issuer* from the provider page to `OIDC_ISSUER`, and the client ID and secret to `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET`.

Accounts can also be managed from the command line: `npm run user -w @anno-api/mcp -- list` (see `packages/mcp/README.md`).

## Running

```bash
cp packages/mcp/.env.example packages/mcp/.env   # set MCP_PUBLIC_URL and JWT_SECRET
npm install
npm run build
npm run start:mcp
```

Connect a client to `https://<MCP_PUBLIC_URL>/mcp`.
