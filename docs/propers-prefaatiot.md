# GET /api/v1/propers/prefaatiot

Returns all seasonal preface endings (prefaation päätökset) from the Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000).

The preface (prefaatio) is the opening thanksgiving prayer of the Eucharistic prayer. Its ending varies by liturgical season.

## Request

```
GET /api/v1/propers/prefaatiot
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `source` | string | Source document |
| `prefaatiot` | array | All preface endings |
| `prefaatiot[].title` | string | Descriptive title |
| `prefaatiot[].period` | string | Season label used in the title text |
| `prefaatiot[].appliesTo` | array | Season key(s) that trigger this preface |
| `prefaatiot[].text` | string | Full preface ending text |

## Example

```
GET /api/v1/propers/prefaatiot
```

```json
{
  "source": "Jumalanpalvelusten kirja (2000)",
  "prefaatiot": [
    {
      "title": "Prefaation päätös adventtiaikana",
      "period": "adventtiaikana",
      "appliesTo": ["adventtiaika"],
      "text": "Hänet sinä olet lähettänyt kansasi keskelle,\n\nhänessä ovat täyttyneet profeettojen ennustukset.\n\nKerran hän ilmestyy kunniassaan tuomitsemaan elävät ja kuolleet.\n\nMe kiitämme sinua tästä taivaan lahjasta\n\nja laulamme sinulle ylistystä enkelien ja kaikkien pyhien kanssa:"
    },
    {
      "title": "Prefaation päätös jouluaikana",
      "period": "jouluaikana",
      "appliesTo": ["joulupaiva", "jouluaika"],
      "text": "..."
    }
  ]
}
```

## Notes

- The preface for a specific date is resolved automatically by [`GET /api/v1/today/propers`](today-propers.md) and [`GET /api/v1/date/:date/propers`](date-propers.md).
- Text uses `\n\n` between liturgical phrases, reflecting the spoken pauses in worship.
