# GET /api/v1/lectionary/holy-days

Returns a sorted list of all liturgical occasion names present in the lectionary index.

## Request

```
GET /api/v1/lectionary/holy-days
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `holyDays` | array of strings | All occasion names, sorted alphabetically |

## Example

```
GET /api/v1/lectionary/holy-days
```

```json
{
  "holyDays": [
    "1. adventtisunnuntai",
    "1. adventtisunnuntain jälkeinen viikko",
    "1. paastonajan sunnuntai (invocavit)",
    "1. sunnuntai joulusta",
    "2. adventtisunnuntai",
    "helluntain jälkeinen viikko eli helluntaiviikko",
    "joulupäivä",
    "kiirastorstai",
    "loppiainen (epifania)",
    "palmusunnuntai",
    "pääsiäisyö",
    "pääsiäispäivä",
    "..."
  ]
}
```

## Notes

- The 176 occasion names come directly from the source PDF index. They include Sundays, feasts, weekdays, and time-of-day variants (morning, evening, etc.).
- These names are natural-language strings, not slugs. To look up readings for a name, pass it (or a substring) to [`GET /api/v1/lectionary/by-holy-day?q=`](lectionary-by-holy-day.md).
- Weekday entries often include a time-of-day qualifier, e.g. `"1. adventtisunnuntain jälkeinen viikko, maanantaiaamu"`.
