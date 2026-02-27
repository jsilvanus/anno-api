# GET /api/v1/lectionary

Returns metadata about the lectionary Bible index derived from the PDF *Viikkolektionaarin raamatunkohdat*.

## Request

```
GET /api/v1/lectionary
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `title` | string | Full Finnish title of the source document |
| `description` | string | English description |
| `note` | string | Note about bold vs. plain entries in the original PDF |
| `entryCount` | number | Total number of Bible passage entries indexed |
| `holyDayCount` | number | Number of distinct liturgical occasion names in the index |

## Example

```
GET /api/v1/lectionary
```

```json
{
  "title": "Kirkkovuoden pyhäpäivien ja arkipäivien raamatuntekstit Evankeliumikirjassa ja viikkolektionaarissa",
  "description": "Bible text index for holy days and weekdays in the Evankeliumikirja and weekly lectionary of the Evangelical-Lutheran Church of Finland",
  "note": "Bold entries in the original refer to Evankeliumikirja; plain entries to the weekly lectionary (viikkolektionaari).",
  "entryCount": 2073,
  "holyDayCount": 176
}
```

## About the lectionary index

The source PDF indexes every Bible passage used in:
- The **Evankeliumikirja** (Sunday lectionary, three-year cycle)
- The **Viikkolektionaari** (weekday lectionary with morning and evening readings)

Each entry maps a Bible passage to one or more liturgical occasions, with context (e.g. morning, evening, specific day of week) and reading type (e.g. gospel, psalm refrain, hallelujah verse).

See also:
- [`GET /api/v1/lectionary/holy-days`](lectionary-holy-days.md) — list all occasion names
- [`GET /api/v1/lectionary/by-holy-day`](lectionary-by-holy-day.md) — look up by occasion
- [`GET /api/v1/lectionary/search`](lectionary-search.md) — search by Bible reference
