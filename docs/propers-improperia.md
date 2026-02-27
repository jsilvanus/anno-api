# GET /api/v1/propers/improperia

Returns the Improperia texts from the Jumalanpalvelusten kirja (2000).

The Improperia ("Reproaches") are a series of antiphons sung on Good Friday (Pitkäperjantai) in which Christ addresses the congregation, contrasting God's acts of salvation with humanity's rejection of him.

## Request

```
GET /api/v1/propers/improperia
```

No parameters.

## Response fields

| Field | Type | Description |
|---|---|---|
| `source` | string | Source document |
| `improperia` | object | The Improperia content |

The exact shape of `improperia` reflects the structure in the source data (antiphons, versicles, and responses).

## Example

```
GET /api/v1/propers/improperia
```

```json
{
  "source": "Jumalanpalvelusten kirja (2000)",
  "improperia": {
    "..."
  }
}
```

## Notes

- This is a Good Friday (Pitkäperjantai) proper only.
- The Improperia are not returned by the generic `/propers` date-lookup endpoints; they must be fetched directly from this endpoint.
