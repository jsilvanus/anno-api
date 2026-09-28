/**
 * Search the readings of all holy days by Bible reference.
 */

import { getAllDays } from './resolver.js';

const READING_KEYS = ['firstReading', 'secondReading', 'gospel'];

/**
 * Find readings whose reference contains the query (case-insensitive),
 * e.g. "Matt. 21", "Room. 8", "Ps. 23". Alternatives ("TAI") are searched too.
 *
 * @param {string} query
 * @returns {Array<{ holyDay: string, slug: string, yearCycle: number|null, readingType: string, reference: string, alternative: boolean }>}
 */
export function searchReadings(query) {
  const q = query.toLowerCase().replace(/–/g, '--').trim();
  if (!q) return [];
  const results = [];
  const push = (day, yearCycle, readingType, reading, alternative = false) => {
    if (reading?.reference?.toLowerCase().includes(q)) {
      results.push({ holyDay: day.name, slug: day.slug, yearCycle, readingType, reference: reading.reference, alternative });
    }
    if (!alternative) for (const alt of reading?.alternatives || []) push(day, yearCycle, readingType, alt, true);
  };

  for (const day of getAllDays()) {
    for (const [cycle, readings] of Object.entries(day.yearCycles || {})) {
      for (const key of READING_KEYS) {
        if (!readings[key]?.sameAsYearCycle) push(day, Number(cycle), key, readings[key]);
      }
    }
    for (const key of READING_KEYS) push(day, null, key, day.readings?.[key]);
    for (const key of ['otReadings', 'ntReadings', 'readings']) {
      for (const reading of day.weekdayTexts?.[key] || []) push(day, null, key, reading);
    }
    push(day, null, 'gospel', day.weekdayTexts?.gospel);
    push(day, null, 'psalm', day.psalm);
  }
  return results;
}
