# GET /api/v1/today/lectionary · GET /api/v1/date/:date/lectionary

The weekly lectionary (viikkolektionaari, "Raamattua viikonpäiville") for a date, with full texts: the Bible texts of the day's prayer hours.

- **Readings:** every day has a morning and an evening reading. Weekday readings follow the preceding Sunday's texts, including the displaced Sunday after a feast that took its place.
- **Hour psalms:** the psalms of the morning, midday and evening prayer depend on the weekday and the hour; they are the same every week of the year.
- **Day's psalm:** depends on the season and the weekday.
- **Sundays and holy days** also have the week's psalm (the Sunday's psalm from Evankeliumikirja), the eve reading (aattoilta) and the week's apocrypha text.
- **Saturday evening** has the next Sunday's eve reading. Where kirkkovuosikalenteri.fi gives an evening only its psalm (the evening before 2. sunnuntai joulusta or loppiainen), the API fills in the next day's eve reading.
- An hour lists its reading(s) first and its psalm last; some hours have two readings (a biblical one and one from the Apocrypha), and a reading can itself be from the Psalms.
- **Several days on one date** (e.g. pitkäperjantai, Jeesuksen kuolinhetki, pitkäperjantain ilta) each have their own texts; pick one with `?day=`.

Source: [Kirkkovuosikalenteri](https://www.kirkkovuosikalenteri.fi/) (© Kirkkohallitus; Bible texts Raamattu 1992, © Kirkkohallitus). Fetched with `packages/core/parsers/fetch-weekly-lectionary.js`.

## Parameters

| Parameter | Description |
|---|---|
| `?day=<slug>` | Another day or service on the date; 404 if not on the date |

## Response

| Field | Type | Description |
|---|---|---|
| `date` | string | `YYYY-MM-DD` |
| `day` | object | `{ name, slug, type }` — the holy day, or on a weekday the day whose material is used |
| `alsoOnThisDate` | array | Other days and services on the date |
| `source` | string | Source and copyright |
| `lectionary.eve` | Hour \| null | Eve reading (aattoilta), on Sundays and holy days |
| `lectionary.morning` | Hour \| null | Morning prayer (aamurukous) |
| `lectionary.noon` | Hour \| null | Midday prayer (päivärukous): psalm |
| `lectionary.evening` | Hour \| null | Evening prayer (iltarukous) |
| `lectionary.dayPsalm` | Passage[] | The day's psalm |
| `lectionary.weekPsalm` | Passage[] | The week's psalm (Sundays and holy days) |
| `lectionary.apocrypha` | Passage[] | The week's apocrypha text (Sundays and holy days) |

**Hour:** `{ readings: Passage[], psalms: Passage[] }`

**Passage:** `{ reference, text, chant? }`. `text` keeps line breaks; in psalms the second half-verse is indented for antiphonal reading. `chant` (psalms) has the cadence marks for singing: `*` for the pause and the syllable where the cadence starts in underscores (`kuu_le_`).

## Example

```
GET /api/v1/date/2026-09-28/lectionary
```

```json
{
  "date": "2026-09-28",
  "day": { "name": "18. sunnuntai helluntaista", "slug": "18-sunnuntai-helluntaista", "type": "weekdayMaterial" },
  "alsoOnThisDate": [],
  "lectionary": {
    "eve": null,
    "morning": {
      "readings": [{ "reference": "1. Kor. 7:19–23", "text": "On yhdentekevää, onko ihminen ympärileikattu vai ei; …" }],
      "psalms": [{ "reference": "Ps. 5:2–9, 12–13", "text": "Herra, kuule minua,\nhuomaa huokaukseni!\n  Kuninkaani ja Jumalani, …", "chant": "Herra, kuu_le_ minua, *\n…" }]
    },
    "noon": { "readings": [], "psalms": [{ "reference": "Ps. 67:2–8", "text": "…" }] },
    "evening": {
      "readings": [{ "reference": "1. Kor. 8:4–13", "text": "…" }],
      "psalms": [{ "reference": "Ps. 104:1–4, (5–18) 19–23, 27–30", "text": "…" }]
    },
    "dayPsalm": [{ "reference": "Ps. 138", "text": "…" }],
    "weekPsalm": [],
    "apocrypha": []
  }
}
```
