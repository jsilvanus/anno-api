# Kirkkovuosi MCP server

`packages/mcp` serves the church year to MCP clients (Claude, ChatGPT, Cursor, …) over Streamable HTTP at `/mcp`. Clients sign in with OAuth 2.1 (authorization code + PKCE, CIMD client identification) on the server's own sign-in page, where new users can also register. That page is the only web UI.

## Tools

All tools are read-only.

| Tool | Arguments | Returns |
|---|---|---|
| `church_day` | `date?`, `include_texts?` | The [day response](day-response.md) for a date (default: today in Finland). `include_texts: false` returns references only. |
| `daily_lectionary` | `date?` | The weekly lectionary for a date with full texts: morning, midday and evening prayer, day's psalm, eve reading, week's psalm and apocrypha, for every day and service on the date |
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

Accounts can also be managed from the command line: `npm run user -w @anno-api/mcp -- list` (see `packages/mcp/README.md`).

## Running

```bash
cp packages/mcp/.env.example packages/mcp/.env   # set MCP_PUBLIC_URL and JWT_SECRET
npm install
npm run build
npm run start:mcp
```

Connect a client to `https://<MCP_PUBLIC_URL>/mcp`.
