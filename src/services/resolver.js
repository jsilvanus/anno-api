/**
 * Date Resolver — maps a calendar date to its church year day(s).
 *
 * Given any date, determines what holy day or period it falls on,
 * considering precedence rules for special feasts.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  generateChurchYear,
  getYearCycle,
  getChurchYearStart,
  formatDate,
  parseDate,
  easterSunday,
  makeDate,
  addDays,
  sameDay,
} from './computus.js';
import { getPropers } from './propers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// ─── Data Loading ───────────────────────────────────────────────────────────

let allDaysData = null;
let daysBySlug = null;

function loadData() {
  if (allDaysData) return;

  const raw = readFileSync(join(DATA_DIR, 'all-days.json'), 'utf-8');
  allDaysData = JSON.parse(raw);

  daysBySlug = new Map();
  for (const day of allDaysData) {
    daysBySlug.set(day.slug, day);
  }
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

// ─── Calendar Cache ─────────────────────────────────────────────────────────

const calendarCache = new Map();

function getCalendar(churchYearStart) {
  if (!calendarCache.has(churchYearStart)) {
    calendarCache.set(churchYearStart, generateChurchYear(churchYearStart));
  }
  return calendarCache.get(churchYearStart);
}

// ─── Resolve Date ───────────────────────────────────────────────────────────

/**
 * Resolve a date to its church calendar information.
 *
 * Returns all matching entries for that date, plus the active church year info.
 *
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @returns {Object} Resolved church day information
 */
export function resolveDate(date) {
  loadData();

  if (typeof date === 'string') {
    date = parseDate(date);
  }

  const dateStr = formatDate(date);
  const churchYearStart = getChurchYearStart(date);
  const yearCycle = getYearCycle(churchYearStart);

  // Get calendar for both possible church years
  // (in case we're near the boundary)
  const calendar = getCalendar(churchYearStart);

  // Find all entries matching this date
  const matches = calendar.filter(e => e.dateStr === dateStr);

  if (matches.length === 0) {
    // Date falls on a regular weekday — find the preceding Sunday
    const precedingSunday = findPrecedingSunday(calendar, date);

    return {
      date: dateStr,
      churchYear: {
        start: churchYearStart,
        label: `${churchYearStart}–${churchYearStart + 1}`,
        yearCycle,
      },
      holyDay: null,
      precedingSunday: precedingSunday ? enrichEntry(precedingSunday, yearCycle) : null,
      dayOfWeek: getDayOfWeekFi(date),
      season: precedingSunday ? getSeason(precedingSunday) : null,
    };
  }

  // Determine primary entry (precedence: feast > special > sunday > weekday > service)
  const prioritized = prioritizeEntries(matches);
  const primary = prioritized[0];

  return {
    date: dateStr,
    churchYear: {
      start: churchYearStart,
      label: `${churchYearStart}–${churchYearStart + 1}`,
      yearCycle,
    },
    holyDay: enrichEntry(primary, yearCycle),
    additionalServices: prioritized.slice(1).map(e => enrichEntry(e, yearCycle)),
    dayOfWeek: getDayOfWeekFi(date),
    season: getSeason(primary),
  };
}

/**
 * Enrich a calendar entry with data from the parsed Evankeliumikirja.
 */
function enrichEntry(entry, yearCycle) {
  const data = getDayData(entry.slug);

  const result = {
    name: entry.name,
    slug: entry.slug,
    date: entry.dateStr,
    type: entry.type,
    liturgicalColor: data?.liturgicalColor || null,
    description: data?.description || null,
    latinName: data?.latinName || null,
  };

  // Add texts for the active year cycle
  if (data?.yearCycles) {
    const cycleData = data.yearCycles[String(yearCycle)];
    if (cycleData) {
      result.texts = {
        yearCycle,
        firstReading: cycleData.firstReading || null,
        secondReading: cycleData.secondReading || null,
        gospel: cycleData.gospel || null,
      };

      // Resolve cross-references
      for (const key of ['firstReading', 'secondReading', 'gospel']) {
        const reading = result.texts[key];
        if (reading?.reference?.includes('ks.') && !reading.text) {
          // Try to resolve from cycle 1
          const cycle1 = data.yearCycles['1'];
          if (cycle1?.[key]?.text) {
            result.texts[key] = {
              ...reading,
              text: cycle1[key].text,
              bookIntro: cycle1[key].bookIntro,
              crossReference: `Teksti sama kuin 1. vuosikerta`,
            };
          }
        }
      }
    }

    // Also provide all cycles for reference
    result.allYearCycles = data.yearCycles;
  } else if (data?.weekdayTexts) {
    result.texts = data.weekdayTexts;
  }

  // Add psalm, hallelujah, prayers, hymns
  if (data?.psalm) result.psalm = data.psalm;
  if (data?.hallelujah) result.hallelujah = data.hallelujah;
  if (data?.psalmVerse) result.psalmVerse = data.psalmVerse;
  if (data?.prayers) result.prayers = data.prayers;
  if (data?.hymns) result.hymns = data.hymns;

  // Add liturgical propers from Jumalanpalvelusten kirja
  const propers = getPropers(entry.slug, data);
  if (propers.prefaatio || propers.kyrieLitania || propers.kertosae) {
    result.propers = propers;
  }

  return result;
}

