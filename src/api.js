/**
 * API Routes for Kirkkovuosi API
 */

import { resolveDate, getChurchYearCalendar, getDayData, getAllDays } from '../services/resolver.js';
import { formatDate, makeDate, getYearCycle, getChurchYearStart, parseDate } from '../services/computus.js';
import {
  getAllPrefaatiot, getAllKyrieLitaniat, getAllSynninpaastot,
  getAllKiitosrukoukset, getAllKertosaakeet, getImproperia,
  getPropers,
} from '../services/propers.js';

/**
 * Register all routes on the HTTP server.
 * Uses a simple routing approach without external dependencies.
 */
export function registerRoutes(routes) {

  // ─── GET /api/v1/today ──────────────────────────────────────────────
  routes.get('/api/v1/today', (req) => {
    const today = new Date();
    const dateStr = formatDate(today);
    return resolveDate(dateStr);
  });

  // ─── GET /api/v1/date/:date ─────────────────────────────────────────
  routes.get('/api/v1/date/:date', (req) => {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: 'Invalid date format. Use YYYY-MM-DD.' };
    }
    return resolveDate(date);
  });

  // ─── GET /api/v1/today/texts ────────────────────────────────────────
  routes.get('/api/v1/today/texts', (req) => {
    const today = formatDate(new Date());
    const resolved = resolveDate(today);
    const cycle = req.query.cycle ? parseInt(req.query.cycle) : null;

    if (!resolved.holyDay) {
      return { date: today, texts: null, note: 'Ei pyhäpäivää, käytä edellisen sunnuntain tekstejä.', precedingSunday: resolved.precedingSunday };
    }

    if (cycle && resolved.holyDay.allYearCycles) {
      const cycleData = resolved.holyDay.allYearCycles[String(cycle)];
      return { date: today, yearCycle: cycle, texts: cycleData || null };
    }

    return { date: today, yearCycle: resolved.churchYear.yearCycle, texts: resolved.holyDay.texts || null };
  });

  // ─── GET /api/v1/today/prayer ───────────────────────────────────────
  routes.get('/api/v1/today/prayer', (req) => {
    const today = formatDate(new Date());
    const resolved = resolveDate(today);

    const day = resolved.holyDay || resolved.precedingSunday;
    if (!day?.prayers || day.prayers.length === 0) {
      return { date: today, prayer: null };
    }

    // Return a random prayer, or specific if ?n= is given
    const n = req.query.n ? parseInt(req.query.n) : null;
    if (n && n >= 1 && n <= day.prayers.length) {
      return { date: today, holyDay: day.name, prayer: day.prayers[n - 1] };
    }

    const randomIdx = Math.floor(Math.random() * day.prayers.length);
    return { date: today, holyDay: day.name, prayer: day.prayers[randomIdx], totalPrayers: day.prayers.length };
  });

  // ─── GET /api/v1/today/gospel ───────────────────────────────────────
  routes.get('/api/v1/today/gospel', (req) => {
    const today = formatDate(new Date());
    const resolved = resolveDate(today);

    const day = resolved.holyDay || resolved.precedingSunday;
    const gospel = day?.texts?.gospel || day?.texts?.yearCycles?.[resolved.churchYear.yearCycle]?.gospel || null;

    return { date: today, holyDay: day?.name || null, yearCycle: resolved.churchYear.yearCycle, gospel };
  });

  // ─── GET /api/v1/holy-day/:slug ─────────────────────────────────────
  routes.get('/api/v1/holy-day/:slug', (req) => {
    const data = getDayData(req.params.slug);
    if (!data) {
      return { error: `Holy day not found: ${req.params.slug}` };
    }
    return data;
  });

  // ─── GET /api/v1/year/:year/calendar ────────────────────────────────
  routes.get('/api/v1/year/:year/calendar', (req) => {
    const year = parseInt(req.params.year);
    if (isNaN(year) || year < 1900 || year > 2100) {
      return { error: 'Invalid year. Must be between 1900 and 2100.' };
    }
    return getChurchYearCalendar(year);
  });

  // ─── GET /api/v1/date/:date/color ───────────────────────────────────
  routes.get('/api/v1/date/:date/color', (req) => {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: 'Invalid date format. Use YYYY-MM-DD.' };
    }

    const resolved = resolveDate(date);
    const day = resolved.holyDay || resolved.precedingSunday;

    return {
      date,
      liturgicalColor: day?.liturgicalColor || null,
      holyDay: day?.name || null,
    };
  });

  // ─── GET /api/v1/days ───────────────────────────────────────────────
  routes.get('/api/v1/days', (req) => {
    const allDays = getAllDays();
    return allDays.map(d => ({
      name: d.name,
      slug: d.slug,
      season: d.season,
      period: d.period,
      latinName: d.latinName,
      liturgicalColor: d.liturgicalColor,
    }));
  });

  // ─── GET /api/v1/search/text ────────────────────────────────────────
  routes.get('/api/v1/search/text', (req) => {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q) {
      return { error: 'Query parameter ?q= is required.' };
    }

    const allDays = getAllDays();
    const results = [];

    for (const day of allDays) {
      // Search in year cycles
      if (day.yearCycles) {
        for (const [cycle, readings] of Object.entries(day.yearCycles)) {
          for (const key of ['firstReading', 'secondReading', 'gospel']) {
            const ref = readings[key]?.reference?.toLowerCase();
            if (ref && ref.includes(q)) {
              results.push({
                holyDay: day.name,
                slug: day.slug,
                yearCycle: parseInt(cycle),
                readingType: key,
                reference: readings[key].reference,
              });
            }
          }
        }
      }

      // Search in weekday texts
      if (day.weekdayTexts) {
        for (const key of ['otReadings', 'ntReadings']) {
          if (day.weekdayTexts[key]) {
            for (const r of day.weekdayTexts[key]) {
              if (r.reference?.toLowerCase().includes(q)) {
                results.push({
                  holyDay: day.name,
                  slug: day.slug,
                  readingType: key,
                  reference: r.reference,
                });
              }
            }
          }
        }
      }
    }

    return { query: q, count: results.length, results };
  });

  // ─── PROPERS ROUTES (Kirkkokäsikirja I) ─────────────────────────────

  // GET /api/v1/today/propers — Propers for today
  routes.get('/api/v1/today/propers', (req) => {
    const today = formatDate(new Date());
    const resolved = resolveDate(today);
    const day = resolved.holyDay || resolved.precedingSunday;

    if (!day?.propers && day?.slug) {
      const data = getDayData(day.slug);
      return { date: today, holyDay: day.name, propers: getPropers(day.slug, data) };
    }

    return { date: today, holyDay: day?.name || null, propers: day?.propers || null };
  });

  // GET /api/v1/date/:date/propers — Propers for a specific date
  routes.get('/api/v1/date/:date/propers', (req) => {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: 'Invalid date format. Use YYYY-MM-DD.' };
    }
    const resolved = resolveDate(date);
    const day = resolved.holyDay || resolved.precedingSunday;

    if (day?.slug) {
      const data = getDayData(day.slug);
      return { date, holyDay: day.name, propers: getPropers(day.slug, data) };
    }

    return { date, holyDay: null, propers: null };
  });

  // GET /api/v1/propers/prefaatiot — All preface endings
  routes.get('/api/v1/propers/prefaatiot', (req) => {
    return { source: 'Jumalanpalvelusten kirja (2000)', prefaatiot: getAllPrefaatiot() };
  });

  // GET /api/v1/propers/kyrie-litaniat — All seasonal Kyrie litanies
  routes.get('/api/v1/propers/kyrie-litaniat', (req) => {
    return { source: 'Jumalanpalvelusten kirja (2000)', kyrieLitaniat: getAllKyrieLitaniat() };
  });

  // GET /api/v1/propers/synninpaastot — All absolutions
  routes.get('/api/v1/propers/synninpaastot', (req) => {
    return { source: 'Jumalanpalvelusten kirja (2000)', synninpaastot: getAllSynninpaastot() };
  });

  // GET /api/v1/propers/kiitosrukoukset — Thanksgiving prayers after absolution
  routes.get('/api/v1/propers/kiitosrukoukset', (req) => {
    return { source: 'Jumalanpalvelusten kirja (2000)', kiitosrukoukset: getAllKiitosrukoukset() };
  });

  // GET /api/v1/propers/kertosaakeet — Seasonal psalm refrains
  routes.get('/api/v1/propers/kertosaakeet', (req) => {
    return { source: 'Jumalanpalvelusten kirja (2000)', kertosaakeet: getAllKertosaakeet() };
  });

  // GET /api/v1/propers/improperia — Good Friday Improperia
  routes.get('/api/v1/propers/improperia', (req) => {
    return { source: 'Jumalanpalvelusten kirja (2000)', improperia: getImproperia() };
  });
}
