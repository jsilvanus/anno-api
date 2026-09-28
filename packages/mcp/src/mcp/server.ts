import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { KirkkovuosiConnector, ConnectorContext } from '../connector.js';

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;
const oauthSecuritySchemes = [{ type: 'oauth2' as const, scopes: ['mcp'] }];
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

function withOAuthSecurity<T extends object>(config: T): T & { securitySchemes: typeof oauthSecuritySchemes } {
  return { ...config, securitySchemes: oauthSecuritySchemes };
}

function contextFromExtra(extra: Extra): ConnectorContext {
  const auth = extra.authInfo;
  const context = auth?.extra;
  return {
    ...(auth?.token ? { accessToken: auth.token } : {}),
    ...(typeof context?.userId === 'string' ? { userId: context.userId } : {}),
  };
}

function result(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function authError(publicUrl: string): CallToolResult {
  return {
    content: [{ type: 'text', text: 'Authentication required.' }],
    isError: true,
    _meta: {
      // ChatGPT needs both error and error_description here to show its sign-in UI.
      'mcp/www_authenticate': [
        'Bearer resource_metadata="' + publicUrl + '/.well-known/oauth-protected-resource/mcp", scope="mcp", ' +
          'error="insufficient_scope", error_description="Sign in to use this tool."',
      ],
    },
  };
}

function errorResult(error: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}

export interface McpServerOptions {
  connector: KirkkovuosiConnector;
  publicUrl: string;
}

const INSTRUCTIONS = [
  'Church year (kirkkovuosi) of the Evangelical-Lutheran Church of Finland: dates of holy days, Bible readings of the',
  'three-year lectionary (Evankeliumikirja 2021), psalms, hallelujah verses, prayers, hymns, liturgical colours,',
  'propers and seasonal rubrics (Jumalanpalvelusten kirja 2000), and the weekly lectionary (viikkolektionaari).',
  'Dates are in Finnish time; "today" is today in Finland. Texts are in Finnish.',
  'Start with church_day for a date, holy_day for a named day, or upcoming_holy_days for the next Sundays.',
  'On weekdays without their own holy day, weekdayMaterial is the day whose texts and prayers are used.',
].join(' ');

const dateArg = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  .describe('Date as YYYY-MM-DD. Defaults to today in Finland.');
const includeTextsArg = z.boolean().optional()
  .describe('Include the full Bible and prayer texts (default true). false returns references only, which is much shorter.');

export function createMcpServer(options: McpServerOptions): McpServer {
  const server = new McpServer({ name: 'kirkkovuosi', version: '2.0.0' }, { instructions: INSTRUCTIONS });
  const { connector, publicUrl } = options;

  const tool = <A>(handler: (args: A, context: ConnectorContext) => unknown) =>
    async (args: A, extra: Extra): Promise<CallToolResult> => {
      if (!extra.authInfo?.token) return authError(publicUrl);
      try {
        return result(await handler(args, contextFromExtra(extra)));
      } catch (error) {
        return errorResult(error);
      }
    };

  server.registerTool(
    'church_day',
    withOAuthSecurity({
      title: 'Church year day',
      description: 'Everything that varies with the church year on a date: the holy day (or the Sunday whose material a weekday uses), ' +
        'season and period, year cycle, readings, psalm, hallelujah verse or Lent psalm verse, prayers, hymns, liturgical colour, ' +
        'propers (preface, Kyrie litany, psalm refrain, post-communion prayer) and rubrics (Gloria, Hallelujah, Gloria Patri).',
      inputSchema: { date: dateArg, include_texts: includeTextsArg },
      annotations: readOnly,
    }),
    tool<{ date?: string | undefined; include_texts?: boolean | undefined }>((args, ctx) =>
      connector.day(args.date, args.include_texts === undefined ? {} : { includeTexts: args.include_texts }, ctx)),
  );

  server.registerTool(
    'holy_day',
    withOAuthSecurity({
      title: 'Holy day',
      description: 'One holy day by slug or name (e.g. "pääsiäispäivä", "4. adventtisunnuntai", "Laetare", "mikkelinpäivä"): theme, description, ' +
        'readings of a year cycle, psalm, prayers, hymns, colour and propers, and its date in the church year.',
      inputSchema: {
        name: z.string().min(1).describe('Slug or (part of) the Finnish or Latin name of the holy day.'),
        year_cycle: z.number().int().min(1).max(3).optional().describe('Lectionary year cycle (vuosikerta) 1–3. Defaults to the cycle of the church year.'),
        church_year: z.number().int().min(1900).max(2100).optional().describe('Church year by its starting year (e.g. 2025 for 2025–2026). Defaults to the current one.'),
        include_texts: includeTextsArg,
      },
      annotations: readOnly,
    }),
    tool<{ name: string; year_cycle?: number | undefined; church_year?: number | undefined; include_texts?: boolean | undefined }>((args, ctx) =>
      connector.holyDay(args.name, {
        ...(args.year_cycle !== undefined ? { yearCycle: args.year_cycle } : {}),
        ...(args.church_year !== undefined ? { churchYear: args.church_year } : {}),
        ...(args.include_texts !== undefined ? { includeTexts: args.include_texts } : {}),
      }, ctx)),
  );

  server.registerTool(
    'upcoming_holy_days',
    withOAuthSecurity({
      title: 'Upcoming holy days',
      description: 'The next Sundays, feasts and services from a date, with their theme, colour and gospel reference.',
      inputSchema: {
        from: dateArg,
        count: z.number().int().min(1).max(60).optional().describe('How many days to list (default 10).'),
      },
      annotations: readOnly,
    }),
    tool<{ from?: string | undefined; count?: number | undefined }>((args, ctx) => connector.upcoming(args.from, args.count ?? 10, ctx)),
  );

  server.registerTool(
    'church_year_calendar',
    withOAuthSecurity({
      title: 'Church year calendar',
      description: 'All dated days of one church year (1st Advent to the Saturday before the next 1st Advent), ' +
        'with type, theme, colour, gospel reference and which Sunday a feast replaces.',
      inputSchema: {
        start_year: z.number().int().min(1900).max(2100).optional()
          .describe('Calendar year in which the church year begins (2025 for 2025–2026). Defaults to the current church year.'),
      },
      annotations: readOnly,
    }),
    tool<{ start_year?: number | undefined }>((args, ctx) => connector.calendar(args.start_year, ctx)),
  );

  server.registerTool(
    'list_holy_days',
    withOAuthSecurity({
      title: 'List holy days',
      description: 'Names, slugs, themes, Latin names, seasons and periods of every holy day in Evankeliumikirja.',
      inputSchema: {},
      annotations: readOnly,
    }),
    tool<Record<string, never>>((_args, ctx) => connector.listHolyDays(ctx)),
  );

  server.registerTool(
    'church_year_periods',
    withOAuthSecurity({
      title: 'Periods of the church year',
      description: 'Introductions of the periods (adventtiaika, jouluaika, paastonaika, pääsiäisaika, …) from Evankeliumikirja.',
      inputSchema: {},
      annotations: readOnly,
    }),
    tool<Record<string, never>>((_args, ctx) => connector.periods(ctx)),
  );

  server.registerTool(
    'search_bible_reference',
    withOAuthSecurity({
      title: 'Search Bible reference',
      description: 'Where a Bible passage is read in the church year: Evankeliumikirja readings (holy day, year cycle, reading type) ' +
        'and the weekly lectionary index. Use Finnish abbreviations, e.g. "Matt. 5", "Room. 8", "Ps. 23", "Jes. 53".',
      inputSchema: { query: z.string().min(1).describe('Book abbreviation and optional chapter, e.g. "Luuk. 15".') },
      annotations: readOnly,
    }),
    tool<{ query: string }>((args, ctx) => connector.searchBibleReference(args.query, ctx)),
  );

  server.registerTool(
    'liturgical_texts',
    withOAuthSecurity({
      title: 'Liturgical texts',
      description: 'Texts from Jumalanpalvelusten kirja: preface endings by season, seasonal Kyrie litanies, absolutions, ' +
        'thanksgiving prayers after absolution, seasonal post-communion prayers, psalm refrains, or the Good Friday Improperia.',
      inputSchema: {
        kind: z.enum(['prefaatiot', 'kyrie-litaniat', 'synninpaastot', 'kiitosrukoukset', 'kiitosrukoukset-ehtoollinen', 'kertosaakeet', 'improperia']),
      },
      annotations: readOnly,
    }),
    tool<{ kind: Parameters<KirkkovuosiConnector['propers']>[0] }>((args, ctx) => connector.propers(args.kind, ctx)),
  );

  return server;
}
