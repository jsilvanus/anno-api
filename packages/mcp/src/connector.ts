import {
  resolveDate,
  getHolyDay,
  getAllDays,
  getPeriods,
  getChurchYearCalendar,
  getChurchYearStart,
  searchReadings,
  searchByReference,
  getAllPrefaatiot,
  getAllKyrieLitaniat,
  getAllSynninpaastot,
  getAllKiitosrukoukset,
  getAllKiitosrukouksetEhtoollinen,
  getAllKertosaakeet,
  getImproperia,
  todayInFinland,
  parseDate,
  type Day,
  type ResolvedDate,
} from '@anno-api/core';

export interface ConnectorContext {
  accessToken?: string;
  userId?: string;
}

export type PropersKind =
  | 'prefaatiot'
  | 'kyrie-litaniat'
  | 'synninpaastot'
  | 'kiitosrukoukset'
  | 'kiitosrukoukset-ehtoollinen'
  | 'kertosaakeet'
  | 'improperia';

export interface DayOptions {
  /** Include full Bible and prayer texts (default true). Without them, references only. */
  includeTexts?: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(date + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** Strip text bodies, keeping references — for a compact answer. */
function referencesOnly(day: Day | null): unknown {
  if (!day) return null;
  const ref = (r: { reference?: string | null; alternatives?: { reference?: string | null }[] } | null | undefined) =>
    r ? { reference: r.reference ?? null, ...(r.alternatives?.length ? { alternatives: r.alternatives.map(a => a.reference) } : {}) } : null;
  const t = day.texts;
  return {
    name: day.name,
    slug: day.slug,
    date: day.date,
    type: day.type,
    theme: day.theme,
    latinName: day.latinName,
    alternativeName: day.alternativeName,
    season: day.season,
    period: day.period,
    liturgicalColor: day.liturgicalColor,
    replaces: day.replaces,
    texts: t && {
      yearCycle: t.yearCycle,
      sameInAllCycles: t.sameInAllCycles,
      firstReading: ref(t.firstReading),
      secondReading: ref(t.secondReading),
      gospel: ref(t.gospel),
      ...(t.otReadings ? { otReadings: t.otReadings.map(ref) } : {}),
      ...(t.ntReadings ? { ntReadings: t.ntReadings.map(ref) } : {}),
      ...(t.readings ? { readings: t.readings.map(ref) } : {}),
      alternativeSermonTexts: t.alternativeSermonTexts ?? [],
    },
    psalm: day.psalm && { reference: day.psalm.reference, antiphonReference: day.psalm.antiphonReference },
    hallelujah: day.hallelujah && { reference: day.hallelujah.reference, text: day.hallelujah.text },
    psalmVerse: day.psalmVerse && { reference: day.psalmVerse.reference, text: day.psalmVerse.text },
    liturgy: day.liturgy ?? null,
    prayerCount: day.prayers.length,
    hymns: day.hymns,
    propers: {
      prefaatio: day.propers.prefaatio?.title ?? null,
      kyrieLitania: day.propers.kyrieLitania?.season ?? null,
      kertosae: day.propers.kertosae ? `${day.propers.kertosae.number}. ${day.propers.kertosae.title}` : null,
      postCommunionPrayer: day.propers.postCommunionPrayer?.season ?? null,
    },
  };
}

function compact(resolved: ResolvedDate): unknown {
  return {
    ...resolved,
    holyDay: referencesOnly(resolved.holyDay),
    additionalServices: resolved.additionalServices.map(referencesOnly),
    weekdayMaterial: referencesOnly(resolved.weekdayMaterial),
  };
}

/**
 * Church year connector: answers from @anno-api/core in-process.
 * Knows nothing about MCP or OAuth.
 */
export class KirkkovuosiConnector {
  /** Everything that varies with the church year on a date (default: today in Finland). */
  day(date: string | undefined, options: DayOptions = {}, _context: ConnectorContext = {}): unknown {
    const d = date ?? todayInFinland();
    if (!validDate(d)) throw new Error('Invalid date. Use YYYY-MM-DD.');
    const resolved = resolveDate(d, { allYearCycles: false });
    return options.includeTexts === false ? compact(resolved) : resolved;
  }

  /** One holy day by slug or by (part of its) name. */
  holyDay(query: string, options: { yearCycle?: number; churchYear?: number } & DayOptions = {}, _context: ConnectorContext = {}): unknown {
    const q = query.trim().toLowerCase();
    const days = getAllDays();
    const match = days.find(d => d.slug === q)
      ?? days.find(d => d.name.toLowerCase() === q)
      ?? days.find(d => d.name.toLowerCase().includes(q) || (d.latinName ?? '').toLowerCase().includes(q) || (d.alternativeName ?? '').toLowerCase().includes(q));
    if (!match) {
      throw new Error(`Holy day not found: ${query}. Use list_holy_days for the names.`);
    }
    const day = getHolyDay(match.slug, { yearCycle: options.yearCycle ?? null, churchYear: options.churchYear ?? null });
    if (!day) throw new Error(`Holy day not found: ${query}`);
    const { allYearCycles: _all, ...rest } = day;
    return options.includeTexts === false ? { ...(referencesOnly(day) as object), churchYear: day.churchYear } : rest;
  }

  /** Calendar of a church year (starting at 1st Advent of `startYear`; default: the current one). */
  calendar(startYear: number | undefined, _context: ConnectorContext = {}): unknown {
    const year = startYear ?? getChurchYearStart(parseDate(todayInFinland()));
    if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('Year must be between 1900 and 2100.');
    return getChurchYearCalendar(year);
  }

  /** Upcoming holy days (Sundays and feasts) from a date. */
  upcoming(from: string | undefined, count: number, _context: ConnectorContext = {}): unknown {
    const start = from ?? todayInFinland();
    if (!validDate(start)) throw new Error('Invalid date. Use YYYY-MM-DD.');
    const startYear = getChurchYearStart(parseDate(start));
    const entries = [
      ...getChurchYearCalendar(startYear).entries,
      ...getChurchYearCalendar(startYear + 1).entries,
    ].filter(e => e.date >= start && e.type !== 'weekday');
    return { from: start, entries: entries.slice(0, count) };
  }

  listHolyDays(_context: ConnectorContext = {}): unknown {
    return getAllDays().map(d => ({
      name: d.name,
      slug: d.slug,
      theme: d.theme,
      latinName: d.latinName,
      alternativeName: d.alternativeName ?? null,
      season: d.season,
      period: d.period,
    }));
  }

  periods(_context: ConnectorContext = {}): unknown {
    return getPeriods();
  }

  /** Where a Bible passage is read: Evankeliumikirja readings and the weekly lectionary index. */
  searchBibleReference(query: string, _context: ConnectorContext = {}): unknown {
    const q = query.trim();
    if (!q) throw new Error('Query is required, e.g. "Matt. 5" or "Ps. 23".');
    const readings = searchReadings(q);
    const lectionary = searchByReference(q);
    return {
      query: q,
      readings: { count: readings.length, results: readings.slice(0, 100) },
      weeklyLectionary: { count: lectionary.length, results: lectionary.slice(0, 50) },
    };
  }

  propers(kind: PropersKind, _context: ConnectorContext = {}): unknown {
    const source = 'Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000)';
    switch (kind) {
      case 'prefaatiot': return { source, prefaatiot: getAllPrefaatiot() };
      case 'kyrie-litaniat': return { source, kyrieLitaniat: getAllKyrieLitaniat() };
      case 'synninpaastot': return { source, synninpaastot: getAllSynninpaastot() };
      case 'kiitosrukoukset': return { source, kiitosrukoukset: getAllKiitosrukoukset() };
      case 'kiitosrukoukset-ehtoollinen': return { source, kiitosrukouksetEhtoollinen: getAllKiitosrukouksetEhtoollinen() };
      case 'kertosaakeet': return { source, kertosaakeet: getAllKertosaakeet() };
      case 'improperia': return { source, improperia: getImproperia() };
    }
  }
}
