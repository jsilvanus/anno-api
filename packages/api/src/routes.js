/**
 * API Routes for Kirkkovuosi API
 */

import {
  resolveDate, getChurchYearCalendar, getHolyDay, getDayData, getAllDays, getPeriods,
  getAllPrefaatiot, getAllKyrieLitaniat, getAllSynninpaastot, getAllKiitosrukoukset,
  getAllKertosaakeet, getAllKiitosrukouksetEhtoollinen, getImproperia,
  getIndexMeta, getByHolyDay, searchByReference, getHolyDayNames,
  searchReadings, todayInFinland,
} from '@anno-api/core';

const JPK = 'Jumalanpalvelusten kirja (2000)';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(date) {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** ?cycles=false leaves out the texts of the other year cycles. */
function resolveOptions(query) {
  return { allYearCycles: query.cycles !== 'false' };
}

/** The day whose material is used: the holy day, or on a weekday the Sunday's. */
function dayOf(resolved) {
  return resolved.holyDay || resolved.weekdayMaterial;
}

function parseCycle(value) {
  if (value === undefined) return null;
  const cycle = Number(value);
  return [1, 2, 3].includes(cycle) ? cycle : undefined;
}

// ─── Per-date views (shared by /today/* and /date/:date/*) ─────────────────

function textsView(date, query) {
  const cycle = parseCycle(query.cycle);
  if (cycle === undefined) return { error: 'Invalid cycle. Use 1, 2 or 3.' };
  const resolved = resolveDate(date);
  const day = dayOf(resolved);
  const yearCycle = cycle ?? resolved.churchYear.yearCycle;
  let texts = day?.texts ?? null;
  if (cycle && day) texts = getHolyDay(day.slug, { yearCycle: cycle, churchYear: resolved.churchYear.start }).texts;
  return {
    date,
    holyDay: resolved.holyDay?.name ?? null,
    materialFrom: resolved.holyDay ? null : day?.name ?? null,
    yearCycle,
    texts,
    psalm: day?.psalm ?? null,
    hallelujah: resolved.liturgy.hallelujah ? day?.hallelujah ?? null : null,
    psalmVerse: day?.psalmVerse ?? null,
  };
}

function prayerView(date, query) {
  const resolved = resolveDate(date, { allYearCycles: false });
  const day = dayOf(resolved);
  if (!day?.prayers?.length) return { date, holyDay: day?.name ?? null, prayer: null };
  const n = query.n ? parseInt(query.n, 10) : null;
  if (n && n >= 1 && n <= day.prayers.length) {
    return { date, holyDay: day.name, prayer: day.prayers[n - 1], totalPrayers: day.prayers.length };
  }
  if (query.all === 'true') return { date, holyDay: day.name, prayers: day.prayers };
  const prayer = day.prayers[Math.floor(Math.random() * day.prayers.length)];
  return { date, holyDay: day.name, prayer, totalPrayers: day.prayers.length };
}

function gospelView(date) {
  const resolved = resolveDate(date, { allYearCycles: false });
  const day = dayOf(resolved);
  return {
    date,
    holyDay: day?.name ?? null,
    yearCycle: resolved.churchYear.yearCycle,
    gospel: day?.texts?.gospel ?? null,
  };
}

function propersView(date) {
  const resolved = resolveDate(date, { allYearCycles: false });
  const day = dayOf(resolved);
  return {
    date,
    holyDay: day?.name ?? null,
    propers: day?.propers ?? null,
    liturgy: resolved.liturgy,
  };
}

function colorView(date) {
  const resolved = resolveDate(date, { allYearCycles: false });
  return {
    date,
    holyDay: dayOf(resolved)?.name ?? null,
    liturgicalColor: resolved.liturgicalColor?.color ?? null,
    color: resolved.liturgicalColor,
  };
}

function liturgyView(date) {
  const resolved = resolveDate(date, { allYearCycles: false });
  return { date, holyDay: dayOf(resolved)?.name ?? null, liturgy: resolved.liturgy };
}

const DATE_VIEWS = {
  texts: textsView,
  prayer: prayerView,
  gospel: gospelView,
  propers: propersView,
  color: colorView,
  liturgy: liturgyView,
};

/**
 * Register all routes on the router.
 */
export function registerRoutes(routes) {

  // ─── Dates ──────────────────────────────────────────────────────────

  routes.get('/api/v1/today', (req) => resolveDate(todayInFinland(), resolveOptions(req.query)));

  routes.get('/api/v1/date/:date', (req) => {
    const { date } = req.params;
    if (!isValidDate(date)) return { error: 'Invalid date format. Use YYYY-MM-DD.' };
    return resolveDate(date, resolveOptions(req.query));
  });

  for (const [name, view] of Object.entries(DATE_VIEWS)) {
    routes.get(`/api/v1/today/${name}`, (req) => view(todayInFinland(), req.query));
    routes.get(`/api/v1/date/:date/${name}`, (req) => {
      const { date } = req.params;
      if (!isValidDate(date)) return { error: 'Invalid date format. Use YYYY-MM-DD.' };
      return view(date, req.query);
    });
  }

  // ─── Holy days and calendar ─────────────────────────────────────────

  routes.get('/api/v1/holy-day/:slug', (req) => {
    const cycle = parseCycle(req.query.cycle);
    if (cycle === undefined) return { error: 'Invalid cycle. Use 1, 2 or 3.' };
    if (req.query.raw === 'true') {
      return getDayData(req.params.slug) || { error: `Holy day not found: ${req.params.slug}`, status: 404 };
    }
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const day = getHolyDay(req.params.slug, { yearCycle: cycle, churchYear: year });
    return day || { error: `Holy day not found: ${req.params.slug}`, status: 404 };
  });

  routes.get('/api/v1/year/:year/calendar', (req) => {
    const year = parseInt(req.params.year, 10);
    if (Number.isNaN(year) || year < 1900 || year > 2100) {
      return { error: 'Invalid year. Must be between 1900 and 2100.' };
    }
    return getChurchYearCalendar(year);
  });

  routes.get('/api/v1/days', () => getAllDays().map(d => ({
    name: d.name,
    slug: d.slug,
    theme: d.theme ?? null,
    season: d.season,
    period: d.period,
    latinName: d.latinName,
    alternativeName: d.alternativeName ?? null,
    liturgicalColor: d.liturgicalColor,
  })));

  routes.get('/api/v1/periods', () => ({ source: 'Evankeliumikirja (2021)', periods: getPeriods() }));

  routes.get('/api/v1/search/text', (req) => {
    const q = (req.query.q || '').trim();
    if (!q) return { error: 'Query parameter ?q= is required.' };
    const results = searchReadings(q);
    return { query: q, count: results.length, results };
  });

  // ─── Propers (Kirkkokäsikirja I) ────────────────────────────────────

  routes.get('/api/v1/propers/prefaatiot', () => ({ source: JPK, prefaatiot: getAllPrefaatiot() }));
  routes.get('/api/v1/propers/kyrie-litaniat', () => ({ source: JPK, kyrieLitaniat: getAllKyrieLitaniat() }));
  routes.get('/api/v1/propers/synninpaastot', () => ({ source: JPK, synninpaastot: getAllSynninpaastot() }));
  routes.get('/api/v1/propers/kiitosrukoukset', () => ({ source: JPK, kiitosrukoukset: getAllKiitosrukoukset() }));
  routes.get('/api/v1/propers/kiitosrukoukset-ehtoollinen', () => ({ source: JPK, kiitosrukouksetEhtoollinen: getAllKiitosrukouksetEhtoollinen() }));
  routes.get('/api/v1/propers/kertosaakeet', () => ({ source: JPK, kertosaakeet: getAllKertosaakeet() }));
  routes.get('/api/v1/propers/improperia', () => ({ source: JPK, improperia: getImproperia() }));

  // ─── Lectionary index (viikkolektionaarin raamatunkohdat) ───────────

  routes.get('/api/v1/lectionary', () => getIndexMeta());
  routes.get('/api/v1/lectionary/holy-days', () => ({ holyDays: getHolyDayNames() }));

  routes.get('/api/v1/lectionary/by-holy-day', (req) => {
    const q = (req.query.q || '').trim();
    if (!q) return { error: 'Query parameter ?q= is required. Example: ?q=pääsiäisyö' };
    const results = getByHolyDay(q);
    const count = Object.values(results).reduce((n, arr) => n + arr.length, 0);
    return { query: q, matchedDays: Object.keys(results).length, count, results };
  });

  routes.get('/api/v1/lectionary/search', (req) => {
    const q = (req.query.q || '').trim();
    if (!q) return { error: 'Query parameter ?q= is required. Example: ?q=Matt.+5' };
    const results = searchByReference(q);
    return { query: q, count: results.length, results };
  });
}
