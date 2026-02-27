/**
 * Computus — Easter date calculation and church calendar computation
 *
 * Calculates Easter Sunday using the Anonymous Gregorian algorithm (Meeus),
 * then derives all moveable feasts from it.
 */

/**
 * Calculate Easter Sunday for a given year (Gregorian calendar).
 * Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
 * @param {number} year
 * @returns {Date}
 */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return makeDate(year, month, day);
}

/**
 * Create a date at midnight UTC (no timezone issues).
 */
export function makeDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Add days to a date.
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday).
 */
function dayOfWeek(date) {
  return date.getUTCDay();
}

/**
 * Find the nearest Sunday to a given date.
 * @param {Date} date
 * @returns {Date} The Sunday closest to the date
 */
function nearestSunday(date) {
  const dow = dayOfWeek(date);
  if (dow === 0) return new Date(date);
  if (dow <= 3) return addDays(date, -dow); // Go back to previous Sunday
  return addDays(date, 7 - dow); // Go forward to next Sunday
}

/**
 * Find the Sunday on or before a given date.
 */
function sundayOnOrBefore(date) {
  const dow = dayOfWeek(date);
  return addDays(date, -dow);
}

/**
 * Find the Sunday on or after a given date.
 */
function sundayOnOrAfter(date) {
  const dow = dayOfWeek(date);
  if (dow === 0) return new Date(date);
  return addDays(date, 7 - dow);
}

/**
 * Find a specific weekday (0=Sun..6=Sat) on or before a given date.
 */
function weekdayOnOrBefore(date, weekday) {
  const dow = dayOfWeek(date);
  const diff = (dow - weekday + 7) % 7;
  return addDays(date, -diff);
}

/**
 * Find a specific weekday on or after a given date.
 */
function weekdayOnOrAfter(date, weekday) {
  const dow = dayOfWeek(date);
  const diff = (weekday - dow + 7) % 7;
  return addDays(date, diff);
}

/**
 * Saturday on or before a given date.
 */
function saturdayOnOrBefore(date) {
  return weekdayOnOrBefore(date, 6);
}

/**
 * Compare two dates (date part only).
 */
export function sameDay(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();
}

/**
 * Format date as YYYY-MM-DD.
 */
export function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse YYYY-MM-DD string to Date.
 */
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return makeDate(y, m, d);
}

// ─── Church Calendar Generation ─────────────────────────────────────────────

/**
 * Generate the complete church calendar for a church year.
 *
 * A church year runs from 1st Advent Sunday of the starting year
 * to the Saturday before 1st Advent Sunday of the next year.
 *
 * @param {number} startYear — The calendar year in which this church year begins
 *   (e.g. 2025 for church year 2025–2026)
 * @returns {Array<{date: Date, slug: string, name: string, type: string}>}
 */
