# GET /api/v1/date/:date

Returns the full church calendar information for any specific date.

## Request

```
GET /api/v1/date/:date
```

### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `date` | string | Date in `YYYY-MM-DD` format |

## Response

Same shape as [`GET /api/v1/today`](today.md) but for the given date.

| Field | Type | Description |
|---|---|---|
| `date` | string | The requested date |
| `churchYear` | object | Church year info: `start`, `label`, `yearCycle` |
| `holyDay` | object\|null | Primary holy day, or `null` on plain weekdays |
| `precedingSunday` | object\|null | On weekdays: enriched preceding Sunday data |
| `additionalServices` | array | Lower-priority entries sharing the date |
| `dayOfWeek` | string | Finnish day name |
| `season` | string\|null | Liturgical season |

## Example

```
GET /api/v1/date/2025-12-25
```

```json
{
  "date": "2025-12-25",
  "churchYear": {
    "start": 2025,
    "label": "2025–2026",
    "yearCycle": 1
  },
  "holyDay": {
    "name": "Joulupäivä",
    "slug": "joulupaiva",
    "liturgicalColor": "valkoinen",
    "texts": {
      "yearCycle": 1,
      "firstReading": { "reference": "Jes. 52:7–10", "text": "..." },
      "secondReading": { "reference": "Hepr. 1:1–4", "text": "..." },
      "gospel": { "reference": "Joh. 1:1–14", "text": "..." }
    },
    "prayers": ["..."],
    "propers": { "prefaatio": {...}, "kyrieLitania": {...}, "kertosae": {...} }
  },
  "precedingSunday": null,
  "additionalServices": [],
  "dayOfWeek": "torstai",
  "season": "Joulujakso"
}
```

## Error

```json
{ "error": "Invalid date format. Use YYYY-MM-DD." }
```

## Notes

- Accepts any date from 1900 to 2100.
- The year cycle is computed automatically based on the church year the date falls in.
- See also [`/date/:date/color`](date-color.md) and [`/date/:date/propers`](date-propers.md) for focused sub-endpoints.
