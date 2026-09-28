/**
 * Weekly lectionary (viikkolektionaari): the prayer-hour texts of every day.
 *
 * Source: Kirkkovuosikalenteri (kirkkovuosikalenteri.fi), fetched by
 * parsers/fetch-weekly-lectionary.js into data/weekly-lectionary.json.
 *
 * Each day of the week has a morning and an evening reading (weekday readings
 * follow the preceding Sunday's texts), the psalms of the morning, midday and
 * evening prayer (fixed by weekday and hour), the day's psalm (by season and
 * weekday), and on Sundays and holy days the week's psalm, the first vespers
 * (aattoilta, prayed the evening before) and the week's apocrypha text.
 *
 * Saturday has no vespers of its own: its evening is the coming Sunday's first
 * vespers, and a Sunday's evening prayer is its second vespers. Which day the
 * evening belongs to depends on the next day, so resolveDate() sets `evening`
 * (see resolver.js); dailyLectionary() gives the texts stored for the day.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

let data = null;

function load() {
  if (!data) data = JSON.parse(readFileSync(join(DATA_DIR, 'weekly-lectionary.json'), 'utf-8'));
  return data;
}

/**
 * Weeks whose lectionary comes from another week. 6. sunnuntai loppiaisesta
 * uses the texts of 26. sunnuntai helluntaista (Evankeliumikirja; the
 * lectionary index lists the same weekday readings for both), with the day's
 * psalms of Epiphany season.
 */
const READINGS_FROM = {
  '6-sunnuntai-loppiaisesta': { readings: '26-sunnuntai-helluntaista', dayPsalm: '5-sunnuntai-loppiaisesta' },
};

const isPsalm = ref => /^Ps\. /.test(ref);

function passage(reference) {
  const p = load().passages[reference];
  return { reference, text: p?.text ?? null, ...(p?.chant ? { chant: p.chant } : {}) };
}

const passages = refs => (refs ?? []).map(passage);

// A prayer hour lists its reading(s) first and its psalm last. The reading can
// itself be from the Psalms (Ps. 104:27–30 before Ps. 111), so go by position.
function hour(refs) {
  if (!refs?.length) return null;
  const split = refs.length > 1 ? refs.length - 1 : isPsalm(refs[0]) ? 0 : 1;
  return {
    readings: passages(refs.slice(0, split)),
    psalms: passages(refs.slice(split)),
  };
}

function rawEntry(slug, weekday) {
  const days = load().days;
  if (days[slug]?.[weekday]) return days[slug][weekday];
  const from = READINGS_FROM[slug];
  if (!from || !days[from.readings]?.[weekday]) return null;
  return {
    ...days[from.readings][weekday],
    ...(days[from.dayPsalm]?.[weekday]?.dayPsalm ? { dayPsalm: days[from.dayPsalm][weekday].dayPsalm } : {}),
  };
}

/**
 * The prayer-hour texts of a day of the church year on a weekday.
 *
 * @param {string} slug — the holy day, or on a weekday the day whose material is used
 * @param {number} weekday — 0 = sunnuntai … 6 = lauantai
 * @returns {{ firstVespers, morning, noon, evening, dayPsalm, weekPsalm, apocrypha } | null}
 */
export function dailyLectionary(slug, weekday) {
  const entry = rawEntry(slug, weekday);
  if (!entry) return null;
  return {
    firstVespers: hour(entry.eve),
    morning: hour(entry.morning),
    noon: hour(entry.noon),
    evening: hour(entry.evening),
    dayPsalm: passages(entry.dayPsalm),
    weekPsalm: passages(entry.weekPsalm),
    apocrypha: passages(entry.apocrypha),
  };
}

/** Number of altar candles for a day ("Kaksi alttarikynttilää"), or null. */
export function altarCandles(slug) {
  const c = load().candles;
  return c[slug] ?? c[READINGS_FROM[slug]?.readings] ?? null;
}

/** Source and fetch date of the weekly lectionary data. */
export function weeklyLectionaryMeta() {
  const { source, fetched } = load();
  return { source, fetched };
}
