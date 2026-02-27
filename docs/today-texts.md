# GET /api/v1/today/texts

Returns the Bible readings for today, for the active lectionary year cycle. Optionally returns a specific cycle.

## Request

```
GET /api/v1/today/texts
GET /api/v1/today/texts?cycle=2
```

### Query parameters

| Parameter | Type | Description |
|---|---|---|
| `cycle` | number (optional) | Force a specific year cycle: `1`, `2`, or `3`. Defaults to the current church year cycle. |

## Response fields

| Field | Type | Description |
|---|---|---|
| `date` | string | Today's date |
| `yearCycle` | number | The cycle being returned |
| `texts` | object\|null | Readings object, or `null` if no holy day today |
| `texts.firstReading` | object | First reading: `reference`, `bookIntro`, `text` |
| `texts.secondReading` | object | Second reading |
| `texts.gospel` | object | Gospel reading |
| `note` | string | Present on weekdays — advises using the preceding Sunday's texts |
| `precedingSunday` | object | Present on weekdays — the preceding Sunday data |

## Example — holy day

```
GET /api/v1/today/texts
```

```json
{
  "date": "2025-12-25",
  "yearCycle": 1,
  "texts": {
    "firstReading": {
      "reference": "Jes. 52:7–10",
      "bookIntro": "Jesajan kirjasta, luvusta 52",
      "text": "Kuinka kauniit ovat vuorilla sen askeleet..."
    },
    "secondReading": {
      "reference": "Hepr. 1:1–4",
      "bookIntro": "Kirjeestä heprealaisille, luvusta 1",
      "text": "Monesti ja monin tavoin Jumala muinoin puhui..."
    },
    "gospel": {
      "reference": "Joh. 1:1–14",
      "bookIntro": "Evankeliumista Johanneksen mukaan, luvusta 1",
      "text": "Alussa oli Sana..."
    }
  }
}
```

## Example — plain weekday

```json
{
  "date": "2026-02-25",
  "texts": null,
  "note": "Ei pyhäpäivää, käytä edellisen sunnuntain tekstejä.",
  "precedingSunday": { "name": "1. paastonajan sunnuntai", "slug": "...", "..." : "..." }
}
```

## Notes

- All three readings come from the Evankeliumikirja (2021).
- Some readings in cycles 2 and 3 are cross-references to cycle 1 (`ks. 1. vuosikerta`); the API resolves these automatically.
- For all three cycles at once, use [`GET /api/v1/holy-day/:slug`](holy-day.md) and inspect `allYearCycles`.
