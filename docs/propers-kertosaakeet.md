# GET /api/v1/propers/kertosaakeet

Returns all seasonal psalm refrains (kertosäkeet) from the Jumalanpalvelusten kirja (2000).

The psalm refrain (kertosäe) is a short verse sung by the congregation between the verses of the responsorial psalm. It changes with the liturgical season and feast.

## Request

```
GET /api/v1/propers/kertosaakeet
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `source` | string | Source document |
| `kertosaakeet` | array | All psalm refrains |
| `kertosaakeet[].number` | number | Refrain number |
| `kertosaakeet[].title` | string | Short title / first words |
| `kertosaakeet[].occasion` | string | Liturgical occasion(s) when this refrain is used |
| `kertosaakeet[].alternatives` | array | Alternative versions of the refrain, if any |

## Example

```
GET /api/v1/propers/kertosaakeet
```

```json
{
  "source": "Jumalanpalvelusten kirja (2000)",
  "kertosaakeet": [
    {
      "number": 1,
      "title": "Tule, Herra Jeesus",
      "occasion": "1. adventtisunnuntai",
      "alternatives": []
    },
    {
      "number": 7,
      "title": "Meille on syntynyt Vapahtaja",
      "occasion": "Jouluyönä, jouluaamuna, joulupäivänä",
      "alternatives": []
    },
    {
      "number": 16,
      "title": "Kristus on ylösnoussut",
      "occasion": "Pääsiäisenä, pääsiäisaikana",
      "alternatives": []
    }
  ]
}
```

## Notes

- The appropriate refrain for a specific date is resolved automatically by the `/propers` endpoints (returned as `kertosae`).
- The `occasion` field is a free-text description from the source document.