/**
 * Prioritize entries when multiple fall on the same date.
 * Order: feast > special > sunday > weekday > service
 */
function prioritizeEntries(entries) {
  const priority = { feast: 1, special: 2, sunday: 3, weekday: 4, service: 5 };
  return [...entries].sort((a, b) => {
    return (priority[a.type] || 9) - (priority[b.type] || 9);
  });
}

/**
 * Find the preceding Sunday entry for a weekday.
 */
function findPrecedingSunday(calendar, date) {
  let best = null;
  for (const entry of calendar) {
    if ((entry.type === 'sunday' || entry.type === 'feast') && entry.date <= date) {
      if (!best || entry.date > best.date) {
        best = entry;
      }
    }
  }
  return best;
}

/**
 * Determine the liturgical season for a calendar entry.
 */
function getSeason(entry) {
  if (!entry) return null;

  const data = getDayData(entry.slug);
  if (data?.season) return data.season;

  // Infer from slug
  const slug = entry.slug;
  if (slug.includes('adventti') || slug.includes('advent')) return 'Joulujakso';
  if (slug.includes('joulu') || slug.includes('christmas')) return 'Joulujakso';
  if (slug.includes('loppiai')) return 'Joulujakso';
  if (slug.includes('paasto') || slug.includes('laskiai')) return 'Pääsiäisjakso';
  if (slug.includes('hiljai') || slug.includes('kiiras') || slug.includes('pitkap') || slug.includes('palmu')) return 'Pääsiäisjakso';
  if (slug.includes('paasiai')) return 'Pääsiäisjakso';
  if (slug.includes('helluntai') || slug.includes('kolminai') || slug.includes('helatorstai')) return 'Helluntaijakso';
  if (slug.includes('shel') || slug.includes('helluntaista')) return 'Helluntaijakso';

  return null;
}

/**
 * Get Finnish day of week name.
 */
function getDayOfWeekFi(date) {
  const days = ['sunnuntai', 'maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai'];
  return days[date.getUTCDay()];
}

// ─── Calendar Year Queries ──────────────────────────────────────────────────

/**
 * Get the full church year calendar with dates.
 */
export function getChurchYearCalendar(startYear) {
  const calendar = getCalendar(startYear);
  const yearCycle = getYearCycle(startYear);

  return {
    churchYear: {
      start: startYear,
      label: `${startYear}–${startYear + 1}`,
      yearCycle,
    },
    entries: calendar.map(e => ({
      date: e.dateStr,
      slug: e.slug,
      name: e.name,
      type: e.type,
    })),
  };
}

/**
 * Get entries for a specific season.
 */
export function getSeasonEntries(startYear, season) {
  loadData();

  const seasonMap = {
    advent: 'Adventtiaika',
    christmas: 'Jouluaika',
    epiphany: 'Loppiaisaika',
    lent: 'Paastonaika',
    easter: 'Pääsiäisaika',
    pentecost: 'Helluntain jälkeinen aika',
  };

  const periodName = seasonMap[season.toLowerCase()];
  if (!periodName) return null;

  const calendar = getCalendar(startYear);
  const yearCycle = getYearCycle(startYear);

  const matching = calendar.filter(e => {
    const data = getDayData(e.slug);
    return data?.period === periodName || data?.season?.toLowerCase().includes(season.toLowerCase());
  });

  return {
    season,
    churchYear: { start: startYear, label: `${startYear}–${startYear + 1}`, yearCycle },
    entries: matching.map(e => enrichEntry(e, yearCycle)),
  };
}
