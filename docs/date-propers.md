# GET /api/v1/date/:date/propers

Returns the liturgical propers for a specific date from the Jumalanpalvelusten kirja (2000).

## Request

```
GET /api/v1/date/:date/propers
```

### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `date` | string | Date in `YYYY-MM-DD` format |

## Response fields

| Field | Type | Description |
|---|---|---|
| `date` | string | The requested date |
| `holyDay` | string\|null | Name of the governing holy day |
| `propers` | object\|null | Propers object (same shape as [`/today/propers`](today-propers.md)) |
| `propers.prefaatio` | object\|null | Seasonal preface ending |
| `propers.kyrieLitania` | object\|null | Seasonal Kyrie litany |
| `propers.kertosae` | object\|null | Psalm refrain |

## Example

```
GET /api/v1/date/2026-04-05/propers
```

```json
{
  "date": "2026-04-05",
  "holyDay": "Pääsiäispäivä",
  "propers": {
    "prefaatio": {
      "title": "Prefaation päätös pääsiäispäivänä",
      "period": "pääsiäispäivänä",
      "text": "..."
    },
    "kyrieLitania": {
      "season": "Pääsiäinen – pääsiäisaika",
      "slug": "paasiainen-paasiaisaika",
      "texts": ["..."]
    },
    "kertosae": {
      "number": 16,
      "title": "Kristus on ylösnoussut",
      "occasion": "Pääsiäisenä, pääsiäisaikana"
    }
  }
}
```

## Error

```json
{ "error": "Invalid date format. Use YYYY-MM-DD." }
```
