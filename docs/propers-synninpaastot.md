# GET /api/v1/propers/synninpaastot

Returns all absolution texts (synninpäästöt) from the Jumalanpalvelusten kirja (2000).

The absolution (synninpäästö) is the declaration of forgiveness spoken by the presiding minister after the confession of sins.

## Request

```
GET /api/v1/propers/synninpaastot
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `source` | string | Source document |
| `synninpaastot` | array | All absolution texts |
| `synninpaastot[].number` | number | Absolution number |
| `synninpaastot[].text` | string | Full absolution text |

## Example

```
GET /api/v1/propers/synninpaastot
```

```json
{
  "source": "Jumalanpalvelusten kirja (2000)",
  "synninpaastot": [
    {
      "number": 1,
      "text": "Kaikkivaltias, armollinen Jumala\n\non suuressa laupeudessaan armahtanut meitä.\n\nPoikansa Jeesuksen Kristuksen tähden\n\nhän antaa meille synnit anteeksi\n\nja lahjoittaa elämän ja autuuden.\n\n»Jumala on rakastanut maailmaa niin paljon,\n\nettä antoi ainoan Poikansa,\n\njottei yksikään, joka häneen uskoo,\n\njoutuisi kadotukseen, vaan saisi iankaikkisen elämän.»"
    },
    {
      "number": 2,
      "text": "..."
    }
  ]
}
```
