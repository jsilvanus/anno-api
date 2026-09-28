# GET /api/v1/today/prayer · GET /api/v1/date/:date/prayer

A prayer of the day (päivän rukous).

## Parameters

| Parameter | Description |
|---|---|
| `?day=<slug>` | Another day or service on the date (see [Several days on one date](README.md#several-days-on-one-date)); 404 if not on the date |
| `?n=2` | A specific prayer by number |
| `?all=true` | All prayers of the day |

Without `?day=`, the primary day is used: the date's holy day, or on a weekday the day whose material is used.

## Response

| Field | Type | Description |
|---|---|---|
| `date` | string | `YYYY-MM-DD` |
| `day` | object\|null | `{ name, slug, type }` of the day this response is about |
| `alsoOnThisDate` | array | The other days and services on the date, `{ name, slug, type }` |
| `prayer` | object\|null | `{ number, text }` — random unless `?n=` is given |
| `totalPrayers` | number | Number of prayers of the day |
| `prayers` | array | With `?all=true`: all prayers |
