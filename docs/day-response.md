# Day response

`GET /api/v1/today` and `GET /api/v1/date/:date` return everything that varies with the church year on that date. The MCP tool `church_day` returns the same object.

## Top level

| Field | Type | Description |
|---|---|---|
| `date` | string | `YYYY-MM-DD` |
| `dayOfWeek` | string | Finnish weekday (`maanantai` … `sunnuntai`) |
| `churchYear` | object | `start`, `label` (`"2025–2026"`), `yearCycle` (vuosikerta 1–3), `firstAdventSunday`, `easter`, `lastDay` |
| `season` | string | Jakso: `Joulujakso`, `Pääsiäisjakso`, `Helluntaijakso`, `Erityispyhät` |
| `period` | string | Aika, e.g. `Adventtiaika`, `Paastonaika`, `Helluntain jälkeinen aika` |
| `holyDay` | Day \| null | The date's own holy day, or `null` on a plain weekday |
| `additionalServices` | Day[] | Other days on the date: services (jouluyö, pääsiäisyö, Jeesuksen kuolinhetki), a Sunday that coincides with a feast, and observances (rukouspäivät, Pyhän Henrikin muistopäivä) |
| `weekdayMaterial` | Day \| null | On a weekday without its own holy day: the day whose texts, prayers and colour are used |
| `liturgicalColor` | Color | Colour of the day (see below) |
| `liturgy` | object | Seasonal rubrics of the Mass (see below) |

Add `?cycles=false` to leave out `allYearCycles` (about half the size).

### Weekday material

Weekdays use the material of the week's Sunday ("Arkipäivinä käytetään … aineistoa"), following the ELCF's perikooppikalenteri:

- after a feast that took a Sunday's place (kynttilänpäivä, Marian ilmestyspäivä, mikkelinpäivä) the **displaced Sunday's** material and colour are used from Monday
- Thursday–Saturday after Ash Wednesday use tuhkakeskiviikko, the days after Epiphany use loppiainen
- Dec 29–30 use 1. sunnuntai joulusta (or joulupäivä when Christmas Eve or Day was the Sunday), Jan 2–5 use 1. sunnuntai joulusta until 2. sunnuntai joulusta
- the 1st Advent week and the Pentecost week have their own weekday texts; Holy Week and Easter week days are holy days of their own

## Day

| Field | Type | Description |
|---|---|---|
| `name`, `slug` | string | Finnish name and identifier |
| `date` | string \| null | Date in the church year |
| `type` | string | `sunday`, `feast`, `day`, `service`, `observance`, `weekday`, or `weekdayMaterial` on a weekday using another day's material |
| `theme` | string \| null | Theme of the day, e.g. `"Kuninkaasi tulee nöyränä"` |
| `latinName` | string \| null | e.g. `Laetare`, `Rogate` |
| `alternativeName` | string \| null | e.g. `"3. joulupäivä"`, `"Enkelien sunnuntai"` |
| `season`, `period` | string | Jakso and aika |
| `description` | string | Introduction from Evankeliumikirja |
| `liturgicalColor` | Color | Colour of the day (on weekday material: the weekday colour) |
| `replaces` | string \| null | Slug of the Sunday whose place the feast takes |
| `altarCandles` | string \| null | Number of altar candles, e.g. "Kaksi alttarikynttilää" (Kirkkovuosikalenteri) |
| `materialFrom` | string | Only for 6. sunnuntai loppiaisesta: its texts come from 26. sunnuntai helluntaista |
| `texts` | Texts | Readings of the active year cycle |
| `allYearCycles` | object | Readings of all three cycles (days with cycles; omitted with `?cycles=false`) |
| `psalm` | object | `antiphon`, `antiphonReference`, `alternativeAntiphons`, `text`, `reference`, `gloriaPatri`, `alternativePsalm` |
| `hallelujah` | Verse \| null | Hallelujasäe |
| `psalmVerse` | Verse \| null | Psalmilause (Lent, used instead of the hallelujah) |
| `prayers` | array | `{ number, text }` — päivän rukoukset |
| `hymns` | object | `opening`, `dayHymns`, `additional`, `other` — `{ number, title }` |
| `propers` | object | `prefaatio`, `kyrieLitania`, `kertosae`, `postCommunionPrayer` (kiitosrukous ehtoollisen jälkeen); `null` where the book gives no seasonal text |
| `dailyLectionary` | object \| null | The prayer-hour texts of this day on this weekday: morning, midday and evening prayer, day's psalm, and on Sundays and holy days the first vespers, week's psalm and apocrypha. The evening is the next day's first vespers on the evening before a Sunday or feast (Saturday has no vespers of its own), and the day's second vespers on a Sunday or feast. See [daily-lectionary.md](daily-lectionary.md) |

### Texts

| Field | Description |
|---|---|
| `yearCycle` | Cycle the texts belong to |
| `sameInAllCycles` | `true` for days with one set of texts (jouluaatto, tuhkakeskiviikko, …) |
| `firstReading`, `secondReading`, `gospel` | Reading: `reference`, `bookIntro`, `text`, optional `alternatives` (TAI), optional `sameAsYearCycle` |
| `alternativeSermonTexts` | References of alternative sermon texts |
| `otReadings`, `ntReadings`, `readings`, `weekday: true` | Weekday material (1st Advent week, Pentecost week, Easter week days) |

### Verse

`{ text, reference, alternatives }`

### Color

| Field | Description |
|---|---|
| `color` | `valkoinen`, `violetti`, `sininen`, `vihreä`, `punainen` or `musta` |
| `alternatives` | Alternative colours, e.g. `["sininen"]` for "violetti tai sininen" |
| `english` | The same in English |
| `note` | Conditions from the book, e.g. jouluaatto on the 4th Sunday of Advent |
| `text` | The colour text as given in Evankeliumikirja |

## Liturgy

Rubrics of the Mass. The top-level `liturgy` is that of the day's main service; every day and service in the response (`holyDay`, each of `additionalServices`, `weekdayMaterial`) also carries its own `liturgy`. On Holy Saturday, for example, hiljainen lauantai and pääsiäisyö differ.

| Field | Rule |
|---|---|
| `gloria` | Kunnia ja kiitosvirsi is omitted in Advent (from the Monday after 1st Advent) and Lent (from Ash Wednesday). Kept on kiirastorstai, on Marian ilmestyspäivä (also in Passiontide) and at pääsiäisyö |
| `hallelujah` | Follows what Evankeliumikirja prints for the day: a hallelujah verse means it is sung, a psalm verse (psalmilause) means it is omitted. So Marian ilmestyspäivä keeps its hallelujah in Lent. Days that print neither follow the seasonal rule (omitted from Ash Wednesday) |
| `psalmVerseInsteadOfHallelujah` | The psalm verse (`psalmVerse`) is used instead of the hallelujah |
| `gloriaPatri` | Follows the day's psalm (`psalm.gloriaPatri`): Pieni kunnia is omitted from 5. paastonajan sunnuntai, except on Marian ilmestyspäivä; otherwise the seasonal rule |
| `notes` | The rubrics that apply, in Finnish |
| `source` | Jumalanpalvelusten kirja (2000) and Evankeliumikirja (2021) |
