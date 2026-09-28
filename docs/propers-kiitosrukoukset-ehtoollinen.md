# GET /api/v1/propers/kiitosrukoukset-ehtoollinen

Seasonal thanksgiving prayers after communion (kiitosrukous ehtoollisen jälkeen) from Jumalanpalvelusten kirja: Adventtiaika, Jouluaika, Paastonaika, Kärsimysaika, Pääsiäinen, Pääsiäisaika and Helluntai. The one for a date is `propers.postCommunionPrayer` in the [day response](day-response.md).

```json
{
  "source": "Jumalanpalvelusten kirja (2000)",
  "kiitosrukouksetEhtoollinen": [
    { "season": "Adventtiaika", "slug": "adventtiaika", "texts": ["Herra, kaikkivaltias Jumala, …"] }
  ]
}
```
