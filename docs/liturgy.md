# GET /api/v1/today/liturgy · GET /api/v1/date/:date/liturgy

Seasonal rubrics of the Mass for a date (see [day-response.md](day-response.md#liturgy)).

```
GET /api/v1/date/2026-03-01/liturgy
```

```json
{
  "date": "2026-03-01",
  "holyDay": "2. paastonajan sunnuntai",
  "liturgy": {
    "gloria": false,
    "hallelujah": false,
    "psalmVerseInsteadOfHallelujah": true,
    "gloriaPatri": true,
    "notes": [
      "Kunnia ja kiitosvirsi jätetään pois paastonaikana (tuhkakeskiviikosta lähtien).",
      "Halleluja jätetään pois paastonaikana tuhkakeskiviikosta lähtien. Hallelujalaulun sijasta voidaan käyttää psalmilausetta."
    ],
    "source": "Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000)"
  }
}
```