export function generateChurchYear(startYear) {
  const easter = easterSunday(startYear + 1); // Easter is in the next calendar year
  const entries = [];

  // Helper to add an entry
  const add = (date, slug, name, type = 'sunday') => {
    entries.push({ date, slug, name, type, dateStr: formatDate(date) });
  };

  // ─── 1st Advent Sunday ─────────────────────────────────────────────
  // Nearest Sunday to November 30
  const advent1 = nearestSunday(makeDate(startYear, 11, 30));
  add(advent1, '1-adventtisunnuntai', '1. adventtisunnuntai');

  // Advent weekdays (Monday after 1st Advent to Saturday before 2nd Advent)
  addWeekdays(entries, advent1, '1-adventtisunnuntain-jalkeinen-viikko', '1. adventtisunnuntain jälkeinen viikko');

  // 2nd–4th Advent Sundays
  const advent2 = addDays(advent1, 7);
  add(advent2, '2-adventtisunnuntai', '2. adventtisunnuntai');
  const advent3 = addDays(advent1, 14);
  add(advent3, '3-adventtisunnuntai', '3. adventtisunnuntai');
  const advent4 = addDays(advent1, 21);
  add(advent4, '4-adventtisunnuntai', '4. adventtisunnuntai');

  // ─── Christmas season ──────────────────────────────────────────────
  const christmas = makeDate(startYear, 12, 25);
  add(makeDate(startYear, 12, 24), 'jouluaatto', 'Jouluaatto', 'feast');
  // Jouluyö (Christmas Eve night service) - same date as jouluaatto
  // jouluaamu - Christmas morning, same date as joulupäivä
  add(christmas, 'joulupaiva', 'Joulupäivä', 'feast');

  add(makeDate(startYear, 12, 26), 'tapaninpaiva', 'Tapaninpäivä', 'feast');
  add(makeDate(startYear, 12, 27), 'apostoli-johanneksen-paiva', 'Apostoli Johanneksen päivä', 'feast');
  add(makeDate(startYear, 12, 28), 'viattomien-lasten-paiva', 'Viattomien lasten päivä', 'feast');

  // 1st Sunday after Christmas (between Dec 27 and Jan 2)
  const sun1christmas = sundayAfterInRange(christmas, makeDate(startYear, 12, 27), makeDate(startYear + 1, 1, 2));
  if (sun1christmas) {
    add(sun1christmas, '1-sunnuntai-joulusta', '1. sunnuntai joulusta');
  }

  add(makeDate(startYear, 12, 31), 'uudenvuodenaatto', 'Uudenvuodenaatto', 'feast');
  add(makeDate(startYear + 1, 1, 1), 'uudenvuodenpaiva', 'Uudenvuodenpäivä', 'feast');

  // 2nd Sunday after Christmas (between Jan 2 and Jan 5)
  const sun2christmas = sundayAfterInRange(makeDate(startYear + 1, 1, 1), makeDate(startYear + 1, 1, 2), makeDate(startYear + 1, 1, 5));
  if (sun2christmas) {
    add(sun2christmas, '2-sunnuntai-joulusta', '2. sunnuntai joulusta');
  }

  // ─── Epiphany season ───────────────────────────────────────────────
  const epiphany = makeDate(startYear + 1, 1, 6);
  add(epiphany, 'loppiainen', 'Loppiainen', 'feast');

  // Sundays after Epiphany (1st through up to 6th)
  // These fill the gap between Epiphany and the pre-Lent Sundays
  const septuagesima = addDays(easter, -63); // 3rd Sunday before Lent
  let epiphanySunday = sundayOnOrAfter(addDays(epiphany, 1));
  let epiphanyCount = 1;
  while (epiphanySunday < septuagesima && epiphanyCount <= 6) {
    add(epiphanySunday, `${epiphanyCount}-sunnuntai-loppiaisesta`, `${epiphanyCount}. sunnuntai loppiaisesta`);
    epiphanySunday = addDays(epiphanySunday, 7);
    epiphanyCount++;
  }

  // ─── Pre-Lent Sundays ─────────────────────────────────────────────
  add(septuagesima, '3-sunnuntai-ennen-paastonaikaa', '3. sunnuntai ennen paastonaikaa');
  const sexagesima = addDays(easter, -56);
  add(sexagesima, '2-sunnuntai-ennen-paastonaikaa', '2. sunnuntai ennen paastonaikaa');
  const estoMihi = addDays(easter, -49);
  add(estoMihi, 'laskiaissunnuntai', 'Laskiaissunnuntai');

  // ─── Lent ──────────────────────────────────────────────────────────
  const ashWednesday = addDays(easter, -46);
  add(ashWednesday, 'tuhkakeskiviikko', 'Tuhkakeskiviikko', 'weekday');

  for (let i = 1; i <= 5; i++) {
    const lentSunday = addDays(easter, -49 + i * 7);
    add(lentSunday, `${i}-paastonajan-sunnuntai`, `${i}. paastonajan sunnuntai`);
  }

  // ─── Holy Week ─────────────────────────────────────────────────────
  const palmSunday = addDays(easter, -7);
  add(palmSunday, 'palmusunnuntai', 'Palmusunnuntai');
  add(addDays(easter, -6), 'hiljaisen-viikon-maanantai', 'Hiljaisen viikon maanantai', 'weekday');
  add(addDays(easter, -5), 'hiljaisen-viikon-tiistai', 'Hiljaisen viikon tiistai', 'weekday');
  add(addDays(easter, -4), 'hiljaisen-viikon-keskiviikko', 'Hiljaisen viikon keskiviikko', 'weekday');
  add(addDays(easter, -3), 'kiirastorstai', 'Kiirastorstai', 'feast');
  add(addDays(easter, -2), 'pitkaperjantai', 'Pitkäperjantai', 'feast');
  add(addDays(easter, -2), 'jeesuksen-kuolinhetki', 'Jeesuksen kuolinhetki', 'service');
  add(addDays(easter, -2), 'pitkaperjantain-ilta', 'Pitkäperjantain ilta', 'service');
  add(addDays(easter, -1), 'hiljainen-lauantai', 'Hiljainen lauantai', 'weekday');

  // ─── Easter ────────────────────────────────────────────────────────
  add(addDays(easter, -1), 'paasiaisyo', 'Pääsiäisyö', 'service'); // Easter vigil (Saturday evening)
  add(easter, 'paasiaispaiva', 'Pääsiäispäivä', 'feast');
  add(addDays(easter, 1), '2-paasiaispaiva', '2. pääsiäispäivä', 'feast');

  // Easter week
  add(addDays(easter, 2), 'paasiaisen-jalkeinen-tiistai', 'Pääsiäisen jälkeinen tiistai', 'weekday');
  add(addDays(easter, 3), 'paasiaisen-jalkeinen-keskiviikko', 'Pääsiäisen jälkeinen keskiviikko', 'weekday');
  add(addDays(easter, 4), 'paasiaisen-jalkeinen-torstai', 'Pääsiäisen jälkeinen torstai', 'weekday');
  add(addDays(easter, 5), 'paasiaisen-jalkeinen-perjantai', 'Pääsiäisen jälkeinen perjantai', 'weekday');
  add(addDays(easter, 6), 'paasiaisen-jalkeinen-lauantai', 'Pääsiäisen jälkeinen lauantai', 'weekday');

  // Sundays after Easter
  for (let i = 1; i <= 6; i++) {
    const sunAfterEaster = addDays(easter, i * 7);
    add(sunAfterEaster, `${i}-sunnuntai-paasiaisesta`, `${i}. sunnuntai pääsiäisestä`);
  }

  // ─── Ascension ─────────────────────────────────────────────────────
  const ascension = addDays(easter, 39);
  add(ascension, 'helatorstai', 'Helatorstai', 'feast');

  // ─── Pentecost ─────────────────────────────────────────────────────
  const pentecost = addDays(easter, 49);
  add(addDays(pentecost, -1), 'helluntaiaatto', 'Helluntaiaatto', 'service');
  add(pentecost, 'helluntaipaiva', 'Helluntaipäivä', 'feast');

  // Pentecost week
  addWeekdays(entries, pentecost, 'helluntain-jalkeinen-viikko-eli-helluntaiviikko', 'Helluntain jälkeinen viikko');

  // ─── Trinity and Sundays after Pentecost ──────────────────────────
  const trinity = addDays(pentecost, 7);
  add(trinity, 'pyhan-kolminaisuuden-paiva', 'Pyhän Kolminaisuuden päivä');

  // Calculate next church year's start to know when to stop
  const nextAdvent1 = nearestSunday(makeDate(startYear + 1, 11, 30));

  // Sundays after Pentecost: numbered 2–26, some are fixed feasts
  // Count backwards from Advent to determine which Sundays are used.
  // Tuomiosunnuntai = last Sunday before Advent
  // Valvomisen sunnuntai = 2nd last Sunday before Advent
  const tuomiosunnuntai = addDays(nextAdvent1, -7);
  const valvomisenSunnuntai = addDays(nextAdvent1, -14);

  // Generate all Sundays from 2nd after Pentecost to Tuomiosunnuntai
  const pentecostSundays = [];
  let currentSunday = addDays(pentecost, 14); // 2nd Sunday after Pentecost
  let sundayNumber = 2;

  while (currentSunday <= tuomiosunnuntai) {
    pentecostSundays.push({ date: currentSunday, number: sundayNumber });
    currentSunday = addDays(currentSunday, 7);
    sundayNumber++;
  }

  // Map the numbered Sundays, handling special feasts
  // Fixed mappings:
  //  6. shel = Apostolien päivä
  //  8. shel = Kirkastussunnuntai (Transfiguration)
  // 22. shel = Reformaation päivä
  // 2nd last = Valvomisen sunnuntai
  // Last = Tuomiosunnuntai

  // The Sundays are numbered starting from Pentecost and ending at Advent
  // Total available slots determines which numbers get used
  const totalPentecostSundays = pentecostSundays.length;

  for (let i = 0; i < pentecostSundays.length; i++) {
    const { date } = pentecostSundays[i];
    // Calculate the actual number based on position
    // Number from Pentecost: 2, 3, 4, 5, 6(Apos), 7, 8(Kirk), 9, 10...
    // Number counting back from end: ..., Val, Tuo
    const fromStart = i + 2; // 2-based index
    const fromEnd = pentecostSundays.length - i; // 1 = last, 2 = 2nd last

    if (fromEnd === 1) {
      // Tuomiosunnuntai (last before Advent)
      add(date, 'tuomiosunnuntai', 'Tuomiosunnuntai');
    } else if (fromEnd === 2) {
      // Valvomisen sunnuntai
      add(date, 'valvomisen-sunnuntai', 'Valvomisen sunnuntai');
    } else if (fromStart === 6) {
      add(date, 'apostolien-paiva', 'Apostolien päivä');
    } else if (fromStart === 8) {
      add(date, 'kirkastussunnuntai', 'Kirkastussunnuntai');
    } else if (fromStart === 22) {
      add(date, 'reformaation-paiva', 'Reformaation päivä');
    } else {
      add(date, `${fromStart}-sunnuntai-helluntaista`, `${fromStart}. sunnuntai helluntaista`);
    }
  }

  // ─── Special feasts (pistepyhät) with fixed/semi-fixed dates ──────

  // Kynttilänpäivä (Candlemas) = Feb 2
  add(makeDate(startYear + 1, 2, 2), 'kynttilanpaiva', 'Kynttilänpäivä', 'special');

  // Marian ilmestyspäivä (Annunciation) = Mar 25
  // (shifts if it falls in Holy Week or Easter — we'll handle displacement later)
  const annunciation = makeDate(startYear + 1, 3, 25);
  if (annunciation < addDays(easter, -6) || annunciation > addDays(easter, 7)) {
    add(annunciation, 'marian-ilmestyspaiva', 'Marian ilmestyspäivä', 'special');
  }
  // TODO: displaced Annunciation handling

  // Juhannuspäivä (Midsummer / John the Baptist) = Saturday between Jun 20–26
  const juhannuspaiva = saturdayOnOrBefore(makeDate(startYear + 1, 6, 26));
  if (juhannuspaiva >= makeDate(startYear + 1, 6, 20)) {
    add(juhannuspaiva, 'juhannuspaiva', 'Juhannuspäivä', 'special');
  }

  // Mikkelinpäivä (Michaelmas) = Sunday between Sep 29 – Oct 5
  const mikkelTarget = makeDate(startYear + 1, 9, 29);
  const mikkelinpaiva = sundayOnOrAfter(mikkelTarget);
  if (mikkelinpaiva <= makeDate(startYear + 1, 10, 5)) {
    add(mikkelinpaiva, 'mikkelinpaiva', 'Mikkelinpäivä', 'special');
  }

  // Pyhäinpäivä (All Saints) = Saturday between Oct 31 – Nov 6
  const pyhainpaiva = saturdayOnOrBefore(makeDate(startYear + 1, 11, 6));
  if (pyhainpaiva >= makeDate(startYear + 1, 10, 31)) {
    add(pyhainpaiva, 'pyhainpaiva', 'Pyhäinpäivä', 'special');
  }

  // Pyhän Henrikin muistopäivä = Jan 19
  add(makeDate(startYear + 1, 1, 19), 'pyhan-henrikin-muistopaiva', 'Pyhän Henrikin muistopäivä', 'special');

  // Itsenäisyyspäivä = Dec 6
  add(makeDate(startYear + 1, 12, 6), 'itsenaisyyspaiva', 'Itsenäisyyspäivä', 'special');

  // Kansalliset rukouspäivät = Jan 18 and Oct 24
  add(makeDate(startYear + 1, 1, 18), 'kansalliset-rukouspaivat', 'Kristittyjen ykseyden rukouspäivä', 'special');
  add(makeDate(startYear + 1, 10, 24), 'kansalliset-rukouspaivat', 'Rauhan, ihmisoikeuksien ja kansainvälisen vastuun rukouspäivä', 'special');

  // ─── Floating special Sundays ─────────────────────────────────────
  // Luomakunnan sunnuntai = typically 2nd Sunday in May or as designated
  // Perheen sunnuntai = typically 2nd Sunday of October
  // These are assigned to an existing Pentecost Sunday slot and override it.
  // For now, we add them as separate entries; the resolver can handle precedence.

  // Sort by date
  entries.sort((a, b) => a.date - b.date);

  return entries;
}

