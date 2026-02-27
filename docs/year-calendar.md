# GET /api/v1/year/:year/calendar

Returns the ordered list of all holy days and special entries for a given church year, with their computed calendar dates.

## Request

```
GET /api/v1/year/:year/calendar
```

### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `year` | number | The year in which the church year **begins** (i.e. Advent Sunday falls in this year). Range: 1900–2100. |

A church year runs from 1st Advent Sunday of `year` to the Saturday before 1st Advent Sunday of `year + 1`.

## Response fields

| Field | Type | Description |
|---|---|---|
| `churchYear.start` | number | The start year passed in |
| `churchYear.label` | string | e.g. `"2025–2026"` |
| `churchYear.yearCycle` | number | Lectionary cycle: `1`, `2`, or `3` |
| `entries` | array | Ordered list of all entries in the church year |
| `entries[].date` | string | Calendar date (`YYYY-MM-DD`) |
| `entries[].slug` | string | Holy day slug |
| `entries[].name` | string | Finnish name |
| `entries[].type` | string | Entry type: `sunday`, `feast`, `special`, `weekday`, `service` |

## Example

```
GET /api/v1/year/2025/calendar
```

```json
{
  "churchYear": {
    "start": 2025,
    "label": "2025–2026",
    "yearCycle": 1
  },
  "entries": [
    { "date": "2025-11-30", "slug": "1-adventtisunnuntai", "name": "1. adventtisunnuntai", "type": "sunday" },
    { "date": "2025-12-01", "slug": "1-adventtisunnuntain-jalkeinen-viikko", "name": "1. adventtisunnuntain jälkeinen viikko", "type": "weekday" },
    { "date": "2025-12-07", "slug": "2-adventtisunnuntai", "name": "2. adventtisunnuntai", "type": "sunday" },
    "..."
  ]
}
```

## Entry types

| Type | Description |
|---|---|
| `sunday` | Regular Sunday in the church year |
| `feast` | Fixed or moveable feast (Christmas, Easter, etc.) |
| `special` | Semi-fixed special day (Midsummer, All Saints, etc.) |
| `weekday` | Named weekday period (Holy Week days, Easter week, etc.) |
| `service` | Additional service on an existing date (Easter Vigil, etc.) |

## Error

```json
{ "error": "Invalid year. Must be between 1900 and 2100." }
```

## Notes

- Multiple entries can share the same date (e.g. Pitkäperjantai and Jeesuksen kuolinhetki both fall on Good Friday). The resolver applies precedence rules when you query a specific date.
- Easter and all moveable feasts are computed algorithmically using the Anonymous Gregorian algorithm.
