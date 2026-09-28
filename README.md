# anno-api — Kirkkovuosi

The church year of the Evangelical-Lutheran Church of Finland as a REST API and an MCP server.

For any date: the holy day (or, on a weekday, the Sunday whose material is used), season and period, year cycle, the readings of the three-year lectionary with full texts, psalm, hallelujah verse or Lent psalm verse, prayers, hymns, liturgical colour and altar candles, propers (preface, Kyrie litany, psalm refrain, post-communion prayer), the seasonal rubrics of the Mass, and the weekly lectionary's prayer-hour texts for every day.

Sources: Evankeliumikirja (2021), Jumalanpalvelusten kirja (2000) and the weekly lectionary index. The generated calendar is tested against the ELCF's official *perikooppikalenterit* for church years 2021–2029.

## Packages

| Package | Description |
|---|---|
| [`packages/core`](packages/core) — `@anno-api/core` | Calendar computation, date resolution and the data. Zero dependencies. |
| [`packages/api`](packages/api) — `@anno-api/api` | REST API, zero-dependency HTTP server. [Endpoints](docs/README.md) |
| [`packages/mcp`](packages/mcp) — `@anno-api/mcp` | MCP server (Streamable HTTP) with an embedded OAuth server; sign-in and registration on the OAuth page. [Tools](docs/mcp.md) |
| [`packages/kirkkovuosi-mcp`](packages/kirkkovuosi-mcp) — `@anno-api/kirkkovuosi-mcp` | MCP server wrapping the live API of kirkkovuosikalenteri.fi (Finnish and Swedish). [Tools](packages/kirkkovuosi-mcp/README.md) |

For an AI without these servers, [`.claude/skills/kirkkovuosikalenteri-api/SKILL.md`](.claude/skills/kirkkovuosikalenteri-api/SKILL.md) is an instruction for using kirkkovuosikalenteri.fi's public API directly: endpoints, date format, coverage and every field of the response. It works as a Claude Code skill or pasted into any system prompt.

## Quick start

```bash
npm install
npm start            # REST API on port 3000 (or $PORT)
npm run dev          # REST API with --watch
npm test             # all packages

npm run build        # compile the MCP server
npm run start:mcp    # MCP server (configure packages/mcp/.env first)
```

Node.js 22.5 or newer.

## REST API

All responses are JSON; no authentication.

| Endpoint | Description |
|---|---|
| `GET /api/v1/today` | Everything for today (Finnish time); `?cycles=false` omits the other year cycles |
| `GET /api/v1/date/:date` | Everything for a date (`YYYY-MM-DD`) |
| `GET /api/v1/{today,date/:date}/texts` | Readings, psalm and hallelujah verse (`?cycle=1\|2\|3`) |
| `GET /api/v1/{today,date/:date}/prayer` | A prayer of the day (`?n=`, `?all=true`) |
| `GET /api/v1/{today,date/:date}/gospel` | Gospel |
| `GET /api/v1/{today,date/:date}/propers` | Propers and rubrics |
| `GET /api/v1/{today,date/:date}/color` | Liturgical colour |
| `GET /api/v1/{today,date/:date}/liturgy` | Rubrics: Gloria, Hallelujah, Gloria Patri |
| `GET /api/v1/{today,date/:date}/lectionary` | Weekly lectionary: morning, midday and evening prayer texts |
| `GET /api/v1/holy-day/:slug` | One holy day (`?cycle=`, `?year=`, `?raw=true`) |
| `GET /api/v1/year/:year/calendar` | Church year starting at Advent of `:year` |
| `GET /api/v1/days` | All holy days |
| `GET /api/v1/periods` | Period introductions |
| `GET /api/v1/search/text?q=Matt.+21` | Search readings by Bible reference |
| `GET /api/v1/propers/…` | `prefaatiot`, `kyrie-litaniat`, `synninpaastot`, `kiitosrukoukset`, `kiitosrukoukset-ehtoollinen`, `kertosaakeet`, `improperia` |
| `GET /api/v1/lectionary…` | Weekly lectionary index: metadata, `holy-days`, `by-holy-day?q=`, `search?q=` |

The response structure is documented in [docs/day-response.md](docs/day-response.md); every endpoint has its own page under [docs/](docs/README.md).

## MCP server

Connect an MCP client to `https://<your host>/mcp`. On first use the client opens the server's OAuth page, where the user signs in or creates an account. Tools: `church_day`, `daily_lectionary`, `holy_day`, `upcoming_holy_days`, `church_year_calendar`, `list_holy_days`, `church_year_periods`, `search_bible_reference`, `liturgical_texts`. See [docs/mcp.md](docs/mcp.md).

## Project structure

```
anno-api/
├── package.json                npm workspaces
├── docs/                       endpoint and MCP documentation
├── refs/                       source documents (see CLAUDE.md)
└── packages/
    ├── core/
    │   ├── src/                computus, resolver, propers, colors, rules, lectionary, search
    │   ├── data/               all-days.json, propers.json, periods.json, lectionary-index.json
    │   ├── parsers/            scripts that generate data/ from refs/
    │   └── test/               incl. fixtures/perikooppikalenterit.json
    ├── api/
    │   ├── src/                index.js (server), routes.js
    │   └── test/
    └── mcp/                    from the Codestash api-connector-style scaffold
        ├── src/                connector.ts, mcp/, oauth/, storage/
        └── test/
```

## Sources

| Data | Source |
|---|---|
| Readings, psalms, prayers, hymns, colours | Evankeliumikirja (Kirkkokäsikirja II, uudistettu painos 2021) |
| Propers and rubrics | Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000) |
| Weekly lectionary index | Viikkolektionaarin raamatunkohdat |
| Weekly lectionary texts, altar candles | Kirkkovuosikalenteri (kirkkovuosikalenteri.fi), © Kirkkohallitus |
| Dated calendars (test ground truth) | Perikooppikalenterit 2021–2029, evl.fi |
| Easter | Anonymous Gregorian algorithm (Meeus/Jones/Butcher) |
