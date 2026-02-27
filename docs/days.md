# GET /api/v1/days

Returns a summary index of all holy days in the database.

## Request

```
GET /api/v1/days
```

No parameters.

## Response

An array of objects, one per holy day.

| Field | Type | Description |
|---|---|---|
| `name` | string | Finnish name |
| `slug` | string | Slug identifier (use with [`/holy-day/:slug`](holy-day.md)) |
| `season` | string\|null | Liturgical season |
| `period` | string\|null | Liturgical period |
| `latinName` | string\|null | Latin name (e.g. `"Invocavit"`, `"Laetare"`) |
| `liturgicalColor` | string\|null | Liturgical color |

## Example

```
GET /api/v1/days
```

```json
[
  {
    "name": "1. adventtisunnuntai",
    "slug": "1-adventtisunnuntai",
    "season": "Joulujakso",
    "period": "Adventtiaika",
    "latinName": null,
    "liturgicalColor": "valkoinen, maanantaista lauantaihin violetti tai sininen"
  },
  {
    "name": "Joulupäivä",
    "slug": "joulupaiva",
    "season": "Joulujakso",
    "period": "Jouluaika",
    "latinName": "Dies Natalis Domini",
    "liturgicalColor": "valkoinen"
  },
  "..."
]
```

## Notes

- This endpoint is the best starting point for discovering available slugs.
- For full data including readings and prayers, fetch individual days with [`GET /api/v1/holy-day/:slug`](holy-day.md).
- The list is not date-ordered; it reflects the order of the source data. For a date-ordered view of a specific church year use [`GET /api/v1/year/:year/calendar`](year-calendar.md).
