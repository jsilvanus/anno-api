/**
 * Date Resolver — maps a calendar date to its church year day(s).
 *
 * Given any date, determines what holy day or period it falls on and returns
 * everything that varies with the church year: readings of the active year
 * cycle, psalm, hallelujah verse / psalm verse, prayers, hymns, liturgical
 * colour, propers (Jumalanpalvelusten kirja) and the seasonal rubrics.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  generateChurchYear,
  weekdayMaterialSlug,
  getYearCycle,
  getChurchYearStart,
  firstAdventSunday,
  easterSunday,
  formatDate,
  parseDate,
  addDays,
  dayOfWeek,
} from './computus.js';
import { getPropers } from './propers.js';
import { getByHolyDay } from './lectionary.js';
import { parseLiturgicalColor, colorForDay } from './colors.js';
import { liturgicalRules } from './rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// ─── Data Loading ───────────────────────────────────────────────────────────

let allDaysData = null;
let daysBySlug = null;
let periodsData = null;

function loadData() {
  if (allDaysData) return;
  allDaysData = JSON.parse(readFileSync(join(DATA_DIR, 'all-days.json'), 'utf-8'));
  daysBySlug = new Map(allDaysData.map(day => [day.slug, day]));
}

/**
 * Get the parsed data for a holy day by slug.
 */
export function getDayData(slug) {
  loadData();
  return daysBySlug.get(slug) || null;
}

/**
 * Get all day data entries.
 */
export function getAllDays() {
  loadData();
  return allDaysData;
}

/**
 * Introductions of the periods (aika) of the church year, from Evankeliumikirja.
 */
export function getPeriods() {
  if (!periodsData) periodsData = JSON.parse(readFileSync(join(DATA_DIR, 'periods.json'), 'utf-8')).periods;
  return periodsData;
}

/**
 * Days whose texts and prayers come from another day.
 * "6. sunnuntai loppiaisesta: Tänä sunnuntaina käytetään 26. helluntain
 * jälkeisen sunnuntain tekstejä ja muuta jumalanpalvelusaineistoa."
 */
const MATERIAL_FROM = {
  '6-sunnuntai-loppiaisesta': '26-sunnuntai-helluntaista',
};

/**
 * Named weekdays whose colour is given once for the whole week in an overview entry.
 */
const COLOR_FROM = {
  'hiljaisen-viikon-maanantai': 'hiljainen-viikko',
  'hiljaisen-viikon-tiistai': 'hiljainen-viikko',
  'hiljaisen-viikon-keskiviikko': 'hiljainen-viikko',
  'jeesuksen-kuolinhetki': 'pitkaperjantai',
  'pitkaperjantain-ilta': 'pitkaperjantai',
  'paasiaisen-jalkeinen-tiistai': 'paasiaisen-jalkeinen-viikko-eli-paasiaisviikko',
  'paasiaisen-jalkeinen-keskiviikko': 'paasiaisen-jalkeinen-viikko-eli-paasiaisviikko',
  'paasiaisen-jalkeinen-torstai': 'paasiaisen-jalkeinen-viikko-eli-paasiaisviikko',
  'paasiaisen-jalkeinen-perjantai': 'paasiaisen-jalkeinen-viikko-eli-paasiaisviikko',
  'paasiaisen-jalkeinen-lauantai': 'paasiaisen-jalkeinen-viikko-eli-paasiaisviikko',
  'kristittyjen-ykseyden-rukouspaiva': 'kansalliset-rukouspaivat',
  'rauhan-rukouspaiva': 'kansalliset-rukouspaivat',
};

/** Slugs in the calendar that have their data under another slug. */
const DATA_SLUG = {
  'kristittyjen-ykseyden-rukouspaiva': 'kansalliset-rukouspaivat',
  'rauhan-rukouspaiva': 'kansalliset-rukouspaivat',
};

// ─── Calendar Cache ─────────────────────────────────────────────────────────

const calendarCache = new Map();

function getCalendar(churchYearStart) {
  if (!calendarCache.has(churchYearStart)) {
    calendarCache.set(churchYearStart, generateChurchYear(churchYearStart));
  }
  return calendarCache.get(churchYearStart);
}

function churchYearInfo(start) {
  return {
    start,
    label: `${start}–${start + 1}`,
    yearCycle: getYearCycle(start),
    firstAdventSunday: formatDate(firstAdventSunday(start)),
    easter: formatDate(easterSunday(start + 1)),
    lastDay: formatDate(addDays(firstAdventSunday(start + 1), -1)),
  };
}

