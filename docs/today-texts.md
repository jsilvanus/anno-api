# GET /api/v1/today/texts · GET /api/v1/date/:date/texts

Bible readings of the day with psalm, hallelujah verse (or Lent psalm verse) and the day's rubrics.

## Parameters

| Parameter | Description |
|---|---|
| `?day=<slug>` | Another day or service on the date (see [Several days on one date](README.md#several-days-on-one-date)); 404 if not on the date |
| `?cycle=1|2|3` | Readings of another year cycle (default: the church year's cycle) |

Without `?day=`, the primary day is used: the date's holy day, or on a weekday the day whose material is used.

## Response

| Field | Type | Description |
|---|---|---|
| `date` | string | `YYYY-MM-DD` |
| `day` | object\|null | `{ name, slug, type }` of the day this response is about |
| `alsoOnThisDate` | array | The other days and services on the date, `{ name, slug, type }` |
| `yearCycle` | number | Year cycle of `texts` |
| `texts` | object | `firstReading`, `secondReading`, `gospel` (each: `reference`, `bookIntro`, `text`, optional `alternatives`), `alternativeSermonTexts`, `sameInAllCycles`; weekday texts where the book has them |
| `psalm` | object\|null | Antiphon, text, reference, `gloriaPatri` |
| `hallelujah` | object\|null | Hallelujah verse `{ text, reference, alternatives }` |
| `psalmVerse` | object\|null | Psalm verse used in Lent instead of the hallelujah |
| `liturgy` | object | Rubrics of this day (see [day-response.md](day-response.md#liturgy)) |
