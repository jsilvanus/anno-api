/**
 * Weekly lectionary (viikkolektionaari) from kirkkovuosikalenteri.fi
 *
 * The ELCF's Kirkkovuosikalenteri publishes the prayer-hour texts of every
 * day ("Raamattua viikonpäiville"): a morning and an evening reading, the
 * psalms of the morning, midday and evening prayer, the day's psalm, and on
 * Sundays and holy days the week's psalm, the eve reading and the week's
 * apocrypha text. Its public day endpoint returns them as JSON:
 *
 *   https://www.kirkkovuosikalenteri.fi/wp-json/kirkkovuosi/v1/day/fi/D.M.YYYY
 *
 * The texts depend only on the day of the church year (the holy day, or the
 * week's Sunday on a weekday) and the weekday. This script works out one date
 * for every such (day, weekday) combination that our calendar produces,
 * fetches those dates (politely, cached), and builds
 * data/weekly-lectionary.json with the passages de-duplicated.
 *
 * Usage:
 *   node packages/core/parsers/fetch-weekly-lectionary.js [cacheDir] [outputFile]
 *
 * The cache (raw responses, ~20 MB) is not committed.
 * Texts © Kirkkohallitus; Bible texts from Raamattu (1992) © Kirkkohallitus.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  generateChurchYear, resolveDate, firstAdventSunday, addDays, formatDate,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const [
  cacheDir = join(__dirname, '..', '..', '..', '.cache', 'kirkkovuosikalenteri'),
  outputFile = join(__dirname, '..', 'data', 'weekly-lectionary.json'),
] = process.argv.slice(2);

const ENDPOINT = 'https://www.kirkkovuosikalenteri.fi/wp-json/kirkkovuosi/v1/day/fi/';
const USER_AGENT = 'anno-api/2.0 (church year data; github.com/jsilvanus/anno-api)';
// The site has data for roughly church years 2022–2035.
const FIRST_YEAR = 2022;
const LAST_YEAR = 2034;
const TARGET_YEAR = 2026;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ─── Which dates are needed ─────────────────────────────────────────────────

/** Candidate dates per (day slug, weekday), nearest to TARGET_YEAR first, within the site's range. */
function neededDates() {
  const combos = new Map();
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const end = firstAdventSunday(year + 1);
    for (let d = generateChurchYear(year)[0].date; d < end; d = addDays(d, 1)) {
      const r = resolveDate(d, { allYearCycles: false });
      for (const day of [r.holyDay, ...r.additionalServices, r.weekdayMaterial]) {
        if (!day || day.type === 'observance') continue;
        const key = `${day.slug}|${d.getUTCDay()}`;
        if (!combos.has(key)) combos.set(key, []);
        combos.get(key).push(formatDate(d));
      }
    }
  }
  const distance = iso => Math.abs(+iso.slice(0, 4) - TARGET_YEAR);
  for (const list of combos.values()) list.sort((a, b) => distance(a) - distance(b) || a.localeCompare(b));
  return combos;
}

