# GET /api/v1/today/liturgy · GET /api/v1/date/:date/liturgy

Rubrics of the Mass for a date's main service (see [day-response.md](day-response.md#liturgy)). They follow what Evankeliumikirja prints for the day, so feasts in Lent such as Marian ilmestyspäivä keep Gloria, hallelujah and Gloria Patri. Additional services such as pääsiäisyö have their own `liturgy` in the full day response.

`?day=<slug>` picks another day or service on the date, e.g. `/api/v1/date/2026-04-04/liturgy?day=paasiaisyo` for the Easter Vigil instead of hiljainen lauantai. `alsoOnThisDate` lists the other days on the date.

```
GET /api/v1/date/2026-03-01/liturgy
```

```json
{
  "date": "2026-03-01",
  "day": { "name": "2. paastonajan sunnuntai", "slug": "2-paastonajan-sunnuntai", "type": "sunday" },
  "alsoOnThisDate": [],
  "liturgy": {
    "gloria": false,
    "hallelujah": false,
    "psalmVerseInsteadOfHallelujah": true,
    "gloriaPatri": true,
    "notes": [
      "Kunnia ja kiitosvirsi jätetään pois paastonaikana (tuhkakeskiviikosta lähtien).",
      "Halleluja jätetään pois paastonaikana tuhkakeskiviikosta lähtien. Hallelujalaulun sijasta voidaan käyttää psalmilausetta."
    ],
    "source": "Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000); Evankeliumikirja (2021)"
  }
}
```
