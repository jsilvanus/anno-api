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

function parseCycle(value) {
  if (value === undefined) return null;
  const cycle = Number(value);
  return [1, 2, 3].includes(cycle) ? cycle : undefined;
}

const summary = d => ({ name: d.name, slug: d.slug, type: d.type });

/**
 * Pick the day a per-date view is about.
 *
 * Several days can fall on one date (4. adventtisunnuntai + jouluaatto +
 * jouluyö, pitkäperjantai + Jeesuksen kuolinhetki, hiljainen lauantai +
 * pääsiäisyö, …). Without `?day=` the primary day is used — the holy day,
 * or on a weekday the day whose material is used; `?day=<slug>` picks any
 * of them. `alsoOnThisDate` lists the others.
 */
function selectDay(date, query) {
  const resolved = resolveDate(date, { allYearCycles: false });
  const all = [resolved.holyDay, ...resolved.additionalServices, resolved.weekdayMaterial].filter(Boolean);
  let day = all[0] ?? null;
  if (query.day) {
    day = all.find(d => d.slug === query.day) ?? null;
    if (!day) {
      return {
        error: `No day "${query.day}" on ${date}. Days on this date: ${all.map(d => d.slug).join(', ') || 'none'}.`,
        status: 404,
      };
    }
  }
  return {
    resolved,
    day,
    header: {
      date,
      day: day ? summary(day) : null,
      alsoOnThisDate: all.filter(d => d !== day).map(summary),
    },
  };
}

// ─── Per-date views (shared by /today/* and /date/:date/*) ─────────────────

function textsView(date, query) {
  const cycle = parseCycle(query.cycle);
  if (cycle === undefined) return { error: 'Invalid cycle. Use 1, 2 or 3.' };
  const picked = selectDay(date, query);
  if (picked.error) return picked;
  const { resolved, day, header } = picked;
  let texts = day?.texts ?? null;
  if (cycle && day) {
    texts = getHolyDay(day.materialFrom ?? day.slug, { yearCycle: cycle, churchYear: resolved.churchYear.start })?.texts ?? texts;
  }
  return {
    ...header,
    yearCycle: cycle ?? resolved.churchYear.yearCycle,
    texts,
    psalm: day?.psalm ?? null,
    hallelujah: day?.hallelujah ?? null,
    psalmVerse: day?.psalmVerse ?? null,
    liturgy: day?.liturgy ?? resolved.liturgy,
  };
}

function prayerView(date, query) {
  const picked = selectDay(date, query);
  if (picked.error) return picked;
  const { day, header } = picked;
  if (!day?.prayers?.length) return { ...header, prayer: null };
  const n = query.n ? parseInt(query.n, 10) : null;
  if (n && n >= 1 && n <= day.prayers.length) {
    return { ...header, prayer: day.prayers[n - 1], totalPrayers: day.prayers.length };
  }
  if (query.all === 'true') return { ...header, prayers: day.prayers };
  const prayer = day.prayers[Math.floor(Math.random() * day.prayers.length)];
  return { ...header, prayer, totalPrayers: day.prayers.length };
}

function gospelView(date, query) {
  const picked = selectDay(date, query);
  if (picked.error) return picked;
  const { resolved, day, header } = picked;
  return { ...header, yearCycle: resolved.churchYear.yearCycle, gospel: day?.texts?.gospel ?? null };
}

function propersView(date, query) {
  const picked = selectDay(date, query);
  if (picked.error) return picked;
  const { resolved, day, header } = picked;
  return { ...header, propers: day?.propers ?? null, liturgy: day?.liturgy ?? resolved.liturgy };
}

function colorView(date, query) {
  const picked = selectDay(date, query);
  if (picked.error) return picked;
  const { day, header } = picked;
  return { ...header, liturgicalColor: day?.liturgicalColor ?? null };
}

function liturgyView(date, query) {
  const picked = selectDay(date, query);
  if (picked.error) return picked;
  const { resolved, day, header } = picked;
  return { ...header, liturgy: day?.liturgy ?? resolved.liturgy };
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
