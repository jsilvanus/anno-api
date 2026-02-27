# GET /api/v1/propers/kiitosrukoukset

Returns all thanksgiving prayers after absolution (kiitosrukoukset) from the Jumalanpalvelusten kirja (2000).

These short prayers of thanksgiving are spoken or sung by the congregation in response to the absolution.

## Request

```
GET /api/v1/propers/kiitosrukoukset
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `source` | string | Source document |
| `kiitosrukoukset` | array | All thanksgiving prayers |
| `kiitosrukoukset[].number` | number | Prayer number |
| `kiitosrukoukset[].text` | string | Full prayer text |

## Example

```
GET /api/v1/propers/kiitosrukoukset
```

```json
{
  "source": "Jumalanpalvelusten kirja (2000)",
  "kiitosrukoukset": [
    {
      "number": 1,
      "text": "Kiitos olkoon Jumalalle\n\nhänen sanomattoman lahjansa tähden."
    },
    {
      "number": 2,
      "text": "..."
    }
  ]
}
```
