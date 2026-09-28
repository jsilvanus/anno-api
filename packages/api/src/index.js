/**
 * Kirkkovuosi API — Church Year Calendar and Lectionary
 *
 * Evangelical-Lutheran Church of Finland
 * Based on Evankeliumikirja (2021) and Jumalanpalvelusten kirja (2000)
 *
 * Zero-dependency HTTP server (Node.js built-in http module).
 */

import { createServer as createHttpServer } from 'http';
import { fileURLToPath } from 'url';
import { registerRoutes } from './routes.js';

const PORT = process.env.PORT || 3000;

// ─── Simple Router ──────────────────────────────────────────────────────────

export class Router {
  constructor() {
    this.routes = [];
  }

  get(pattern, handler) {
    // Convert Express-style :param patterns to regex
    const paramNames = [];
    const regexStr = pattern.replace(/:([a-zA-Z]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexStr}$`);
    this.routes.push({ regex, paramNames, handler });
  }

  match(pathname) {
    for (const route of this.routes) {
      const m = pathname.match(route.regex);
      if (m) {
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(m[i + 1]);
        });
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

export const ENDPOINTS = [
  'GET /api/v1/today — Everything that varies with the church year for today (?cycles=false omits other year cycles)',
  'GET /api/v1/today/texts — Bible texts, psalm and hallelujah verse for today (?cycle=1|2|3)',
  'GET /api/v1/today/prayer — A prayer of the day (?n=2 for a specific one, ?all=true for all)',
  'GET /api/v1/today/gospel — Gospel reading for today',
  'GET /api/v1/today/propers — Liturgical propers and rubrics for today',
  'GET /api/v1/today/color — Liturgical colour for today',
  'GET /api/v1/today/liturgy — Seasonal rubrics (Gloria, Hallelujah, Gloria Patri) for today',
  'GET /api/v1/date/:date — Everything for a specific date (YYYY-MM-DD)',
  'GET /api/v1/date/:date/texts — Texts for a date (?cycle=1|2|3)',
  'GET /api/v1/date/:date/prayer — A prayer for a date',
  'GET /api/v1/date/:date/gospel — Gospel for a date',
  'GET /api/v1/date/:date/propers — Propers for a date',
  'GET /api/v1/date/:date/color — Liturgical colour for a date',
  'GET /api/v1/date/:date/liturgy — Seasonal rubrics for a date',
  'GET /api/v1/holy-day/:slug — Full data for a holy day (?cycle=1|2|3, ?year=YYYY, ?raw=true)',
  'GET /api/v1/year/:year/calendar — Church year calendar starting at Advent of :year',
  'GET /api/v1/days — List all holy days',
  'GET /api/v1/periods — Introductions of the periods of the church year',
  'GET /api/v1/search/text?q=Matt.+21 — Search readings by Bible reference',
  'GET /api/v1/propers/prefaatiot — All preface endings by season',
  'GET /api/v1/propers/kyrie-litaniat — Seasonal Kyrie litanies',
  'GET /api/v1/propers/synninpaastot — Absolution texts',
  'GET /api/v1/propers/kiitosrukoukset — Thanksgiving prayers after absolution',
  'GET /api/v1/propers/kiitosrukoukset-ehtoollinen — Seasonal thanksgiving prayers after communion',
  'GET /api/v1/propers/kertosaakeet — Seasonal psalm refrains',
  'GET /api/v1/propers/improperia — Good Friday Improperia',
  'GET /api/v1/lectionary — Lectionary index metadata',
  'GET /api/v1/lectionary/holy-days — All holy day names in the lectionary',
  'GET /api/v1/lectionary/by-holy-day?q=pääsiäisyö — Readings for a holy day',
  'GET /api/v1/lectionary/search?q=Matt.+5 — Search lectionary by Bible reference',
];

// ─── Server ─────────────────────────────────────────────────────────────────

function respond(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Create the HTTP server (not yet listening).
 */
export function createServer() {
  const router = new Router();
  registerRoutes(router);

  return createHttpServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      respond(res, 405, { error: 'Method not allowed' });
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    const query = Object.fromEntries(url.searchParams);

    if (pathname === '/health') {
      respond(res, 200, { ok: true });
      return;
    }

    const match = router.match(pathname);

    if (!match) {
      if (pathname === '/' || pathname === '/api' || pathname === '/api/v1') {
        respond(res, 200, {
          name: 'Kirkkovuosi API',
          version: '2.0.0',
          description: 'Church year calendar and lectionary for the Evangelical-Lutheran Church of Finland',
          sources: [
            'Evankeliumikirja (Kirkkokäsikirja II, 2021)',
            'Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000)',
            'Viikkolektionaarin raamatunkohdat',
          ],
          endpoints: ENDPOINTS,
        });
        return;
      }
      respond(res, 404, { error: 'Not found' });
      return;
    }

    try {
      const result = match.handler({ params: match.params, query });
      if (result?.error) {
        const { status = 400, ...body } = result;
        respond(res, status, body);
      } else {
        respond(res, 200, result);
      }
    } catch (err) {
      console.error('Error handling request:', err);
      respond(res, 500, { error: 'Internal server error' });
    }
  });
}

// Start when run directly (node src/index.js)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => {
    console.log(`\n  ⛪ Kirkkovuosi API running at http://localhost:${PORT}`);
    console.log('  📖 Based on Evankeliumikirja (Kirkkokäsikirja II, 2021)');
    console.log(`  🔗 Try: http://localhost:${PORT}/api/v1/today\n`);
  });
}
