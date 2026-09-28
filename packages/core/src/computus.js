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
export function dayOfWeek(date) {
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
export function sundayOnOrBefore(date) {
  const dow = dayOfWeek(date);
  return addDays(date, -dow);
}

/**
 * Find the Sunday on or after a given date.
 */
export function sundayOnOrAfter(date) {
  const dow = dayOfWeek(date);
  if (dow === 0) return new Date(date);
  return addDays(date, 7 - dow);
}
/**
 * Find a specific weekday (0=Sun..6=Sat) on or after a given date.
 */
export function weekdayOnOrAfter(date, weekday) {
  const diff = (weekday - dayOfWeek(date) + 7) % 7;
  return addDays(date, diff);
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
//
// Rules follow the Kirkkojärjestys and the ELCF's published
// perikooppikalenterit (refs/perikooppikalenterit/), which the test suite
// checks against for church years 2021–2029.

/**
 * Entry types, in the order they are listed for a date:
 *
 *   sunday     — regular Sunday of the church year (temporale)
 *   feast      — holy day with its own date (may take a Sunday's place)
 *   day        — named weekday with its own material (Holy Week, Easter week, Ash Wednesday)
 *   service    — additional service on the same date (jouluyö, pääsiäisyö, …)
 *   observance — prayer / memorial day that does not displace the day (rukouspäivät, Pyhä Henrik)
 *   weekday    — weekday of a week that has its own weekday material
 *                (1st Advent week, Pentecost week)
 */
export const ENTRY_TYPES = ['sunday', 'feast', 'day', 'service', 'observance', 'weekday'];

/**
 * 1st Advent Sunday of a calendar year: the Sunday between Nov 27 and Dec 3.
 */
export function firstAdventSunday(year) {
  return nearestSunday(makeDate(year, 11, 30));
}

/**
 * The regular Sunday slots (temporale) of a church year, before any feast
 * takes their place. Returns [{ date, slug, name }].
 */
function regularSundays(startYear) {
  const easter = easterSunday(startYear + 1);
  const advent1 = firstAdventSunday(startYear);
  const nextAdvent1 = firstAdventSunday(startYear + 1);
  const christmas = makeDate(startYear, 12, 25);
  const epiphany = makeDate(startYear + 1, 1, 6);
  const septuagesima = addDays(easter, -63);
  const trinity = addDays(easter, 56);
  const valvomisen = addDays(nextAdvent1, -14);
  const tuomio = addDays(nextAdvent1, -7);

  const slots = [];
  const add = (date, slug, name, type = 'sunday') => slots.push({ date, slug, name, type });

  for (let i = 0; i < 4; i++) {
    add(addDays(advent1, i * 7), `${i + 1}-adventtisunnuntai`, `${i + 1}. adventtisunnuntai`);
  }

  // Christmas: Sunday Dec 26–31 is the 1st Sunday after Christmas, Jan 2–5 the 2nd.
  // (A Sunday on Dec 25, Jan 1 or Jan 6 is that feast and has no Sunday slot.)
  const sunAfterChristmas = sundayOnOrAfter(addDays(christmas, 1));
  if (sunAfterChristmas <= makeDate(startYear, 12, 31)) {
    add(sunAfterChristmas, '1-sunnuntai-joulusta', '1. sunnuntai joulusta');
  }
  const sunAfterNewYear = sundayOnOrAfter(makeDate(startYear + 1, 1, 2));
  if (sunAfterNewYear <= makeDate(startYear + 1, 1, 5)) {
    add(sunAfterNewYear, '2-sunnuntai-joulusta', '2. sunnuntai joulusta');
  }

  // Sundays after Epiphany until the 3rd Sunday before Lent
  let sunday = sundayOnOrAfter(addDays(epiphany, 1));
  for (let n = 1; sunday < septuagesima && n <= 6; n++, sunday = addDays(sunday, 7)) {
    add(sunday, `${n}-sunnuntai-loppiaisesta`, `${n}. sunnuntai loppiaisesta`);
  }

  add(septuagesima, '3-sunnuntai-ennen-paastonaikaa', '3. sunnuntai ennen paastonaikaa');
  add(addDays(easter, -56), '2-sunnuntai-ennen-paastonaikaa', '2. sunnuntai ennen paastonaikaa');
  add(addDays(easter, -49), 'laskiaissunnuntai', 'Laskiaissunnuntai');
  for (let i = 1; i <= 5; i++) {
    add(addDays(easter, -49 + i * 7), `${i}-paastonajan-sunnuntai`, `${i}. paastonajan sunnuntai`);
  }
  add(addDays(easter, -7), 'palmusunnuntai', 'Palmusunnuntai');
  add(easter, 'paasiaispaiva', 'Pääsiäispäivä', 'feast');
  for (let i = 1; i <= 6; i++) {
    add(addDays(easter, i * 7), `${i}-sunnuntai-paasiaisesta`, `${i}. sunnuntai pääsiäisestä`);
  }
  add(addDays(easter, 49), 'helluntaipaiva', 'Helluntaipäivä', 'feast');
  add(trinity, 'pyhan-kolminaisuuden-paiva', 'Pyhän Kolminaisuuden päivä');

  // Sundays after Pentecost are numbered from Trinity. The last two before
  // Advent are always Valvomisen sunnuntai and Tuomiosunnuntai; numbered
  // Sundays that do not fit are dropped from the end (26., 25., …).
  sunday = addDays(trinity, 7);
  for (let n = 2; sunday < valvomisen; n++, sunday = addDays(sunday, 7)) {
    if (n === 6) add(sunday, 'apostolien-paiva', 'Apostolien päivä');
    else if (n === 8) add(sunday, 'kirkastussunnuntai', 'Kirkastussunnuntai');
    else if (n === 22) add(sunday, 'reformaation-paiva', 'Reformaation päivä');
    else add(sunday, `${n}-sunnuntai-helluntaista`, `${n}. sunnuntai helluntaista`);
  }
  add(valvomisen, 'valvomisen-sunnuntai', 'Valvomisen sunnuntai');
  add(tuomio, 'tuomiosunnuntai', 'Tuomiosunnuntai');

  return slots;
}

/**
 * Generate the complete church calendar for a church year.
 *
 * A church year runs from 1st Advent Sunday of the starting year
 * to the Saturday before 1st Advent Sunday of the next year.
 *
 * Each Sunday carries `sundaySlug`: the regular Sunday of that week. When a
 * feast takes the Sunday's place (e.g. Marian ilmestyspäivä on 5. paastonajan
 * sunnuntai), `replaces` names the displaced Sunday. The weekdays that follow
 * use the displaced Sunday's material.
 *
 * @param {number} startYear — The calendar year in which this church year begins
 *   (e.g. 2025 for church year 2025–2026)
 * @returns {Array<{date: Date, dateStr: string, slug: string, name: string, type: string}>}
 */
export function generateChurchYear(startYear) {
  const easter = easterSunday(startYear + 1);
  const advent1 = firstAdventSunday(startYear);
  const nextAdvent1 = firstAdventSunday(startYear + 1);
  const y1 = startYear + 1;
  const entries = [];
  let order = 0;

  const add = (date, slug, name, type, extra = {}) => {
    entries.push({ date, dateStr: formatDate(date), slug, name, type, order: order++, ...extra });
  };

  // ─── Sundays, with feasts that take a Sunday's place ──────────────
  const sundays = new Map(); // dateStr → slot
  for (const slot of regularSundays(startYear)) sundays.set(formatDate(slot.date), slot);

  const takeSunday = (date, slug, name) => {
    const slot = sundays.get(formatDate(date));
    if (!slot) return null;
    sundays.set(formatDate(date), { date, slug, name, replaces: slot.slug, type: 'feast' });
    return slot;
  };

  // Kynttilänpäivä: Sunday Feb 2–8; if that is Laskiaissunnuntai, the Sunday before.
  let kynttilanpaiva = sundayOnOrAfter(makeDate(y1, 2, 2));
  if (sameDay(kynttilanpaiva, addDays(easter, -49))) kynttilanpaiva = addDays(kynttilanpaiva, -7);
  takeSunday(kynttilanpaiva, 'kynttilanpaiva', 'Kynttilänpäivä');

  // Marian ilmestyspäivä: Sunday Mar 22–28; if Palm Sunday or Easter Day,
  // the Sunday before Palm Sunday.
  let marianpaiva = sundayOnOrAfter(makeDate(y1, 3, 22));
  if (marianpaiva >= addDays(easter, -7)) marianpaiva = addDays(easter, -14);
  takeSunday(marianpaiva, 'marian-ilmestyspaiva', 'Marian ilmestyspäivä');

  // Mikkelinpäivä: Sunday Sep 29 – Oct 5.
  takeSunday(sundayOnOrAfter(makeDate(y1, 9, 29)), 'mikkelinpaiva', 'Mikkelinpäivä');

  // Christmas octave: a Sunday on Dec 26–28 is that feast day.
  takeSunday(makeDate(startYear, 12, 26), 'tapaninpaiva', 'Tapaninpäivä');
  takeSunday(makeDate(startYear, 12, 27), 'apostoli-johanneksen-paiva', 'Apostoli Johanneksen päivä');
  takeSunday(makeDate(startYear, 12, 28), 'viattomien-lasten-paiva', 'Viattomien lasten päivä');

  const fixedFeastSlugs = new Set(['tapaninpaiva', 'apostoli-johanneksen-paiva', 'viattomien-lasten-paiva']);

  // ─── Fixed and moveable days, in date order ───────────────────────
  // Days that fall on a Sunday are added together with the Sunday in listing order.
  const dayEntries = [];
  const day = (date, slug, name, type, extra) => dayEntries.push({ date, slug, name, type, extra });

  day(makeDate(startYear, 12, 6), 'itsenaisyyspaiva', 'Itsenäisyyspäivä', 'feast', { before: true });
  day(makeDate(startYear, 12, 24), 'jouluaatto', 'Jouluaatto', 'feast');
  day(makeDate(startYear, 12, 24), 'jouluyo', 'Jouluyö', 'service');
  day(makeDate(startYear, 12, 25), 'jouluaamu', 'Jouluaamu', 'service');
  day(makeDate(startYear, 12, 25), 'joulupaiva', 'Joulupäivä', 'feast', { primary: true });
  for (const [d, slug, name] of [
    [26, 'tapaninpaiva', 'Tapaninpäivä'],
    [27, 'apostoli-johanneksen-paiva', 'Apostoli Johanneksen päivä'],
    [28, 'viattomien-lasten-paiva', 'Viattomien lasten päivä'],
  ]) {
    const date = makeDate(startYear, 12, d);
    if (dayOfWeek(date) !== 0) day(date, slug, name, 'feast');
  }
  day(makeDate(startYear, 12, 31), 'uudenvuodenaatto', 'Uudenvuodenaatto', dayOfWeek(makeDate(startYear, 12, 31)) === 0 ? 'service' : 'feast');
  day(makeDate(y1, 1, 1), 'uudenvuodenpaiva', 'Uudenvuodenpäivä', 'feast');
  day(makeDate(y1, 1, 6), 'loppiainen', 'Loppiainen', 'feast');
  day(makeDate(y1, 1, 18), 'kristittyjen-ykseyden-rukouspaiva', 'Kristittyjen ykseyden rukouspäivä', 'observance');
  day(makeDate(y1, 1, 19), 'pyhan-henrikin-muistopaiva', 'Pyhän Henrikin muistopäivä', 'observance');
  day(addDays(easter, -46), 'tuhkakeskiviikko', 'Tuhkakeskiviikko', 'day');
  day(addDays(easter, -6), 'hiljaisen-viikon-maanantai', 'Hiljaisen viikon maanantai', 'day');
  day(addDays(easter, -5), 'hiljaisen-viikon-tiistai', 'Hiljaisen viikon tiistai', 'day');
  day(addDays(easter, -4), 'hiljaisen-viikon-keskiviikko', 'Hiljaisen viikon keskiviikko', 'day');
  day(addDays(easter, -3), 'kiirastorstai', 'Kiirastorstai', 'feast');
  day(addDays(easter, -2), 'pitkaperjantai', 'Pitkäperjantai', 'feast');
  day(addDays(easter, -2), 'jeesuksen-kuolinhetki', 'Jeesuksen kuolinhetki', 'service');
  day(addDays(easter, -2), 'pitkaperjantain-ilta', 'Pitkäperjantain ilta', 'service');
  day(addDays(easter, -1), 'hiljainen-lauantai', 'Hiljainen lauantai', 'day');
  day(addDays(easter, -1), 'paasiaisyo', 'Pääsiäisyö', 'service');
  day(addDays(easter, 1), '2-paasiaispaiva', '2. pääsiäispäivä', 'feast');
  const easterWeek = ['tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai'];
  easterWeek.forEach((weekday, i) => {
    day(addDays(easter, 2 + i), `paasiaisen-jalkeinen-${weekday}`, `Pääsiäisen jälkeinen ${weekday}`, 'day');
  });
  day(addDays(easter, 39), 'helatorstai', 'Helatorstai', 'feast');
  day(addDays(easter, 48), 'helluntaiaatto', 'Helluntaiaatto', 'feast');
  // Juhannuspäivä: Saturday Jun 20–26. Pyhäinpäivä: Saturday Oct 31 – Nov 6.
  day(weekdayOnOrAfter(makeDate(y1, 6, 20), 6), 'juhannuspaiva', 'Juhannuspäivä', 'feast');
  day(makeDate(y1, 10, 24), 'rauhan-rukouspaiva', 'Rauhan, ihmisoikeuksien ja kansainvälisen vastuun rukouspäivä', 'observance');
  day(weekdayOnOrAfter(makeDate(y1, 10, 31), 6), 'pyhainpaiva', 'Pyhäinpäivä', 'feast');

  // Weeks with their own weekday material
  addWeekdays(dayEntries, advent1, '1-adventtisunnuntain-jalkeinen-viikko', '1. adventtisunnuntain jälkeinen viikko');
  addWeekdays(dayEntries, addDays(easter, 49), 'helluntain-jalkeinen-viikko-eli-helluntaiviikko', 'Helluntain jälkeinen viikko eli helluntaiviikko');

  // ─── Merge into one ordered list ──────────────────────────────────
  const byDate = new Map();
  const bucket = key => {
    if (!byDate.has(key)) byDate.set(key, []);
    return byDate.get(key);
  };
  for (const [key, slot] of sundays) {
    bucket(key).push({ ...slot, sundaySlug: slot.replaces || slot.slug });
  }
  for (const d of dayEntries) {
    const key = formatDate(d.date);
    if (d.date < advent1 || d.date >= nextAdvent1) continue;
    const list = bucket(key);
    const entry = { date: d.date, slug: d.slug, name: d.name, type: d.type };
    // Feasts with their own date are listed before the Sunday only where the
    // official calendar does so (Itsenäisyyspäivä, Joulupäivä); otherwise the Sunday comes first.
    if (d.extra?.before || d.extra?.primary) list.unshift(entry);
    else list.push(entry);
  }
  const keys = [...byDate.keys()].sort();
  for (const key of keys) {
    const list = byDate.get(key);
    // Weekday-material entries are listed last: a holy day on the same date comes first.
    list.sort((a, b) => (a.type === 'weekday') - (b.type === 'weekday'));
    for (const e of list) add(e.date, e.slug, e.name, e.type, {
      ...(e.replaces ? { replaces: e.replaces } : {}),
      ...(e.sundaySlug ? { sundaySlug: e.sundaySlug } : {}),
    });
  }

  return entries;
}

/**
 * Add weekday entries (Mon–Sat) for the week following a Sunday.
 */
function addWeekdays(entries, sunday, slug, name) {
  for (let d = 1; d <= 6; d++) {
    entries.push({ date: addDays(sunday, d), slug, name, type: 'weekday' });
  }
}

// ─── Weekday material ───────────────────────────────────────────────────────

/**
 * Which day's material (readings, prayers, psalm) is used on a weekday that
 * has no holy day of its own.
 *
 * Per the perikooppikalenteri notes ("Arkipäivinä … käytetään … aineistoa"):
 * the week's regular Sunday, even when a feast took its place; the days after
 * Ash Wednesday and Epiphany use that day's material; around New Year the
 * material of the Sundays after Christmas (or Christmas Day) is used.
 *
 * @param {Array} calendar — output of generateChurchYear
 * @param {Date} date
 * @returns {string|null} slug of the day whose material is used
 */
export function weekdayMaterialSlug(calendar, date) {
  const month = date.getUTCMonth() + 1;
  const dom = date.getUTCDate();
  const sunday = sundayOnOrBefore(date);
  const sundayEntry = calendar.find(e => e.sundaySlug && sameDay(e.date, sunday));

  if (month === 12 && (dom === 29 || dom === 30)) {
    const sundayDom = sunday.getUTCDate();
    return sunday.getUTCMonth() === 11 && (sundayDom === 24 || sundayDom === 25) ? 'joulupaiva' : '1-sunnuntai-joulusta';
  }
  if (month === 1 && dom >= 2 && dom <= 5) {
    return sundayEntry?.sundaySlug === '2-sunnuntai-joulusta' ? '2-sunnuntai-joulusta' : '1-sunnuntai-joulusta';
  }
  if (month === 1 && dom >= 7 && (sunday.getUTCMonth() === 11 || sunday.getUTCDate() <= 6)) {
    return 'loppiainen';
  }
  const ashWednesday = calendar.find(e => e.slug === 'tuhkakeskiviikko');
  if (ashWednesday && date > ashWednesday.date && addDays(ashWednesday.date, 4) > date) {
    return 'tuhkakeskiviikko';
  }
  return sundayEntry?.sundaySlug || null;
}

// ─── Year Cycle Calculation ─────────────────────────────────────────────────

/**
 * Determine which lectionary year cycle (vuosikerta 1, 2, or 3) applies
 * for a given church year.
 *
 * The cycle changes at 1st Advent Sunday. Per the ELCF's perikooppikalenterit:
 * 2021–2022 → 1, 2022–2023 → 2, 2023–2024 → 3, 2024–2025 → 1, 2025–2026 → 2.
 *
 * @param {number} churchYearStartYear
 * @returns {number} 1, 2, or 3
 */
export function getYearCycle(churchYearStartYear) {
  return ((churchYearStartYear + 1) % 3) + 1;
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
  return date < firstAdventSunday(year) ? year - 1 : year;
}