async function fetchDay(iso) {
  const file = join(cacheDir, `${iso}.json`);
  if (existsSync(file)) {
    const cached = JSON.parse(readFileSync(file, 'utf-8'));
    if (cached.day_title) return cached;
  }
  const [y, m, d] = iso.split('-').map(Number);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}${d}.${m}.${y}`, { headers: { 'user-agent': USER_AGENT } });
      const json = await res.json();
      if (json.day_title) {
        writeFileSync(file, JSON.stringify(json));
        await sleep(1000);
        return json;
      }
    } catch { /* retry */ }
    await sleep(attempt * 5000);
  }
  throw new Error(`Could not fetch ${iso}`);
}

// ─── Text conversion ────────────────────────────────────────────────────────

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8195;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

/**
 * HTML → text. Line breaks are kept; the second half-verse of psalms is
 * indented with two spaces (antiphonal reading), as on the site.
 * With `chant`, the cadence marks are kept: "*" for the pause and the
 * syllable where the cadence starts in underscores ("kuu_le_").
 */
function htmlToText(html, { chant = false } = {}) {
  let s = html
    .replace(/\r/g, '')
    .replace(/<span class="kadenssi-underline">([^<]*)<\/span>/g, chant ? '_$1_' : '$1')
    .replace(/\s*<span class="kadenssi-star">\*<\/span>/g, chant ? ' *' : '')
    .replace(/<br\s*\/?>\s*\n?/g, '\n')
    .replace(/<\/p>\s*<p[^>]*>/g, '\n\n')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map(line => {
      const indented = /^\s{2,}\S/.test(line.replace(/ /g, '  '));
      return (indented ? '  ' : '') + line.replace(/[\s ]+/g, ' ').trim();
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const normRef = ref => decodeEntities(ref).replace(/\s+/g, ' ').replace(/(\d)\s*-\s*(\d)/g, '$1–$2').trim()
  .replace(/^(?=\d+(:|$))/, 'Ps. '); // the site leaves out "Ps." on some psalms ("147:1–11")

// ─── Title → slug ───────────────────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase()
    .replace(/\s*[–-]\s*arkipäivät$/, '') // "Apostolien päivä – arkipäivät": the weekdays after it
    .replace(/\(.*?\)/g, '')
    .replace(/[äå]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

const TITLE_SLUGS = {
  'kristittyjen-ykseyden-rukouspaiva': 'kristittyjen-ykseyden-rukouspaiva',
  'rauhan-ihmisoikeuksien-ja-kansainvalisen-vastuun-rukouspaiva': 'rauhan-rukouspaiva',
};

// ─── Build ──────────────────────────────────────────────────────────────────

const HOURS = { eve: 'eve', morning: 'morning', noon: 'noon', evening: 'evening', psalms: 'dayPsalm', week: 'weekPsalm', apocrypha: 'apocrypha' };

async function main() {
  mkdirSync(cacheDir, { recursive: true });
  // resolveDate() reads the data file this script writes; start from an empty one.
  const dataFile = join(__dirname, '..', 'data', 'weekly-lectionary.json');
  if (!existsSync(dataFile)) writeFileSync(dataFile, JSON.stringify({ days: {}, passages: {}, candles: {} }));
  const combos = neededDates();
  const dates = [...new Set([...combos.values()].map(list => list[0]))].sort();
  console.log(`${combos.size} (day, weekday) combinations on ${dates.length} dates`);

  const responses = new Map();
  const getDay = async iso => {
    if (!responses.has(iso)) responses.set(iso, await fetchDay(iso));
    return responses.get(iso);
  };
  for (const [i, iso] of dates.entries()) {
    await getDay(iso);
    if (i % 50 === 49) console.log(`  ${i + 1}/${dates.length}`);
  }

  const passages = {};
  const days = {};
  const candles = {};
  const addPassage = item => {
    const reference = normRef(item.verse);
    const text = htmlToText(item.text || '');
    const chant = htmlToText(item.text || '', { chant: true });
    const existing = passages[reference];
    if (!existing) passages[reference] = chant !== text ? { text, chant } : { text };
    return reference;
  };

  const findDay = (json, slug) => (json?.liturgical_days || []).find(d => {
    const s = slugify(d.title);
    return (TITLE_SLUGS[s] ?? s) === slug;
  });
  for (const [key, candidates] of combos) {
    const [slug, weekday] = key.split('|');
    // The nearest date may show something else (a memorial day, another year's
    // arrangement); try the other years' dates of the same (day, weekday).
    let ld = null;
    for (const iso of candidates) {
      ld = findDay(await getDay(iso), slug);
      if (ld) break;
    }
    if (!ld) continue; // not on the site in any covered year
    if (ld.candles) candles[slug] = ld.candles;
    const entry = {};
    for (const [field, name] of Object.entries(HOURS)) {
      const list = Array.isArray(ld.lectionary?.[field]) ? ld.lectionary[field] : [];
      const refs = list.filter(x => x?.verse).map(addPassage);
      if (refs.length) entry[name] = refs;
    }
    (days[slug] ??= {})[weekday] = entry;
  }

  const sortedDays = Object.fromEntries(Object.keys(days).sort().map(slug => [
    slug, Object.fromEntries(Object.keys(days[slug]).sort().map(wd => [wd, days[slug][wd]])),
  ]));
  writeFileSync(outputFile, JSON.stringify({
    source: 'Kirkkovuosikalenteri (kirkkovuosikalenteri.fi), viikkolektionaari — © Kirkkohallitus; Raamattu (1992) © Kirkkohallitus',
    fetched: new Date().toISOString().slice(0, 10),
    weekdays: 'keys 0–6 = sunnuntai–lauantai',
    candles,
    days: sortedDays,
    passages: Object.fromEntries(Object.keys(passages).sort().map(r => [r, passages[r]])),
  }, null, 1) + '\n');
  const missing = [...combos.keys()].filter(k => {
    const [slug, wd] = k.split('|');
    return !days[slug]?.[wd];
  });
  console.log(`Wrote ${outputFile}: ${Object.keys(sortedDays).length} days, ${Object.keys(passages).length} passages`);
  if (missing.length) console.log(`Not on the site (${missing.length}): ${missing.join(', ')}`);
}

await main();
