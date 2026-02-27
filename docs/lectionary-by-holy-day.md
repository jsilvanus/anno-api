# GET /api/v1/lectionary/by-holy-day

Returns all Bible passages indexed to a given liturgical occasion (case-insensitive substring match).

## Request

```
GET /api/v1/lectionary/by-holy-day?q=pääsiäisyö
```

### Query parameters

| Parameter | Type | Description |
|---|---|---|
| `q` | string | **Required.** Substring to match against occasion names (case-insensitive). |

## Response fields

| Field | Type | Description |
|---|---|---|
| `query` | string | The query string |
| `matchedDays` | number | Number of distinct occasion names matched |
| `count` | number | Total number of Bible passage entries returned |
| `results` | object | Keys are matched occasion name strings; values are arrays of passage entries |
| `results[name][].book` | string | Full Finnish book name |
| `results[name][].abbreviation` | string | Book abbreviation, e.g. `"1. Moos."`, `"Matt."` |
| `results[name][].section` | string | `"OT"`, `"NT"`, or `"Apocrypha"` |
| `results[name][].reference` | string | Chapter and verse reference |
| `results[name][].context` | string\|null | Time-of-day or sub-context, e.g. `"aattoilta"`, `"maanantaiaamu"` |
| `results[name][].readingType` | string\|null | Type of use: `"lukukappale"`, `"evankeliumi"`, `"1. vsk. 1. lukukappale"`, `"psalmiteksti"`, `"hallelujasäe"`, etc. |

## Example

```
GET /api/v1/lectionary/by-holy-day?q=pääsiäisyö
```

```json
{
  "query": "pääsiäisyö",
  "matchedDays": 1,
  "count": 9,
  "results": {
    "pääsiäisyö": [
      {
        "book": "Ensimmäinen Mooseksen kirja",
        "abbreviation": "1. Moos.",
        "section": "OT",
        "reference": "1:1–5, 26–28 (29–30) 31 – 2:1",
        "context": null,
        "readingType": "lukukappale"
      },
      {
        "book": "Toinen Mooseksen kirja",
        "abbreviation": "2. Moos.",
        "section": "OT",
        "reference": "14:8, 10–16, 21–22",
        "context": null,
        "readingType": "lukukappale"
      },
      {
        "book": "Psalmien kirja",
        "abbreviation": "Ps.",
        "section": "OT",
        "reference": "118:15–23 (24)",
        "context": null,
        "readingType": "psalmiteksti"
      }
    ]
  }
}
```

## Reading types

| Value | Meaning |
|---|---|
| `lukukappale` | General lesson/reading |
| `evankeliumi` | Gospel reading |
| `1. vsk. 1. lukukappale` | Year cycle 1, first reading |
| `2. vsk. 2. lukukappale` | Year cycle 2, second reading |
| `psalmiteksti` | Psalm text |
| `psalmiantifoni` | Psalm antiphon |
| `psalmilause` | Psalm sentence |
| `hallelujasäe` | Hallelujah verse |
| `päivän psalmi` | Psalm of the day |
| `illan psalmi` | Evening psalm |
| `aamun psalmi` | Morning psalm |
| `vaihtoehtoinen saarnateksti` | Alternative sermon text |

## Error

```json
{ "error": "Query parameter ?q= is required. Example: ?q=pääsiäisyö" }
```

## Notes

- A broad query like `?q=joulu` will match multiple occasions (joulupäivä, jouluaatto, jouluyö, etc.) and return all of them grouped by name.
- Use [`GET /api/v1/lectionary/holy-days`](lectionary-holy-days.md) to browse exact occasion name strings.
