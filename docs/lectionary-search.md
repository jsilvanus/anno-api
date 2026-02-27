# GET /api/v1/lectionary/search

Searches the lectionary index by Bible book name or reference. Returns all indexed occasions that use the matching passage.

## Request

```
GET /api/v1/lectionary/search?q=Ps.+22
```

### Query parameters

| Parameter | Type | Description |
|---|---|---|
| `q` | string | **Required.** Substring matched against book name, abbreviation, and reference (case-insensitive). |

## Response fields

| Field | Type | Description |
|---|---|---|
| `query` | string | The query string |
| `count` | number | Number of matching entries |
| `results` | array | Matching entries |
| `results[].book` | string | Full Finnish book name |
| `results[].abbreviation` | string | Book abbreviation |
| `results[].section` | string | `"OT"`, `"NT"`, or `"Apocrypha"` |
| `results[].reference` | string | Chapter and verse reference |
| `results[].occurrences` | array | All liturgical occasions where this passage appears |
| `results[].occurrences[].holyDay` | string | Occasion name |
| `results[].occurrences[].context` | string\|null | Time-of-day or sub-context |
| `results[].occurrences[].readingType` | string\|null | Type of use |

## Example

```
GET /api/v1/lectionary/search?q=Ps.+22
```

```json
{
  "query": "Ps. 22",
  "count": 5,
  "results": [
    {
      "book": "Psalmien kirja",
      "abbreviation": "Ps.",
      "section": "OT",
      "reference": "22:2–6",
      "occurrences": [
        {
          "holyDay": "palmusunnuntai",
          "context": null,
          "readingType": "psalmiteksti"
        }
      ]
    },
    {
      "book": "Psalmien kirja",
      "abbreviation": "Ps.",
      "section": "OT",
      "reference": "22:7–20",
      "occurrences": [
        {
          "holyDay": "pitkäperjantai",
          "context": null,
          "readingType": "psalmiteksti"
        }
      ]
    }
  ]
}
```

## Search tips

| Query | Finds |
|---|---|
| `Matt` | All Matthew passages |
| `Matt. 5` | Matthew chapter 5 passages |
| `Matt. 5:1` | Matthew 5:1 specifically |
| `Ps.` | All Psalms |
| `Room.` | All Romans passages |
| `Jesajan` | All Isaiah passages (by book name) |

## Error

```json
{ "error": "Query parameter ?q= is required. Example: ?q=Matt.+5" }
```

## Notes

- This searches the full lectionary index (2073 entries) including weekday and psalm readings — broader than [`GET /api/v1/search/text`](search-text.md) which only covers Sunday Evankeliumikirja readings.
- Each result entry may have multiple occurrences if the same passage is used on more than one occasion.
