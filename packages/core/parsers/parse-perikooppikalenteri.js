/**
 * Parser: Perikooppikalenteri (.doc) → test fixture JSON
 *
 * The ELCF publishes a yearly pericope calendar ("Perikooppikalenteri") as a
 * Word document. It lists every dated holy day of one church year with its
 * readings. We use these official calendars as ground truth for tests.
 *
 * Source: https://evl.fi/plus/wp-content/uploads/sites/3/2023/07/kvYYYY.doc
 *
 * Usage:
 *   node packages/core/parsers/parse-perikooppikalenteri.js refs/perikooppikalenterit packages/core/test/fixtures/perikooppikalenterit.json
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const [inputDir = 'refs/perikooppikalenterit', outputFile = 'packages/core/test/fixtures/perikooppikalenterit.json'] = process.argv.slice(2);

const DATE = /^(?:(\d{1,2})\.(?:(\d{1,2})\.)?(?:(\d{4}))?–)?(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const SECTION_HEADINGS = new Set([
  'Päivän psalmi', 'Psalmi', 'Hallelujasäe', 'Psalmilause', '1. lukukappale', '2. lukukappale',
  'Evankeliumi', 'Vaihtoehtoisia saarnatekstejä', 'Vanhan testamentin lukukappaleet',
  'Uuden testamentin lukukappaleet', 'Lukukappale', 'Uuden testamentin lukukappale', 'Evankeliumit',
]);

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDateLine(line) {
  const m = line.match(DATE);
  if (!m) return null;
  const [, d1, m1, y1, d2, m2, y2] = m;
  const end = iso(y2, m2, d2);
  if (!d1) return { start: end, end };
  return { start: iso(y1 || y2, m1 || m2, d1), end };
}

/** Split "Ps. 1 / tai / Ps. 2" lists into alternatives. */
function alternatives(lines) {
  return lines.filter(l => l && l !== 'tai' && l !== 'Antifoni:' && l !== 'Psalmi:');
}

function parseBlock(lines) {
  const entry = { name: lines[0] };
  let i = 1;
  // Theme / alternative names until the colour line or first section heading
  const extra = [];
  while (i < lines.length && !lines[i].startsWith('Liturginen väri') && !SECTION_HEADINGS.has(lines[i])) {
    extra.push(lines[i]);
    i++;
  }
  if (extra.length) entry.subtitle = extra;
  if (lines[i]?.startsWith('Liturginen väri')) {
    entry.liturgicalColor = lines[i].replace(/^Liturginen väri:\s*/i, '').replace(/\.$/, '');
    i++;
  }
  let section = null;
  const buf = {};
  for (; i < lines.length; i++) {
    let line = lines[i];
    if (line === 'Antifoni') line = 'Antifoni:';
    if (line === 'Psalmi' && section === 'Päivän psalmi') line = 'Psalmi:';
    if (SECTION_HEADINGS.has(line)) { section = line; buf[section] = []; continue; }
    if (section) buf[section].push(line);
  }
  const readings = {};
  const psalm = buf['Päivän psalmi'] || buf['Psalmi'];
  if (psalm) {
    const ai = psalm.indexOf('Antifoni:');
    const pi = psalm.indexOf('Psalmi:');
    if (ai >= 0 && pi >= 0) {
      readings.antiphon = alternatives(psalm.slice(ai + 1, pi));
      readings.psalm = alternatives(psalm.slice(pi + 1));
    } else {
      readings.psalm = alternatives(psalm);
    }
  }
  if (buf['Hallelujasäe']) readings.hallelujah = alternatives(buf['Hallelujasäe']);
  if (buf['Psalmilause']) readings.psalmVerse = alternatives(buf['Psalmilause']);
  if (buf['1. lukukappale']) readings.firstReading = alternatives(buf['1. lukukappale']);
  if (buf['2. lukukappale']) readings.secondReading = alternatives(buf['2. lukukappale']);
  if (buf['Vanhan testamentin lukukappaleet']) readings.otReadings = alternatives(buf['Vanhan testamentin lukukappaleet']);
  const nt = [...(buf['Uuden testamentin lukukappaleet'] || []), ...(buf['Uuden testamentin lukukappale'] || [])];
  if (nt.length) readings.ntReadings = alternatives(nt);
  if (buf['Lukukappale']) readings.reading = alternatives(buf['Lukukappale']);
  const gospels = [...(buf['Evankeliumi'] || []), ...(buf['Evankeliumit'] || [])];
  if (gospels.length) readings.gospel = alternatives(gospels);
  if (buf['Vaihtoehtoisia saarnatekstejä']) readings.alternativeSermonTexts = alternatives(buf['Vaihtoehtoisia saarnatekstejä']);
  entry.readings = readings;
  return entry;
}

