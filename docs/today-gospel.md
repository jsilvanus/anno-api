# GET /api/v1/today/gospel

Returns the gospel reading for today's holy day (or preceding Sunday on weekdays).

## Request

```
GET /api/v1/today/gospel
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `date` | string | Today's date |
| `holyDay` | string\|null | Name of the holy day |
| `yearCycle` | number | Active lectionary year cycle |
| `gospel` | object\|null | The gospel reading, or `null` if unavailable |
| `gospel.reference` | string | Bible reference, e.g. `"Joh. 1:1–14"` |
| `gospel.bookIntro` | string | Liturgical introduction phrase |
| `gospel.text` | string | Full gospel text in Finnish |

## Example

```
GET /api/v1/today/gospel
```

```json
{
  "date": "2025-12-25",
  "holyDay": "Joulupäivä",
  "yearCycle": 1,
  "gospel": {
    "reference": "Joh. 1:1–14",
    "bookIntro": "Evankeliumista Johanneksen mukaan, luvusta 1",
    "text": "Alussa oli Sana. Sana oli Jumalan luona, ja Sana oli Jumala..."
  }
}
```

## Notes

- On weekdays without a holy day, falls back to the preceding Sunday's gospel.
- The year cycle follows the current church year automatically.
