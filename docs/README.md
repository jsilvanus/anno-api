# Kirkkovuosi API — Endpoint Documentation

REST API for the liturgical calendar of the Evangelical-Lutheran Church of Finland. All endpoints are `GET`, return JSON, and require no authentication.

Base URL: `http://localhost:3000`

---

## Today

Quick access to the current day's liturgical data without specifying a date.

| Endpoint | File | Description |
|---|---|---|
| `GET /api/v1/today` | [today.md](today.md) | Full church calendar info for today: holy day, readings, prayers, propers, hymns |
| `GET /api/v1/today/texts` | [today-texts.md](today-texts.md) | Bible readings for today (optionally a specific year cycle) |
| `GET /api/v1/today/prayer` | [today-prayer.md](today-prayer.md) | Collect prayer for today (random or by number) |
| `GET /api/v1/today/gospel` | [today-gospel.md](today-gospel.md) | Gospel reading for today |
| `GET /api/v1/today/propers` | [today-propers.md](today-propers.md) | Liturgical propers for today: preface, Kyrie litany, psalm refrain |

---

## Calendar by Date

Look up any date from 1900 to 2100.

| Endpoint | File | Description |
|---|---|---|
| `GET /api/v1/date/:date` | [date.md](date.md) | Full church calendar info for a specific date (`YYYY-MM-DD`) |
| `GET /api/v1/date/:date/color` | [date-color.md](date-color.md) | Liturgical color for a date |
| `GET /api/v1/date/:date/propers` | [date-propers.md](date-propers.md) | Liturgical propers for a date |

---

## Holy Days & Calendar Structure

Browse and query the underlying holy day data.

| Endpoint | File | Description |
|---|---|---|
| `GET /api/v1/days` | [days.md](days.md) | Index of all holy days with name, slug, season, and color |
| `GET /api/v1/holy-day/:slug` | [holy-day.md](holy-day.md) | Full data for a single holy day including readings for all three year cycles |
| `GET /api/v1/year/:year/calendar` | [year-calendar.md](year-calendar.md) | Ordered list of all entries in a church year with computed dates |
| `GET /api/v1/search/text?q=` | [search-text.md](search-text.md) | Search Sunday readings by Bible reference |

---

## Liturgical Propers (Jumalanpalvelusten kirja, 2000)

Full collections of each proper type from Kirkkokäsikirja I.

| Endpoint | File | Description |
|---|---|---|
| `GET /api/v1/propers/prefaatiot` | [propers-prefaatiot.md](propers-prefaatiot.md) | All seasonal preface endings |
| `GET /api/v1/propers/kyrie-litaniat` | [propers-kyrie-litaniat.md](propers-kyrie-litaniat.md) | All seasonal Kyrie litanies |
| `GET /api/v1/propers/synninpaastot` | [propers-synninpaastot.md](propers-synninpaastot.md) | All absolution texts |
| `GET /api/v1/propers/kiitosrukoukset` | [propers-kiitosrukoukset.md](propers-kiitosrukoukset.md) | All thanksgiving prayers after absolution |
| `GET /api/v1/propers/kertosaakeet` | [propers-kertosaakeet.md](propers-kertosaakeet.md) | All seasonal psalm refrains |
| `GET /api/v1/propers/improperia` | [propers-improperia.md](propers-improperia.md) | Good Friday Improperia texts |

---

## Lectionary Bible Index (Viikkolektionaari)

Index of all Bible passages used in the Evankeliumikirja and weekly lectionary, cross-referenced to their liturgical occasions. Source: *Viikkolektionaarin raamatunkohdat* (PDF).

| Endpoint | File | Description |
|---|---|---|
| `GET /api/v1/lectionary` | [lectionary.md](lectionary.md) | Index metadata: title, entry count, holy day count |
| `GET /api/v1/lectionary/holy-days` | [lectionary-holy-days.md](lectionary-holy-days.md) | Sorted list of all 176 liturgical occasion names in the index |
| `GET /api/v1/lectionary/by-holy-day?q=` | [lectionary-by-holy-day.md](lectionary-by-holy-day.md) | All Bible passages indexed to a given occasion |
| `GET /api/v1/lectionary/search?q=` | [lectionary-search.md](lectionary-search.md) | Search the index by Bible book or reference |

---

## Concepts

### Church year

The Finnish Lutheran church year begins on the **1st Advent Sunday** (nearest Sunday to November 30) and ends the Saturday before the next 1st Advent Sunday. The API computes this automatically for any date.

### Three-year lectionary cycle

Sunday readings rotate through three cycles (vuosikerta 1, 2, 3). The active cycle changes each 1st Advent Sunday. The API resolves the correct cycle for any given date.

### Propers vs. readings

- **Readings** (lukukappale, evankeliumi): Bible texts from the Evankeliumikirja — specific to each holy day and year cycle.
- **Propers** (prefaatio, kyrie-litania, kertosäe, synninpäästö): Liturgical formulae from the Jumalanpalvelusten kirja — shared by all days within a season.

### Lectionary index vs. search/text

| | `GET /api/v1/search/text` | `GET /api/v1/lectionary/search` |
|---|---|---|
| Source | Evankeliumikirja | Evankeliumikirja + Viikkolektionaari |
| Scope | Sunday readings only | Sundays + weekdays, psalms, antiphons, vigils |
| Entries | ~300 reference hits | 2073 entries |

---

## Data sources

| Data | Source |
|---|---|
| Lectionary readings | Evankeliumikirja (Kirkkokäsikirja II, 2021) |
| Liturgical propers | Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000) |
| Lectionary Bible index | Viikkolektionaarin raamatunkohdat (PDF) |
| Easter computation | Anonymous Gregorian algorithm (Meeus/Jones/Butcher) |
