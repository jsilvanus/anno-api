/**
 * @anno-api/core — church year of the Evangelical-Lutheran Church of Finland.
 *
 * Pure library: calendar computation, date resolution and liturgical data
 * (Evankeliumikirja 2021, Jumalanpalvelusten kirja 2000, viikkolektionaari).
 * Used by the REST API (@anno-api/api) and the MCP server (@anno-api/mcp).
 */

export {
  easterSunday, makeDate, addDays, dayOfWeek, sameDay, formatDate, parseDate,
  firstAdventSunday, generateChurchYear, weekdayMaterialSlug, getYearCycle, getChurchYearStart,
  ENTRY_TYPES,
} from './computus.js';
export {
  resolveDate, getHolyDay, getDayData, getAllDays, getPeriods, getChurchYearCalendar,
} from './resolver.js';
export {
  getPropers, getSeasonKeys, getPrefaatio, getKyrieLitania, getKertosae, getPostCommunionPrayer,
  getAllPrefaatiot, getAllKyrieLitaniat, getAllSynninpaastot, getAllKiitosrukoukset,
  getAllKertosaakeet, getAllKiitosrukouksetEhtoollinen, getImproperia,
} from './propers.js';
export { getIndexMeta, getByHolyDay, searchByReference, getHolyDayNames, getAllEntries } from './lectionary.js';
export { parseLiturgicalColor, colorForDay, COLORS } from './colors.js';
export { liturgicalRules } from './rules.js';
export { searchReadings } from './search.js';
export { dailyLectionary, altarCandles, weeklyLectionaryMeta } from './weekly-lectionary.js';

/** Today's date (YYYY-MM-DD) in Finland, where the church year is kept. */
export function todayInFinland(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