function parseDoc(buffer) {
  const text = new TextDecoder('windows-1252').decode(buffer);
  const start = text.indexOf('Perikooppikalenteri');
  // The document body ends where Word's field/footnote markers begin.
  const endMarker = text.indexOf('\r\u0003', start);
  const body = text.slice(start, endMarker > 0 ? endMarker : undefined)
    .replace(/[\u0007\u0008]/g, '')
    .replace(/\u000b/g, '\r');

  const blocks = body.split(/\r\s*\r/).map(b => b.split('\r').map(l => l.trim()).filter(Boolean)).filter(b => b.length);
  // A block that starts with the colour line continues the previous block (e.g. after a description paragraph).
  for (let i = blocks.length - 1; i > 0; i--) {
    if (blocks[i][0].startsWith('Liturginen väri')) blocks.splice(i - 1, 2, [...blocks[i - 1], ...blocks[i]]);
  }
  const [header, ...rest] = blocks;
  const range = header[0].match(/(\d{1,2}\.\d{1,2}\.\d{4})–(\d{1,2}\.\d{1,2}\.\d{4})/);
  const cycleLine = header.find(l => /vuosikerta/.test(l));
  const result = {
    start: parseDateLine(range[1]).start,
    end: parseDateLine(range[2]).start,
    yearCycle: Number(cycleLine.match(/(\d)\. vuosikerta/)[1]),
    entries: [],
    weekdayNotes: [],
    undated: [],
  };

  // The header block also carries the first entry (date, name, ...)
  const firstBlock = header.slice(header.indexOf(cycleLine) + 1);
  const all = firstBlock.length ? [firstBlock, ...rest] : rest;

  let lastDate = null;
  for (let b = 0; b < all.length; b++) {
    let block = all[b];
    const first = block[0];
    const note = first.match(/^(?:Arkipäivinä|Lauantaina)?\s*\(?([\d.–]+\d{4})\)?\s*käytetään (.*) aineistoa/);
    if (note) {
      if (!/x/.test(first)) result.weekdayNotes.push({ range: note[1], material: note[2].replace(/x+/g, '').trim() });
      continue;
    }
    if (/^(Luomakunnan|Perheen) sunnuntai$/.test(first)) {
      result.undated.push(parseBlock(block));
      continue;
    }
    // Overview blocks ("Hiljainen viikko", "Pääsiäisen jälkeinen viikko ...") carry a date later in the block.
    const dateIdx = block.findIndex(l => parseDateLine(l.split(' ')[0]));
    if (dateIdx > 0) block = block.slice(dateIdx);
    else if (dateIdx < 0 && block.slice(1).every(l => l.startsWith('Liturginen väri'))) continue;

    const head = block[0].match(/^(\S+)(?: (.+))?$/);
    const date = head && parseDateLine(head[1]);
    if (date) {
      lastDate = date;
      const rest = head[2] ? [head[2], ...block.slice(1)] : block.slice(1);
      result.entries.push({ ...date, ...parseBlock(rest) });
    } else if (lastDate) {
      // A service without its own date line (e.g. Jouluyö) shares the previous date.
      result.entries.push({ ...lastDate, ...parseBlock(block) });
    }
  }
  return result;
}

const files = readdirSync(inputDir).filter(f => /^kv\d{4}\.doc$/.test(f)).sort();
const years = {};
for (const file of files) {
  const parsed = parseDoc(readFileSync(join(inputDir, file)));
  years[parsed.start.slice(0, 4)] = parsed;
  console.log(`${file}: ${parsed.start}–${parsed.end}, ${parsed.yearCycle}. vsk, ${parsed.entries.length} entries, ${parsed.weekdayNotes.length} weekday notes`);
}

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, JSON.stringify({
  source: 'Perikooppikalenteri, Suomen evankelis-luterilainen kirkko (evl.fi)',
  churchYears: years,
}, null, 2) + '\n');
console.log(`Wrote ${outputFile}`);
