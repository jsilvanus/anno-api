# GET /api/v1/propers/kyrie-litaniat

Returns all seasonal Kyrie litanies from the Jumalanpalvelusten kirja (2000).

The Kyrie litany (kyrie-litania) is a responsive prayer of supplication sung or said near the beginning of the service. Different litanies are used for different seasons.

## Request

```
GET /api/v1/propers/kyrie-litaniat
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `source` | string | Source document |
| `kyrieLitaniat` | array | All Kyrie litanies |
| `kyrieLitaniat[].season` | string | Season name |
| `kyrieLitaniat[].slug` | string | Season slug used for lookup |
| `kyrieLitaniat[].texts` | array | Litany text(s). Some seasons have one text, others have a primary + alternate. |

## Example

```
GET /api/v1/propers/kyrie-litaniat
```

```json
{
  "source": "Jumalanpalvelusten kirja (2000)",
  "kyrieLitaniat": [
    {
      "season": "Adventtiaika",
      "slug": "adventtiaika",
      "texts": [
        "E Rukoilkaamme Herraa, joka on tuleva...\n\n[Rukoilkaamme Herraa.]\n\nS Herra, armahda. [Kristus, armahda. Herra, armahda.]"
      ]
    },
    {
      "season": "Joulu – jouluaika",
      "slug": "joulu-jouluaika",
      "texts": ["..."]
    },
    {
      "season": "Paastonaika",
      "slug": "paastonaika",
      "texts": ["..."]
    }
  ]
}
```

## Seasons covered

- Adventtiaika (Advent)
- Joulu – jouluaika (Christmas season)
- Loppiaisaika, paastonaikaa edeltävät sunnuntait (Epiphany)
- Paastonaika (Lent)
- Kärsimysaika (Passiontide)
- Pitkäperjantai, hiljainen lauantai (Good Friday, Holy Saturday)
- Pääsiäinen – pääsiäisaika (Easter season)
- Helatorstai – helluntaiaatto (Ascension–Pentecost Eve)
- Helluntai (Pentecost)

## Notes

- Litany texts include both the leader (`E`) and congregation (`S`) parts.
- The litany for a specific date is resolved automatically by the `/propers` endpoints.
