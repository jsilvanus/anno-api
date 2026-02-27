/**
 * Kirkkovuosi API — Church Year Calendar and Lectionary
 *
 * Evangelical-Lutheran Church of Finland
 * Based on Evankeliumikirja (2021)
 *
 * Zero-dependency HTTP server (Node.js built-in http module).
 */

import { createServer } from 'http';
import { registerRoutes } from './routes/api.js';

const PORT = process.env.PORT || 3000;

// ─── Simple Router ──────────────────────────────────────────────────────────

class Router {
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

// ─── Server ─────────────────────────────────────────────────────────────────

const router = new Router();
registerRoutes(router);

const server = createServer((req, res) => {
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

  // Parse URL
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Parse query string
  const query = {};
  for (const [key, value] of url.searchParams) {
    query[key] = value;
  }

  // Route matching
  const match = router.match(pathname);

  if (!match) {
    // Serve basic info at root
    if (pathname === '/' || pathname === '/api' || pathname === '/api/v1') {
      respond(res, 200, {
        name: 'Kirkkovuosi API',
        version: '1.0.0',
        description: 'Church year calendar and lectionary for the Evangelical-Lutheran Church of Finland',
        source: 'Evankeliumikirja (Kirkkokäsikirja II, 2021)',
        endpoints: [
          'GET /api/v1/today — Current day info with propers',
          'GET /api/v1/today/texts — Bible texts for today',
          'GET /api/v1/today/texts?cycle=2 — Texts for specific year cycle',
          'GET /api/v1/today/prayer — Prayer for today',
          'GET /api/v1/today/prayer?n=2 — Specific prayer by number',
          'GET /api/v1/today/gospel — Gospel reading for today',
          'GET /api/v1/today/propers — Liturgical propers for today',
          'GET /api/v1/date/:date — Info for a specific date (YYYY-MM-DD)',
          'GET /api/v1/date/:date/color — Liturgical color for a date',
          'GET /api/v1/date/:date/propers — Propers for a specific date',
          'GET /api/v1/holy-day/:slug — Full data for a specific holy day',
          'GET /api/v1/year/:year/calendar — Church year calendar',
          'GET /api/v1/days — List all holy days',
          'GET /api/v1/search/text?q=Matt.21 — Search by Bible reference',
          'GET /api/v1/propers/prefaatiot — All preface endings by season',
          'GET /api/v1/propers/kyrie-litaniat — Seasonal Kyrie litanies',
          'GET /api/v1/propers/synninpaastot — Absolution texts',
          'GET /api/v1/propers/kiitosrukoukset — Thanksgiving prayers',
          'GET /api/v1/propers/kertosaakeet — Seasonal psalm refrains',
          'GET /api/v1/propers/improperia — Good Friday Improperia',
          'GET /api/v1/lectionary — Lectionary index metadata',
          'GET /api/v1/lectionary/holy-days — All holy day names in the lectionary',
          'GET /api/v1/lectionary/by-holy-day?q=pääsiäisyö — Readings for a holy day',
          'GET /api/v1/lectionary/search?q=Matt.+5 — Search lectionary by Bible reference',
        ],
      });
      return;
    }

    respond(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const result = match.handler({ params: match.params, query });
    const statusCode = result?.error ? 400 : 200;
    respond(res, statusCode, result);
  } catch (err) {
    console.error('Error handling request:', err);
    respond(res, 500, { error: 'Internal server error' });
  }
});

function respond(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

server.listen(PORT, () => {
  console.log(`\n  ⛪ Kirkkovuosi API running at http://localhost:${PORT}`);
  console.log(`  📖 Based on Evankeliumikirja (Kirkkokäsikirja II, 2021)`);
  console.log(`  🔗 Try: http://localhost:${PORT}/api/v1/today\n`);
});