/**
 * Add weekday entries (Mon–Sat) for the week following a Sunday.
 */
function addWeekdays(entries, sunday, slug, name) {
  for (let d = 1; d <= 6; d++) {
    const date = addDays(sunday, d);
    entries.push({
      date,
      slug,
      name,
      type: 'weekday',
      dateStr: formatDate(date),
    });
  }
}

/**
 * Find the first Sunday strictly after `after` and within the range [rangeStart, rangeEnd].
 */
function sundayAfterInRange(after, rangeStart, rangeEnd) {
  let candidate = sundayOnOrAfter(addDays(after, 1));
  if (candidate >= rangeStart && candidate <= rangeEnd) {
    return candidate;
  }
  return null;
}

// ─── Year Cycle Calculation ─────────────────────────────────────────────────

/**
 * Determine which lectionary year cycle (1, 2, or 3) applies
 * for a given church year.
 *
 * The cycle changes at 1st Advent Sunday.
 * Convention: we use (churchYearStartYear % 3) mapping:
 *   0 → cycle 1, 1 → cycle 2, 2 → cycle 3
 *
 * @param {number} churchYearStartYear
 * @returns {number} 1, 2, or 3
 */
export function getYearCycle(churchYearStartYear) {
  return (churchYearStartYear % 3) + 1;
}

/**
 * Determine the church year start year for a given calendar date.
 * The church year starts on 1st Advent Sunday.
 *
 * @param {Date} date
 * @returns {number} The year in which this church year began
 */
export function getChurchYearStart(date) {
  const year = date.getUTCFullYear();

  // Check if date is before 1st Advent of this calendar year
  const advent1ThisYear = nearestSunday(makeDate(year, 11, 30));

  if (date < advent1ThisYear) {
    return year - 1; // We're still in the previous church year
  }
  return year;
}