// ─── Texts ──────────────────────────────────────────────────────────────────

/**
 * Readings for a day in a given year cycle.
 * Days with one set of texts for every cycle carry `sameInAllCycles: true`.
 */
function textsFor(data, yearCycle) {
  if (data?.yearCycles) {
    const cycle = data.yearCycles[String(yearCycle)];
    if (!cycle) return null;
    return {
      yearCycle,
      sameInAllCycles: false,
      firstReading: cycle.firstReading || null,
      secondReading: cycle.secondReading || null,
      gospel: cycle.gospel || null,
      alternativeSermonTexts: cycle.alternativeSermonTexts || [],
    };
  }
  if (data?.readings) {
    return {
      yearCycle,
      sameInAllCycles: true,
      firstReading: data.readings.firstReading || null,
      secondReading: data.readings.secondReading || null,
      gospel: data.readings.gospel || null,
      alternativeSermonTexts: data.readings.alternativeSermonTexts || [],
    };
  }
  if (data?.weekdayTexts) {
    return { yearCycle, sameInAllCycles: true, weekday: true, ...data.weekdayTexts };
  }
  return null;
}

/** The weekly lectionary (viikkolektionaari) entries listed for this day. */
function weeklyLectionaryFor(name) {
  const q = name.toLowerCase();
  const results = getByHolyDay(q);
  const entries = [];
  for (const [key, readings] of Object.entries(results)) {
    const k = key.toLowerCase().replace(/;$/, '');
    if (k === q || k.startsWith(q + ' (')) entries.push(...readings);
  }
  return entries;
}

/**
 * Build the full description of one day of the church year.
 *
 * @param {object} entry — calendar entry ({ slug, name, type, dateStr, … })
 * @param {number} yearCycle
 * @param {object} [options]
 * @param {boolean} [options.weekday] — the day's material is used on a weekday after it
 * @param {boolean} [options.allYearCycles=true] — include texts of all three cycles
 */
function enrichEntry(entry, yearCycle, { weekday = false, allYearCycles = true } = {}) {
  const dataSlug = DATA_SLUG[entry.slug] || entry.slug;
  const data = getDayData(dataSlug);
  const material = getDayData(MATERIAL_FROM[dataSlug]) || data;
  const colorSource = data?.liturgicalColor ? data : getDayData(COLOR_FROM[entry.slug]);

  const result = {
    name: entry.name,
    slug: entry.slug,
    date: entry.dateStr ?? null,
    type: entry.type ?? null,
    theme: data?.theme ?? null,
    latinName: data?.latinName ?? null,
    alternativeName: data?.alternativeName ?? null,
    season: data?.season ?? null,
    period: data?.period ?? null,
    description: data?.description ?? null,
    liturgicalColor: colorForDay(colorSource?.liturgicalColor, { weekday }),
    replaces: entry.replaces ?? null,
  };
  if (MATERIAL_FROM[dataSlug]) result.materialFrom = MATERIAL_FROM[dataSlug];

  result.texts = textsFor(material, yearCycle);
  if (allYearCycles && material?.yearCycles) result.allYearCycles = material.yearCycles;
  result.psalm = material?.psalm ?? null;
  result.hallelujah = material?.hallelujah ?? null;
  result.psalmVerse = material?.psalmVerse ?? null;
  result.prayers = material?.prayers ?? [];
  result.hymns = material?.hymns ?? null;
  result.propers = getPropers(dataSlug, data);
  result.weeklyLectionary = weeklyLectionaryFor(entry.name);

  return result;
}

// ─── Resolve Date ───────────────────────────────────────────────────────────

/**
 * Resolve a date to its church calendar information.
 *
 * - `holyDay`: the day's own holy day (the first one listed for the date), or null
 * - `additionalServices`: other days, services and observances on the same date
 * - `weekdayMaterial`: on a weekday without its own holy day, the day whose
 *   texts, prayers and colour are used (the week's Sunday, even when a feast
 *   took its place; see weekdayMaterialSlug)
 * - `liturgicalColor`: the colour of the day
 * - `liturgy`: rubrics of the day's main service (Gloria, Hallelujah, Gloria Patri);
 *   every day and service in the response also carries its own `liturgy`
 *
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @param {object} [options]
 * @param {boolean} [options.allYearCycles=true] — include texts of all three cycles
 * @returns {Object} Resolved church day information
 */
