# GET /api/v1/holy-day/:slug

Returns a holy day by its slug in the same shape as a `Day` in the [day response](day-response.md): theme, colour, readings of a year cycle (`texts`) and of all cycles (`allYearCycles`), psalm, hallelujah verse, prayers, hymns and propers, plus its date in the church year.

Query parameters: `?cycle=1|2|3` (default: the cycle of the church year), `?year=YYYY` (church year by its starting year; default: the current one), `?raw=true` (the unprocessed record from `all-days.json`, described below).

## Request

```
GET /api/v1/holy-day/:slug
```

### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `slug` | string | Holy day slug, e.g. `joulupaiva`, `paasiaispaiva`, `1-adventtisunnuntai` |

Use [`GET /api/v1/days`](days.md) to list all available slugs.

## Response fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Finnish name |
| `slug` | string | Slug identifier |
| `season` | string | Liturgical season (Finnish) |
| `period` | string | Liturgical period (Finnish) |
| `latinName` | string\|null | Latin name (e.g. `"Invocavit"`) |
| `liturgicalColor` | string | Liturgical color |
| `description` | string | Theological context and description |
| `yearCycles` | object | Readings for cycles `"1"`, `"2"`, `"3"` — each with `firstReading`, `secondReading`, `gospel`, `alternativeSermonTexts` |
| `psalm` | object | Psalm: `antiphon`, `antiphonReference`, `text`, `reference`, `gloriaPatri` |
| `psalmVerse` | array | Psalm verse(s) for the day |
| `hallelujah` | object\|null | Hallelujah verse: `text`, `reference` |
| `prayers` | array | Collect prayers (objects with `number` and `text`) |
| `hymns` | object | Suggested hymns: `opening`, `dayHymns`, `additional`, `other` |

## Example

```
GET /api/v1/holy-day/joulupaiva
```

```json
{
  "name": "Joulupäivä",
  "slug": "joulupaiva",
  "season": "Joulujakso",
  "period": "Jouluaika",
  "liturgicalColor": "valkoinen",
  "description": "Dies Natalis Domini\nJoulu – Jumala meidän kanssamme...",
  "yearCycles": {
    "1": {
      "firstReading": { "reference": "Jes. 52:7–10", "text": "..." },
      "secondReading": { "reference": "Hepr. 1:1–4", "text": "..." },
      "gospel": { "reference": "Joh. 1:1–14", "text": "..." },
      "alternativeSermonTexts": []
    },
    "2": { "..." : "..." },
    "3": { "..." : "..." }
  },
  "psalm": {
    "antiphon": "Tänään on syntynyt teille Vapahtaja...",
    "antiphonReference": "Luuk. 2:11",
    "text": "Laulakaa Herralle uusi laulu...",
    "reference": "Ps. 98:1–3",
    "gloriaPatri": true
  },
  "prayers": [
    { "number": 1, "text": "Kaikkivaltias, ikuinen Jumala..." },
    { "number": 2, "text": "..." },
    { "number": 3, "text": "..." }
  ],
  "hymns": {
    "opening": [{ "number": "37", "title": "Oi, riemu suuri, ihmeellinen" }],
    "dayHymns": ["..."],
    "additional": ["..."],
    "other": []
  }
}
```

## Error

```json
{ "error": "Holy day not found: bad-slug" }
```

## Notes

- With `?raw=true` the endpoint returns the unfiltered source data; all three cycles are under `yearCycles`, and days with one set of texts for every cycle have `readings` instead.
- Slugs are stable identifiers suitable for bookmarking and cross-referencing.
