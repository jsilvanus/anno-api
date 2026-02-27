/**
 * Parser for viikkolektionaarin_raamatunkohdat.pdf
 *
 * Converts the extracted text index of Bible passages → liturgical occasions
 * into a structured JSON file.
 *
 * Output: src/data/lectionary-index.json
 *
 * Run: node src/parsers/parse-lectionary-index.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = join(__dirname, '..', 'data', 'lectionary-index.txt');
const OUTPUT = join(__dirname, '..', 'data', 'lectionary-index.json');

const raw = readFileSync(INPUT, 'utf-8');
const lines = raw.split('\n');

// ─── State machine ──────────────────────────────────────────────────────────

const PAGE_HEADER = /^Evankeliumikirjan ja viikkolektionaarin raamatunkohtahakemisto/;
const SECTION_HEADER = /^(Vanha testamentti|Uusi testamentti|Vanhan testamentin apokryfikirjat)$/;
const BOOK_HEADER = /^(.+?)\s+\(([^)]+)\)\s*$/;
// An entry line starts with a Bible verse reference: digits followed by : or –
const ENTRY_START = /^(\d[\d\s,.:;–\-()a-zåäöA-ZÅÄÖ]*)\s{2,}(.+)$/;
// Dot separator used between reference and liturgical day
const DOTS = /\.{2,}/;
// TOC line: name followed by dots and page number
const TOC_LINE = /\.{4,}\s+\d+\s*$/;

/**
 * Determine if a line looks like a book header (content section).
 * Must have parenthesized abbreviation and not be a TOC entry.
 */
function isBookHeader(line) {
  if (TOC_LINE.test(line)) return false;
  if (PAGE_HEADER.test(line)) return false;
  return BOOK_HEADER.test(line);
}

/**
 * Split an entry line into { reference, rest } using the dots separator.
 */
function splitOnDots(line) {
  const dotIdx = line.search(/\.{2,}/);
  if (dotIdx === -1) return null;
  const reference = line.slice(0, dotIdx).trim();
  const rest = line.slice(dotIdx).replace(/\.+/, '').trim();
  return { reference, rest };
}

/**
 * Parse the "rest" part (after dots) into { holyDay, context, readingType }.
 * Examples:
 *   "3. sunnuntai pääsiäisestä, aattoilta"
 *   "pääsiäisyö ......... lukukappale"
 *   "1. paastonajan sunnuntai (invocavit) ................................ 1. vsk. 1. lukukappale"
 */
function parseRest(rest) {
  // If there are still dots, split again
  const parts = rest.split(/\.{2,}/).map(s => s.trim()).filter(Boolean);

  if (parts.length >= 2) {
    const occurrencePart = parts[0];
    const readingType = parts.slice(1).join(' ').trim();
    return parseOccurrence(occurrencePart, readingType);
  }

  return parseOccurrence(rest, null);
}

/**
 * Parse an occurrence string into { holyDay, context, readingType }.
 * Occurrence may be like "pääsiäisyö" or "3. sunnuntai pääsiäisestä, aattoilta"
 * or "loppiainen, tiistai" (with context after comma).
 */
function parseOccurrence(occurrenceStr, readingType) {
  const str = occurrenceStr.trim();

  // Check for comma separating holy day from day-of-week context
  // e.g., "3. sunnuntai pääsiäisestä, aattoilta" or "loppiainen, tiistai"
  const commaIdx = str.lastIndexOf(',');
  let holyDay = str;
  let context = null;

  if (commaIdx !== -1) {
    const after = str.slice(commaIdx + 1).trim();
    // If after comma looks like a time/day context (short phrase)
    if (after.length < 50 && /^(maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai|aattoilta|aamu|ilta|yö)/.test(after)) {
      holyDay = str.slice(0, commaIdx).trim();
      context = after;
    }
  }

  return {
    holyDay: holyDay.trim(),
    context: context,
    readingType: readingType ? readingType.trim() : null,
  };
}

// ─── Parse ──────────────────────────────────────────────────────────────────

const entries = [];
let currentSection = null; // 'OT', 'NT', 'Apocrypha', 'Other'
let currentBook = null;
let currentAbbr = null;
let contentStarted = false;
let pendingEntry = null; // multi-line entry accumulation

/**
 * Flush a pending (multi-line) entry into the entries array.
 */
function flushPending() {
  if (!pendingEntry) return;

  const { reference, occurrences } = pendingEntry;
  if (occurrences.length > 0) {
    entries.push({
      book: currentBook,
      abbreviation: currentAbbr,
      section: currentSection,
      reference,
      occurrences,
    });
  }
  pendingEntry = null;
}

/**
 * Try to parse a line as the start of a new entry.
 * Returns the parsed entry start or null.
 */
