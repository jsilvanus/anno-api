# GET /api/v1/search/text

Searches all holy day readings by Bible reference string. Useful for finding which days use a particular passage.

## Request

```
GET /api/v1/search/text?q=Matt.+4
```

### Query parameters

| Parameter | Type | Description |
|---|---|---|
| `q` | string | **Required.** Substring to search for in Bible references (case-insensitive). |

The query is matched against all `firstReading`, `secondReading`, and `gospel` references across all three lectionary cycles, plus weekday readings.

## Response fields

| Field | Type | Description |
|---|---|---|
| `query` | string | The query string as received |
| `count` | number | Total number of matches |
| `results` | array | Matching entries |
| `results[].holyDay` | string | Name of the holy day |
| `results[].slug` | string | Holy day slug |
| `results[].yearCycle` | number | Lectionary year cycle (1, 2, or 3) |
| `results[].readingType` | string | `"firstReading"`, `"secondReading"`, or `"gospel"` |
| `results[].reference` | string | Full Bible reference |

## Example

```
GET /api/v1/search/text?q=Joh.+3
```

```json
{
  "query": "joh. 3",
  "count": 4,
  "results": [
    {
      "holyDay": "Pyhän Kolminaisuuden päivä",
      "slug": "pyhan-kolminaisuuden-paiva",
      "yearCycle": 1,
      "readingType": "gospel",
      "reference": "Joh. 3:1–17"
    },
    {
      "holyDay": "Helluntaipäivä",
      "slug": "helluntaipaiva",
      "yearCycle": 3,
      "readingType": "gospel",
      "reference": "Joh. 3:1–8"
    }
  ]
}
```

## Error

```json
{ "error": "Query parameter ?q= is required." }
```

## Notes

- Matching is case-insensitive substring search on the reference string only — not on the text content.
- This searches the Evankeliumikirja lectionary (Sunday readings). For the broader weekly lectionary index (including psalms, weekday readings, etc.), use [`GET /api/v1/lectionary/search`](lectionary-search.md).
- Partial matches work: `?q=Matt` returns all Matthew references; `?q=Matt.+4:1` narrows to a specific chapter and verse.
