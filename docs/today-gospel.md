# GET /api/v1/today/gospel · GET /api/v1/date/:date/gospel

The gospel of the day in the active year cycle.

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
| `yearCycle` | number | Active year cycle |
| `gospel` | object\|null | `reference`, `bookIntro`, `text`, optional `alternatives` |
