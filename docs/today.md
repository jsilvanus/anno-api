# GET /api/v1/today

Returns the full church calendar information for today's date.

## Request

```
GET /api/v1/today
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `date` | string | Today's date (`YYYY-MM-DD`) |
| `churchYear.start` | number | Calendar year in which this church year began |
| `churchYear.label` | string | Church year label, e.g. `"2025–2026"` |
| `churchYear.yearCycle` | number | Lectionary year cycle: `1`, `2`, or `3` |
| `holyDay` | object\|null | Data for the primary holy day, or `null` on plain weekdays |
| `holyDay.name` | string | Finnish name of the holy day |
| `holyDay.slug` | string | URL-safe identifier |
| `holyDay.liturgicalColor` | string | Liturgical color for the day |
| `holyDay.description` | string | Description and theological context |
| `holyDay.texts` | object | Bible readings for the active year cycle |
| `holyDay.allYearCycles` | object | Readings for all three year cycles |
| `holyDay.psalm` | object | Psalm with antiphon and text |
| `holyDay.psalmVerse` | array | Psalm verse(s) for the day |
| `holyDay.prayers` | array | Collect prayers (usually 3 options) |
| `holyDay.hymns` | object | Suggested hymn numbers by category |
| `holyDay.propers` | object | Liturgical propers (prefaatio, kyrieLitania, kertosae) |
| `precedingSunday` | object\|null | On weekdays: enriched data for the preceding Sunday |
| `additionalServices` | array | Other services on the same day (e.g. vigil alongside a feast) |
| `dayOfWeek` | string | Finnish day name (`maanantai`…`sunnuntai`) |
| `season` | string | Liturgical season |

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
    "yearCycle": 1
  },
  "holyDay": {
    "name": "Joulupäivä",
    "slug": "joulupaiva",
    "liturgicalColor": "valkoinen",
    "description": "...",
    "texts": {
      "yearCycle": 1,
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
