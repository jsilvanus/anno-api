# GET /api/v1/today

Returns the full church calendar information for today's date.

## Request

```
GET /api/v1/today
```

No parameters.

## Response

See [day-response.md](day-response.md) for every field. Add `?cycles=false` to leave out the texts of the other year cycles.

## Example

```
GET /api/v1/today
```

```json
{
  "date": "2025-12-25",
  "churchYear": {
    "start": 2025,
    "label": "2025–2026",
    "yearCycle": 2
  },
  "holyDay": {
    "name": "Joulupäivä",
    "slug": "joulupaiva",
    "liturgicalColor": "valkoinen",
    "description": "...",
    "texts": {
      "yearCycle": 2,
      "firstReading": {
        "reference": "Jes. 52:7–10",
        "bookIntro": "Jesajan kirjasta, luvusta 52",
        "text": "..."
      },
      "secondReading": {
        "reference": "Hepr. 1:1–4",
        "bookIntro": "...",
        "text": "..."
      },
      "gospel": {
        "reference": "Joh. 1:1–14",
        "bookIntro": "...",
        "text": "..."
      }
    },
    "prayers": [
      { "number": 1, "text": "Kaikkivaltias, ikuinen Jumala..." }
    ],
    "propers": {
      "prefaatio": { "title": "Prefaation päätös jouluaikana", "text": "..." },
      "kyrieLitania": { "season": "Joulu – jouluaika", "texts": ["..."] },
      "kertosae": { "number": 7, "title": "...", "occasion": "..." }
    }
  },
  "precedingSunday": null,
  "additionalServices": [],
  "dayOfWeek": "torstai",
  "season": "Joulujakso"
}
```

## Notes

- On a plain weekday with no holy day, `holyDay` is `null` and `precedingSunday` is populated with the enriched data of the preceding Sunday — allowing callers to use its texts and propers for weekday services.
- `additionalServices` lists lower-priority entries that share the date (e.g. an evening vigil alongside a feast day).
- See [today-texts.md](today-texts.md), [today-prayer.md](today-prayer.md), [today-gospel.md](today-gospel.md), [today-propers.md](today-propers.md) for focused sub-endpoints.
