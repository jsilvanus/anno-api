# anno-api — Kirkkovuosi API

REST API for the liturgical calendar of the Evangelical-Lutheran Church of Finland.

Provides church year dates, three-year lectionary readings, liturgical propers, and a full Bible text index from the Evankeliumikirja (2021) and weekly lectionary (viikkolektionaari).

## Quick start

```bash
npm start          # production
npm run dev        # auto-restart on file changes
npm test           # run test suite
```

Server listens on port 3000 by default. Set the `PORT` environment variable to change it.

## API overview

All responses are JSON. No authentication required.

### Church calendar

| Endpoint | Description |
|---|---|
| `GET /api/v1/today` | Full info for today |
| `GET /api/v1/today/texts` | Bible readings for today |
| `GET /api/v1/today/texts?cycle=2` | Readings for a specific year cycle (1–3) |
| `GET /api/v1/today/prayer` | Collect prayer for today |
| `GET /api/v1/today/prayer?n=2` | Specific prayer by number |
| `GET /api/v1/today/gospel` | Gospel reading for today |
| `GET /api/v1/today/propers` | Liturgical propers for today |
| `GET /api/v1/date/:date` | Info for a specific date (`YYYY-MM-DD`) |
| `GET /api/v1/date/:date/color` | Liturgical color for a date |
| `GET /api/v1/date/:date/propers` | Propers for a specific date |
| `GET /api/v1/holy-day/:slug` | Full data for a holy day by slug |
| `GET /api/v1/year/:year/calendar` | Church year calendar (entries + dates) |
| `GET /api/v1/days` | Index of all holy days |
| `GET /api/v1/search/text?q=Matt.21` | Search readings by Bible reference |

### Liturgical propers (Jumalanpalvelusten kirja, 2000)

| Endpoint | Description |
|---|---|
| `GET /api/v1/propers/prefaatiot` | Preface endings by season |
| `GET /api/v1/propers/kyrie-litaniat` | Seasonal Kyrie litanies |
| `GET /api/v1/propers/synninpaastot` | Absolution texts |
| `GET /api/v1/propers/kiitosrukoukset` | Thanksgiving prayers |
| `GET /api/v1/propers/kertosaakeet` | Seasonal psalm refrains |
| `GET /api/v1/propers/improperia` | Good Friday Improperia |

### Lectionary Bible index (viikkolektionaari)

Index of all Bible passages used in the Evankeliumikirja and weekly lectionary, cross-referenced to liturgical occasions.

| Endpoint | Description |
|---|---|
| `GET /api/v1/lectionary` | Index metadata and entry counts |
| `GET /api/v1/lectionary/holy-days` | All liturgical occasion names in the index |
| `GET /api/v1/lectionary/by-holy-day?q=pääsiäisyö` | All readings for a given holy day |
| `GET /api/v1/lectionary/search?q=Matt.+5` | Search entries by Bible book or reference |

## Example responses

### `GET /api/v1/today`

```json
{
  "date": "2026-02-27",
  "churchYear": {
    "start": 2025,
    "label": "2025–2026",
    "yearCycle": 1
  },
  "holyDay": {
    "name": "...",
    "slug": "...",
    "liturgicalColor": "vihreä",
    "texts": {
      "yearCycle": 1,
      "firstReading": { "reference": "...", "text": "..." },
      "secondReading": { "reference": "...", "text": "..." },
      "gospel": { "reference": "...", "text": "..." }
    },
    "prayers": ["..."],
    "propers": {
      "prefaatio": { "title": "...", "text": "..." },
      "kyrieLitania": { "...": "..." }
    }
  },
  "dayOfWeek": "perjantai",
  "season": "Helluntaijakso"
}
```

### `GET /api/v1/lectionary/search?q=Room.+8`

```json
{
  "query": "Room. 8",
  "count": 4,
  "results": [
    {
      "book": "Kirje roomalaisille",
      "abbreviation": "Room.",
      "section": "NT",
      "reference": "8:14–17",
      "occurrences": [
        {
          "holyDay": "helluntaipäivä",
          "context": null,
          "readingType": "2. vsk. 2. lukukappale"
        }
      ]
    }
  ]
}
```

## Project structure

```
anno-api/
├── package.json
├── viikkolektionaarin_raamatunkohdat.pdf   source PDF for lectionary index
└── src/
    ├── index.js            HTTP server and router
    ├── routes/
    │   └── api.js          Route definitions
    ├── services/
    │   ├── computus.js     Easter calculation and church calendar generation
    │   ├── resolver.js     Date → holy day resolution
    │   ├── propers.js      Liturgical propers lookup
    │   └── lectionary.js   Lectionary Bible index lookup
    ├── data/
    │   ├── all-days.json           Holy day data (Evankeliumikirja 2021)
    │   ├── propers.json            Propers data (Kirkkokäsikirja I, 2000)
    │   ├── index.json              Holy day index
    │   ├── lectionary-index.txt    Extracted PDF text
    │   └── lectionary-index.json   Parsed lectionary index (2073 entries)
    ├── tests/
    │   └── api.test.js     Test suite (30 tests)
    └── parsers/
        ├── parse-evankeliumikirja.js   Parses Evankeliumikirja markdown → JSON
        ├── parse-jpkirja.js            Parses Jumalanpalvelusten kirja → JSON
        └── parse-lectionary-index.js   Parses PDF text → lectionary-index.json
```

## Sources

| Data | Source |
|---|---|
| Lectionary readings | Evankeliumikirja (Kirkkokäsikirja II, 2021) |
| Liturgical propers | Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000) |
| Lectionary Bible index | Viikkolektionaarin raamatunkohdat (PDF) |
| Easter algorithm | Anonymous Gregorian algorithm (Meeus/Jones/Butcher) |

## Runtime

Node.js v18+. Zero external dependencies — uses only Node.js built-in modules (`http`, `fs`, `path`, `url`, `node:test`).