export function resolveDate(date, { allYearCycles = true } = {}) {
  loadData();
  if (typeof date === 'string') date = parseDate(date);

  const dateStr = formatDate(date);
  const churchYearStart = getChurchYearStart(date);
  const yearCycle = getYearCycle(churchYearStart);
  const calendar = getCalendar(churchYearStart);
  const matches = calendar.filter(e => e.dateStr === dateStr);
  const opts = { allYearCycles };

  const own = matches.filter(e => e.type !== 'weekday' && e.type !== 'observance');
  const observances = matches.filter(e => e.type === 'observance');
  const weekEntry = matches.find(e => e.type === 'weekday');

  const primary = own[0] ?? null;
  const holyDay = primary ? enrichEntry(primary, yearCycle, opts) : null;
  const additionalServices = [...own.slice(1), ...observances].map(e => enrichEntry(e, yearCycle, opts));

  // Weekday material: the week's own weekday material, or the Sunday's
  let weekdayMaterial = null;
  if (!primary) {
    if (weekEntry) {
      weekdayMaterial = enrichEntry(weekEntry, yearCycle, opts);
    } else {
      const slug = weekdayMaterialSlug(calendar, date);
      const source = slug && (calendar.find(e => e.slug === slug || e.sundaySlug === slug));
      const data = slug && getDayData(slug);
      if (data) {
        weekdayMaterial = enrichEntry({
          slug,
          name: data.name,
          type: 'weekdayMaterial',
          dateStr: source?.slug === slug ? source.dateStr : null,
        }, yearCycle, { ...opts, weekday: true });
      }
    }
  }

  // Rubrics per day and service: pääsiäisyö on Holy Saturday differs from the day itself
  for (const d of [holyDay, ...additionalServices, weekdayMaterial]) {
    if (d) d.liturgy = liturgicalRules(date, calendar, d);
  }

  const day = holyDay ?? weekdayMaterial;
  const seasonSource = holyDay ?? weekdayMaterial;

  return {
    date: dateStr,
    dayOfWeek: getDayOfWeekFi(date),
    churchYear: churchYearInfo(churchYearStart),
    season: seasonSource?.season ?? null,
    period: seasonSource?.period ?? null,
    holyDay,
    additionalServices,
    weekdayMaterial,
    liturgicalColor: day?.liturgicalColor ?? null,
    // Rubrics of the day's main service; each day and service also carries its own
    liturgy: day?.liturgy ?? liturgicalRules(date, calendar, null),
  };
}

/**
 * Get Finnish day of week name.
 */
function getDayOfWeekFi(date) {
  return ['sunnuntai', 'maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai'][dayOfWeek(date)];
}

// ─── Single day queries ─────────────────────────────────────────────────────

/**
 * Full data of one holy day, with texts of the given year cycle.
 * Returns null for an unknown slug.
 */
export function getHolyDay(slug, { yearCycle = null, churchYear = null } = {}) {
  const data = getDayData(slug);
  if (!data) return null;
  const start = churchYear ?? getChurchYearStart(new Date());
  const cycle = yearCycle ?? getYearCycle(start);
  const calendar = getCalendar(start);
  const entry = calendar.find(e => e.slug === slug);
  const day = enrichEntry({ slug, name: data.name, type: entry?.type ?? null, dateStr: entry?.dateStr ?? null, replaces: entry?.replaces }, cycle);
  // Rubrics apply to a dated day; weekday-material entries (e.g. 26. sunnuntai helluntaista in a short year) have none
  day.liturgy = entry ? liturgicalRules(entry.date, calendar, day) : null;
  return { ...day, churchYear: churchYearInfo(start) };
}

// ─── Calendar Year Queries ──────────────────────────────────────────────────

/**
 * Get the full church year calendar with dates.
 */
export function getChurchYearCalendar(startYear) {
  loadData();
  const calendar = getCalendar(startYear);
  const yearCycle = getYearCycle(startYear);

  return {
    churchYear: churchYearInfo(startYear),
    entries: calendar.map(e => {
      const data = getDayData(DATA_SLUG[e.slug] || e.slug);
      return {
        date: e.dateStr,
        slug: e.slug,
        name: e.name,
        type: e.type,
        theme: data?.theme ?? null,
        liturgicalColor: parseLiturgicalColor(data?.liturgicalColor ?? getDayData(COLOR_FROM[e.slug])?.liturgicalColor)?.color ?? null,
        gospel: textsFor(getDayData(MATERIAL_FROM[e.slug]) || data, yearCycle)?.gospel?.reference ?? null,
        ...(e.replaces ? { replaces: e.replaces } : {}),
      };
    }),
  };
}
