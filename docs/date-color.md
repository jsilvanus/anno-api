# GET /api/v1/today/color · GET /api/v1/date/:date/color

The liturgical colour of the day. On weekdays after a feast that took a Sunday's place, this is the weekday colour (e.g. green from Monday after kynttilänpäivä).

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
| `liturgicalColor.color` | string | `valkoinen`, `violetti`, `sininen`, `vihreä`, `punainen` or `musta` |
| `liturgicalColor.alternatives` | string[] | Alternative colours ("violetti tai sininen") |
| `liturgicalColor.english` | string[] | The same in English |
| `liturgicalColor.note` | string\|null | Conditions from Evankeliumikirja |
| `liturgicalColor.text` | string | The colour text as given in the book |
