# GET /api/v1/today/prayer

Returns a collect prayer for today's holy day (or preceding Sunday on weekdays).

## Request

```
GET /api/v1/today/prayer
GET /api/v1/today/prayer?n=2
```

### Query parameters

| Parameter | Type | Description |
|---|---|---|
| `n` | number (optional) | Return a specific prayer by number (1-based). Omit for a random prayer. |

## Response fields

| Field | Type | Description |
|---|---|---|
| `date` | string | Today's date |
| `holyDay` | string | Name of the holy day the prayer belongs to |
| `prayer` | object\|null | The prayer, or `null` if none available |
| `prayer.number` | number | Prayer number within the day |
| `prayer.text` | string | Full prayer text in Finnish |
| `totalPrayers` | number | Total number of prayers available (only when returning a random one) |

## Example

```
GET /api/v1/today/prayer
```

```json
{
  "date": "2025-12-25",
  "holyDay": "Joulupäivä",
  "prayer": {
    "number": 2,
    "text": "Kaikkivaltias Jumala,\nsinä olet lähettänyt Poikasi maailmaan\npelastamaan meidät synnistä ja kuolemasta..."
  },
  "totalPrayers": 3
}
```

```
GET /api/v1/today/prayer?n=1
```

```json
{
  "date": "2025-12-25",
  "holyDay": "Joulupäivä",
  "prayer": {
    "number": 1,
    "text": "Kaikkivaltias, ikuinen Jumala.\nSinä annoit ainoan Poikasi syntyä ihmiseksi..."
  }
}
```

## Notes

- Most holy days have 3 prayer options. The `?n=` parameter selects one deterministically; without it the selection is random.
- On a weekday with no holy day, the preceding Sunday's prayers are used.
- If no prayers are available, `prayer` is `null`.
