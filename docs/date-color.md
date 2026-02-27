# GET /api/v1/date/:date/color

Returns only the liturgical color for a specific date. Lightweight alternative to the full date endpoint.

## Request

```
GET /api/v1/date/:date/color
```

### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `date` | string | Date in `YYYY-MM-DD` format |

## Response fields

| Field | Type | Description |
|---|---|---|
| `date` | string | The requested date |
| `liturgicalColor` | string\|null | Finnish name of the liturgical color |
| `holyDay` | string\|null | Name of the holy day or preceding Sunday governing the color |

## Example

```
GET /api/v1/date/2025-12-25/color
```

```json
{
  "date": "2025-12-25",
  "liturgicalColor": "valkoinen",
  "holyDay": "Joulupäivä"
}
```

```
GET /api/v1/date/2026-04-03/color
```

```json
{
  "date": "2026-04-03",
  "liturgicalColor": "musta tai violetti",
  "holyDay": "Pitkäperjantai"
}
```

## Common colors

| Finnish | English |
|---|---|
| `valkoinen` | white |
| `violetti tai sininen` | violet or blue |
| `vihreä` | green |
| `punainen` | red |
| `musta tai violetti` | black or violet |

## Error

```json
{ "error": "Invalid date format. Use YYYY-MM-DD." }
```
