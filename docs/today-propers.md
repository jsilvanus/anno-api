# GET /api/v1/today/propers · GET /api/v1/date/:date/propers

Liturgical propers of the day from Jumalanpalvelusten kirja, with the day's rubrics.

## Parameters

| Parameter | Description |
|---|---|
| `?day=<slug>` | Another day or service on the date (see [Several days on one date](README.md#several-days-on-one-date)); 404 if not on the date |

Without `?day=`, the primary day is used: the date's holy day, or on a weekday the day whose material is used.

## Response

| Field | Type | Description |
|---|---|---|
| `date` | string | `YYYY-MM-DD` |
| `day` | object\|null | `{ name, slug, type }` of the day this response is about |
| `alsoOnThisDate` | array | The other days and services on the date, `{ name, slug, type }` |
| `propers.prefaatio` | object\|null | Preface ending of the season |
| `propers.kyrieLitania` | object\|null | Seasonal Kyrie litany |
| `propers.kertosae` | object\|null | Psalm refrain |
| `propers.postCommunionPrayer` | object\|null | Thanksgiving prayer after communion |
| `liturgy` | object | Rubrics of this day (see [day-response.md](day-response.md#liturgy)) |
