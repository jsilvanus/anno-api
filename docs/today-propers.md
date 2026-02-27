# GET /api/v1/today/propers

Returns the liturgical propers for today from the Jumalanpalvelusten kirja (2000).

## Request

```
GET /api/v1/today/propers
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `date` | string | Today's date |
| `holyDay` | string\|null | Name of the holy day |
| `propers` | object\|null | The propers object |
| `propers.prefaatio` | object\|null | Seasonal preface ending |
| `propers.prefaatio.title` | string | Descriptive title |
| `propers.prefaatio.period` | string | Season this preface applies to |
| `propers.prefaatio.text` | string | Full preface text |
| `propers.kyrieLitania` | object\|null | Seasonal Kyrie litany |
| `propers.kyrieLitania.season` | string | Season name |
| `propers.kyrieLitania.texts` | array | Litany text(s) |
| `propers.kertosae` | object\|null | Psalm refrain for the day |
| `propers.kertosae.number` | number | Refrain number |
| `propers.kertosae.title` | string | Refrain title |
| `propers.kertosae.occasion` | string | Liturgical occasion description |

## Example

```
GET /api/v1/today/propers
```

```json
{
  "date": "2025-12-25",
  "holyDay": "Joulupäivä",
  "propers": {
    "prefaatio": {
      "title": "Prefaation päätös jouluaikana",
      "period": "jouluaikana",
      "text": "Hän on Sana, joka on tullut lihaksi\n\nja asunut meidän keskellämme..."
    },
    "kyrieLitania": {
      "season": "Joulu – jouluaika",
      "slug": "joulu-jouluaika",
      "texts": ["Jouluaattona, jouluyönä ja joulupäivänä.\n\nE Rukoilkaamme syntynyttä Vapahtajaa..."]
    },
    "kertosae": {
      "number": 7,
      "title": "Meille on syntynyt Vapahtaja",
      "occasion": "Jouluyönä, jouluaamuna, joulupäivänä"
    }
  }
}
```

## Notes

- Propers are drawn from Kirkkokäsikirja I (Jumalanpalvelusten kirja, 2000).
- For full collections of each proper type, see the `/api/v1/propers/*` endpoints.
- On weekdays, propers from the preceding Sunday are used.