function tryParseEntryStart(line) {
  // An entry has a verse reference followed by two or more spaces or dots
  if (!/^\d/.test(line)) return null;
  if (!DOTS.test(line)) return null;

  const split = splitOnDots(line);
  if (!split) return null;

  const { reference, rest } = split;
  if (!reference || reference.length > 60) return null; // sanity check

  return { reference, rest };
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trimEnd();

  // Skip page headers
  if (PAGE_HEADER.test(line)) continue;

  // Skip TOC lines (before content starts)
  if (!contentStarted) {
    if (SECTION_HEADER.test(line) && i > 100) {
      contentStarted = true;
      currentSection = line.includes('Uusi') ? 'NT'
        : line.includes('apokryfi') ? 'Apocrypha'
        : 'OT';
      continue;
    }
    continue;
  }

  // Section headers
  if (SECTION_HEADER.test(line)) {
    flushPending();
    currentSection = line.includes('Uusi') ? 'NT'
      : line.includes('apokryfi') ? 'Apocrypha'
      : 'OT';
    currentBook = null;
    currentAbbr = null;
    continue;
  }

  // "Kirkkovuoden pyhäpäivien tekstit muista lähteistä" section
  if (line.startsWith('Kirkkovuoden pyhäpäivien tekstit muista lähteistä')) {
    flushPending();
    currentSection = 'Other';
    currentBook = 'Muut lähteet';
    currentAbbr = null;
    continue;
  }

  // Empty line → flush pending
  if (line.trim() === '') {
    flushPending();
    continue;
  }

  // Book header
  if (isBookHeader(line)) {
    flushPending();
    const m = line.match(BOOK_HEADER);
    if (m) {
      currentBook = m[1].trim();
      currentAbbr = m[2].trim();
    }
    continue;
  }

  // Continuation line for current pending entry (multi-day)
  // These are lines that start with "1.–", letters, or semicolons
  if (pendingEntry) {
    // "= XX. sunnuntai ..." equivalence line
    if (line.startsWith('=')) {
      const eqLine = line.slice(1).trim();
      if (DOTS.test(eqLine)) {
        const split = splitOnDots(eqLine);
        if (split) {
          const occ = parseRest(split.rest);
          occ.equivalent = split.reference.trim() || null;
          pendingEntry.occurrences.push(occ);
        }
      } else {
        const occ = parseOccurrence(eqLine, null);
        occ.equivalent = true;
        pendingEntry.occurrences.push(occ);
      }
      continue;
    }

    // Continuation with dots (another holy day for same verse)
    if (DOTS.test(line) && !/^\d/.test(line)) {
      // Line like "1.–6. sunnuntai loppiaisesta, tiistai......... päivän psalmi"
      const split = splitOnDots(line);
      if (split && split.reference.length < 60) {
        const occ = parseRest(split.rest);
        occ.context = occ.context || split.reference.trim() || null;
        pendingEntry.occurrences.push(occ);
        continue;
      }
    }

    // Plain continuation line (overflow of holy day description)
    if (!/^\d/.test(line)) {
      // Might be "saarnateksti" or similar continuation
      const lastOcc = pendingEntry.occurrences[pendingEntry.occurrences.length - 1];
      if (lastOcc && !lastOcc.readingType) {
        lastOcc.readingType = line.trim();
      } else if (lastOcc) {
        lastOcc.readingType = (lastOcc.readingType || '') + ' ' + line.trim();
      }
      continue;
    }
  }

  // New entry line starting with a digit
  const entryStart = tryParseEntryStart(line);
  if (entryStart) {
    flushPending();
    const occ = parseRest(entryStart.rest);
    pendingEntry = {
      reference: entryStart.reference,
      occurrences: [occ],
    };
    continue;
  }
}

flushPending();

// ─── Build output ────────────────────────────────────────────────────────────

// Also build an index by holy day name for quick lookup
const byHolyDay = {};
for (const entry of entries) {
  for (const occ of entry.occurrences) {
    const key = occ.holyDay;
    if (!byHolyDay[key]) byHolyDay[key] = [];
    byHolyDay[key].push({
      book: entry.book,
      abbreviation: entry.abbreviation,
      section: entry.section,
      reference: entry.reference,
      context: occ.context,
      readingType: occ.readingType,
    });
  }
}

const output = {
  title: 'Kirkkovuoden pyhäpäivien ja arkipäivien raamatuntekstit Evankeliumikirjassa ja viikkolektionaarissa',
  description: 'Bible text index for holy days and weekdays in the Evankeliumikirja and weekly lectionary of the Evangelical-Lutheran Church of Finland',
  note: 'Bold entries in the original refer to Evankeliumikirja; plain entries to the weekly lectionary (viikkolektionaari).',
  entryCount: entries.length,
  entries,
  byHolyDay,
};

writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8');
console.log(`Wrote ${entries.length} entries to ${OUTPUT}`);
console.log(`Holy day keys: ${Object.keys(byHolyDay).length}`);
