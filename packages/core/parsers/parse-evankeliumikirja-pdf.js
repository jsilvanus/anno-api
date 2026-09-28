/**
 * Evankeliumikirja PDF parser
 *
 * Parses the official Evankeliumikirja (Kirkkokäsikirja II, 2021 edition)
 * PDF text into structured JSON, one object per holy day.
 *
 * The PDF is published at https://kirkkokasikirja.fi/evankeliumikirja.pdf.
 * Extract its text with poppler-utils first:
 *
 *   pdftotext -raw refs/evankeliumikirja.pdf refs/evankeliumikirja.txt
 *   pdftotext refs/evankeliumikirja.pdf refs/evankeliumikirja-layout.txt
 *   node packages/core/parsers/parse-evankeliumikirja-pdf.js
 *
 * The -raw text keeps reading order and line structure but loses the spaces
 * of some tightly justified lines ("syystämaailmaeimeitätunne,"); the default
 * layout text keeps those spaces, so glued lines are repaired from it.
 *
 * Pages are separated by form feeds. The table of contents gives the first
 * page of each day, which is how days are segmented. Each page starts with
 * its page number and, after a day's first page, a running header.
 *
 * The output is merged into all-days.json by merge-evankeliumikirja-pdf.js.
 */

import { readFileSync, writeFileSync } from 'fs';

const [
  input = 'refs/evankeliumikirja.txt',
  output = 'refs/evankeliumikirja-pdf.json',
  layoutInput = 'refs/evankeliumikirja-layout.txt',
] = process.argv.slice(2);

const LATIN_NAMES = new Set([
  'Epifania', 'Septuagesima', 'Sexagesima', 'Esto mihi', 'Invocavit', 'Reminiscere', 'Oculi',
  'Laetare', 'Judica', 'Quasimodogeniti', 'Misericordia Domini', 'Jubilate', 'Cantate', 'Rogate', 'Exaudi',
]);

// ─── Text helpers ───────────────────────────────────────────────────────────

/** Key for comparing headings: pdftotext splits some words with kerning spaces ("lukuk appale"). */
const squash = s => s.replace(/[\s­]+/g, '').toLowerCase();

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Join lines of a text block, undoing end-of-line hyphenation. */
function joinText(lines) {
  let out = '';
  for (const raw of lines) {
    const line = raw.replace(/\t+/g, ' ').trimEnd();
    if (!out) { out = line; continue; }
    // "Jee-" + "sus" → "Jeesus"; keep dashes that are words of their own ("–", " - ")
    if (/[a-zåäöA-ZÅÄÖ][-\u00ad]$/.test(out) && /^[a-zåäö]/.test(line)) out = out.slice(0, -1) + line;
    else out += '\n' + line;
  }
  return out.replace(/\u00ad/g, '').trim();
}

/** Normalise a Bible reference: collapse kerning spaces inside book names, en dash → "--" like the rest of the data. */
function normRef(ref) {
  let r = ref.trim().replace(/\s+/g, ' ');
  // "Miik a 5:1–4" → "Miika 5:1–4" (only inside the book name, before the first digit that starts a chapter)
  const m = r.match(/^((?:\d\. )?)(.*?)( \d.*)$/);
  if (m) r = m[1] + m[2].replace(/([A-Za-zÅÄÖåäö]) (?=[a-zåäö])/g, '$1') + m[3];
  return r.replace(/–/g, '--');
}

const REF_RE = /^(?:\d\.\s?)?[A-ZÅÄÖ][a-zåäö]*(?:\s?[a-zåäö]+)?\.?(?:\s[a-zåäö]\.)?\s\(?\d+(?:[:,–\s(]|$)/;
const INTRO_RE = /(luvusta\d+|psalmista\d+|kirjasta|kirjeestä|mukaan|luvuista[\d–-]+(?:ja\d+)?)$/;

// Additions to Daniel are cited as "Dan. lis. C:52".
const APOCRYPHA_REF_RE = /^Dan\. lis\. [A-Z]:\d+/;

function isRef(line) {
  const l = line.trim();
  return (REF_RE.test(l) || APOCRYPHA_REF_RE.test(l)) && l.length < 80;
}
function isIntro(line) {
  return line != null && INTRO_RE.test(squash(line)) && line.length < 90;
}

// ─── Table of contents ──────────────────────────────────────────────────────

function parseToc(pages) {
  const lines = [...pages[4].split('\n'), ...pages[5].split('\n')].map(l => l.trim()).filter(Boolean);
  const days = [];
  const periods = [];
  let season = null;
  let pending = '';
  for (const line of lines) {
    if (/^Hakemistot$/.test(line)) break;
    const day = line.match(/^(.*?[^.\d])\.+\s*(\d+)$/);
    if (day) {
      const title = (pending ? pending + ' ' : '') + day[1].trim();
      pending = '';
      days.push({ title, page: Number(day[2]), season, period: periods.at(-1)?.name ?? null });
      continue;
    }
    const period = line.match(/^(.*\D) (\d+)$/);
    if (period && !/^\d+\./.test(line)) {
      periods.push({ name: period[1].trim(), page: Number(period[2]), season });
      continue;
    }
    if (['Joulujakso', 'Pääsiäisjakso', 'Helluntaijakso', 'Erityispyhät'].includes(line)) {
      season = line;
      continue;
    }
    if (['Sisällys', 'Loppiaisaika', 'Kirkkovuoden pyhäpäivien'].includes(line) || /^\d+$/.test(line) || /raamatuntekstit ja rukoukset|Evankeliumikirjan käyttäjälle/.test(line)) {
      if (line === 'Loppiaisaika') periods.push({ name: line, page: null, season });
      continue;
    }
    pending = pending ? pending + ' ' + line : line;
  }
  return { days, periods };
}

// ─── Day parsing ────────────────────────────────────────────────────────────

const HEADINGS = new Map([
  ['päivänpsalmi', 'psalm'],
  ['psalmi', 'weekdayPsalm'],
  ['hallelujasäe', 'hallelujah'],
  ['psalmilause', 'psalmVerse'],
  ['1.lukukappale', 'firstReading'],
  ['2.lukukappale', 'secondReading'],
  ['lukukappale', 'reading'],
  ['evankeliumi', 'gospel'],
  ['evankeliumi*', 'gospel'],
  ['vanhantestamentinlukukappaleet', 'otReadings'],
  ['uudentestamentinlukukappaleet', 'ntReadings'],
  ['vaihtoehtoisiasaarnatekstejä', 'alternativeSermonTexts'],
  ['päivänrukoukset', 'prayers'],
  ['rukouksia', 'prayers'],
  ['rukous', 'prayers'],
]);

function dayLines(pages, from, to, title) {
  const lines = [];
  for (let p = from; p <= to; p++) {
    const pageLines = (pages[p - 1] || '').split('\n');
    let i = 0;
    if (pageLines[i]?.trim() === String(p)) i++;
    // running header on continuation pages
    if (p !== from && pageLines[i] && squash(pageLines[i]) === squash(title.replace(/\s*\(.*\)$/, ''))) i++;
    lines.push(...pageLines.slice(i));
  }
  // drop trailing empty lines, keep internal structure
  return lines.map(l => l.replace(/\s+$/, ''));
}

function parseReadingsBlock(lines) {
  // Returns [{ reference, bookIntro, text, alternatives: [...] }] grouped by "TAI"
  const groups = [[]];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line === 'TAI') { groups.push([]); current = null; continue; }
    if (isRef(line) && isIntro(lines[i + 1]?.trim())) {
      current = { reference: normRef(line), bookIntro: lines[i + 1].trim(), lines: [] };
      groups.at(-1).push(current);
      i++;
      continue;
    }
    if (current) current.lines.push(lines[i]);
    else if (isRef(line)) groups.at(-1).push({ reference: normRef(line), bookIntro: null, lines: [] }); // reference only
  }
  const readings = groups.filter(g => g.length).map(g => g.map(r => ({
    reference: r.reference,
    bookIntro: r.bookIntro,
    text: joinText(r.lines) || null,
  })));
  return readings;
}

/** Verse block: text lines followed by a reference line ("Ps. 85:8"). */
function parseVerseBlock(lines) {
  const alternatives = [];
  let buf = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === 'TAI') continue;
    if (isRef(line) && buf.length) {
      alternatives.push({ text: joinText(buf), reference: normRef(line) });
      buf = [];
    } else {
      buf.push(raw);
    }
  }
  if (buf.length) alternatives.push({ text: joinText(buf), reference: null });
  return alternatives;
}

function parsePsalm(lines) {
  // Antifoni: … ref [TAI …] Psalmi: … ref Kunnia Isälle… Antifoni toistetaan. [TAI Antifoni: …]
  const variants = [];
  let v = null;
  let mode = null;
  let buf = [];
  const flush = () => {
    if (!v || !buf.length) { buf = []; return; }
    const parts = parseVerseBlock(buf);
    if (mode === 'antiphon') v.antiphons.push(...parts);
    if (mode === 'psalm') v.psalms.push(...parts);
    buf = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const key = squash(line);
    if (key === 'antifoni:') {
      flush();
      if (!v || v.psalms.length) { v = { antiphons: [], psalms: [], gloriaPatri: false }; variants.push(v); }
      mode = 'antiphon';
      continue;
    }
    if (key === 'psalmi:') {
      flush();
      if (!v) { v = { antiphons: [], psalms: [], gloriaPatri: false }; variants.push(v); }
      mode = 'psalm';
      continue;
    }
    if (line === 'TAI' && mode === 'psalm') { flush(); mode = null; continue; }
    if (line === 'TAI') { flush(); continue; }
    if (/^Kunnia Isälle/.test(line)) { flush(); v.gloriaPatri = true; mode = 'gloria'; continue; }
    if (/^Antifoni toistetaan/.test(line)) { flush(); mode = null; continue; }
    if (mode === 'gloria') continue;
    if (mode) buf.push(raw);
  }
  flush();
  return variants.map(x => ({
    antiphon: x.antiphons[0]?.text ?? null,
    antiphonReference: x.antiphons[0]?.reference ?? null,
    alternativeAntiphons: x.antiphons.slice(1),
    text: x.psalms[0]?.text ?? null,
    reference: x.psalms[0]?.reference ?? null,
    gloriaPatri: x.gloriaPatri,
  }));
}

function parsePrayers(lines) {
  const prayers = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const n = line.match(/^(\d+)\.$/);
    if (n) { cur = { number: Number(n[1]), lines: [] }; prayers.push(cur); continue; }
    if (!cur) { cur = { number: 1, lines: [] }; prayers.push(cur); }
    cur.lines.push(raw);
  }
  return prayers.map(p => ({ number: p.number, text: joinText(p.lines) }));
}

function parseDay(lines, tocTitle) {
  const titleBase = tocTitle.replace(/\s*\((.*)\)$/, '');
  const paren = tocTitle.match(/\((.*)\)$/)?.[1] ?? null;
  const day = {
    name: titleBase,
    slug: slugify(titleBase),
    latinName: null,
    alternativeName: null,
    theme: null,
    description: null,
    liturgicalColor: null,
  };
  if (paren) {
    const parts = paren.split(',').map(s => s.trim());
    const latin = parts.filter(p => LATIN_NAMES.has(p));
    const other = parts.filter(p => !LATIN_NAMES.has(p));
    if (latin.length) day.latinName = latin.join(', ');
    if (other.length) day.alternativeName = other.join(', ');
  }

  let i = 0;
  // Skip title lines: consume lines until their squashed concatenation covers the title
  let acc = '';
  while (i < lines.length && acc.length < squash(titleBase).length) {
    acc += squash(lines[i]);
    i++;
  }
  // Header: subtitle / theme lines and description until "Liturginen väri"
  const header = [];
  while (i < lines.length && !/^Liturginen väri/.test(lines[i].trim()) && !['raamatuntekstit', 'virsisuositukset'].includes(squash(lines[i]))) {
    header.push(lines[i]);
    i++;
  }
  const headerLines = header.map(l => l.trim()).filter(Boolean);
  // Short lines without sentence punctuation at the start are subtitles (alternative name, theme).
  const subtitles = [];
  while (headerLines.length && headerLines[0].length < 60 && !/[.:;]$/.test(headerLines[0]) && subtitles.length < 2) {
    const next = headerLines[1];
    // A wrapped description sentence continues on the next line in lower case; a subtitle does not.
    if (next && /^[a-zåäö]/.test(next)) break;
    subtitles.push(headerLines.shift());
  }
  const altNames = new Set([day.alternativeName, day.latinName].filter(Boolean).map(squash));
  const themes = subtitles.filter(s => !altNames.has(squash(s)));
  if (themes.length) day.theme = themes.at(-1);
  if (themes.length > 1 && !day.alternativeName) day.alternativeName = themes[0];
  day.description = joinText(headerLines) || null;

  // Liturgical colour (may wrap over lines until a full stop)
  if (/^Liturginen väri/.test(lines[i]?.trim() ?? '')) {
    const colour = [lines[i].trim()];
    while (!/\.$/.test(colour.at(-1)) && i + 1 < lines.length && !/^Virsisuositukset/.test(lines[i + 1].trim())) {
      i++;
      colour.push(lines[i].trim());
    }
    day.liturgicalColor = joinText(colour).replace(/\n/g, ' ').replace(/^Liturginen väri(?: [^:]*)?:\s*/, '').replace(/\.$/, '');
    day.liturgicalColorLabel = colour[0].match(/^Liturginen väri([^:]*):/)?.[1]?.trim() || null;
    i++;
  }

  // Skip hymn recommendations (kept from the existing data)
  while (i < lines.length && squash(lines[i]) !== 'raamatuntekstit' && !HEADINGS.has(squash(lines[i]))) i++;
  if (squash(lines[i] ?? '') === 'raamatuntekstit') i++;

  // Sections
  const sections = []; // { key, cycle, lines }
  let cycle = null;
  let current = null;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    const key = squash(line);
    const cycleMatch = key.match(/^(\d)\.vuosikerta$/);
    if (cycleMatch) { cycle = cycleMatch[1]; current = null; continue; }
    if (HEADINGS.has(key)) {
      current = { key: HEADINGS.get(key), cycle: ['firstReading', 'secondReading', 'gospel', 'alternativeSermonTexts'].includes(HEADINGS.get(key)) ? cycle : null, lines: [] };
      if (current.key === 'prayers' || current.key === 'psalm' || current.key === 'hallelujah' || current.key === 'psalmVerse') cycle = null;
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(lines[i]);
  }

  const cycles = {};
  const single = {};
  for (const s of sections) {
    const target = s.cycle ? (cycles[s.cycle] ??= {}) : single;
    switch (s.key) {
      case 'psalm': {
        const variants = parsePsalm(s.lines);
        target.psalm = variants[0] ? { ...variants[0], alternativePsalm: variants[1] ?? null } : null;
        break;
      }
      case 'weekdayPsalm': {
        const parts = parseVerseBlock(s.lines.filter(l => !/^Kunnia Isälle|^ja Pyhälle Hengelle|^niin kuin oli alussa|^iankaikkisesta/.test(l.trim())));
        target.psalm = { antiphon: null, antiphonReference: null, alternativeAntiphons: [], text: parts[0]?.text ?? null, reference: parts[0]?.reference ?? null, gloriaPatri: s.lines.some(l => /^Kunnia Isälle/.test(l.trim())), alternativePsalm: null };
        break;
      }
      case 'hallelujah':
      case 'psalmVerse': {
        const parts = parseVerseBlock(s.lines);
        target[s.key] = parts[0] ? { ...parts[0], alternatives: parts.slice(1) } : null;
        break;
      }
      case 'firstReading':
      case 'secondReading':
      case 'gospel':
      case 'reading': {
        const groups = parseReadingsBlock(s.lines);
        const flat = groups.map(g => g[0]).filter(Boolean);
        if (flat.length) target[s.key] = { ...flat[0], alternatives: flat.slice(1) };
        break;
      }
      case 'otReadings':
      case 'ntReadings': {
        target[s.key] = parseReadingsBlock(s.lines).flat();
        break;
      }
      case 'alternativeSermonTexts': {
        target.alternativeSermonTexts = s.lines.map(l => l.trim()).filter(l => l && isRef(l)).map(normRef);
        break;
      }
      case 'prayers':
        single.prayers = parsePrayers(s.lines);
        break;
    }
  }
  if (Object.keys(cycles).length) day.yearCycles = cycles;
  Object.assign(day, single);
  return day;
}

// ─── Spacing repair ─────────────────────────────────────────────────────────

/**
 * Build a lookup from the layout-mode text: the text with all whitespace
 * removed, plus a map back to positions in the original.
 */
function spacingIndex(layoutText) {
  const text = layoutText.replace(/\u00ad/g, '');
  let plain = '';
  const pos = [];
  for (let i = 0; i < text.length; i++) {
    if (!/\s/.test(text[i])) { plain += text[i]; pos.push(i); }
  }
  return { text, plain, pos };
}

/** Restore the spaces of a glued raw line ("syystämaailmaeimeitätunne,…") from the layout text. */
function repairSpacing(line, index) {
  const tokens = line.trim().split(/\s+/);
  if (!tokens.some(t => t.length > 24 && /[,.!?»:;]./.test(t))) return line;
  // A passage may occur more than once in the book; its spacing is the same everywhere.
  const trailing = line.trimEnd().match(/[-\u00ad]$/)?.[0] ?? '';
  const key = line.replace(/\s+/g, '').replace(/\u00ad/g, '').replace(/-$/, '');
  const at = index.plain.indexOf(key);
  if (at < 0) return line;
  const original = index.text.slice(index.pos[at], index.pos[at + key.length - 1] + 1);
  return original.replace(/\s+/g, ' ') + trailing;
}

// ─── Main ───────────────────────────────────────────────────────────────────

let rawText = readFileSync(input, 'utf-8');
try {
  const index = spacingIndex(readFileSync(layoutInput, 'utf-8'));
  rawText = rawText.split('\n').map(l => repairSpacing(l, index)).join('\n');
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
  console.warn(`No layout text at ${layoutInput}; glued lines are left as is.`);
}
const pages = rawText.split('\f');
const { days: toc, periods } = parseToc(pages);

const days = [];
for (let d = 0; d < toc.length; d++) {
  const entry = toc[d];
  const next = toc[d + 1]?.page ?? 768; // index section starts at page 768
  const periodStart = periods.find(p => p.page && p.page > entry.page && p.page < next)?.page;
  const last = (periodStart ?? next) - 1;
  const lines = dayLines(pages, entry.page, last, entry.title);
  const day = parseDay(lines, entry.title);
  day.season = entry.season;
  day.period = entry.period;
  day.pages = [entry.page, last];
  days.push(day);
}

// Period (aika) introductions: from the period page to the first day page.
const periodIntros = periods.filter(p => p.page && p.season).map(p => {
  const firstDay = toc.find(d => d.page > p.page)?.page ?? p.page + 1;
  const body = dayLines(pages, p.page, firstDay - 1, p.name).map(l => l.trim()).filter(Boolean);
  // The page may open with the season heading and then the (kerned, possibly wrapped) period heading.
  let i = 0;
  if (p.season && squash(body[0] ?? '') === squash(p.season)) i++;
  let acc = '';
  while (i < body.length && acc.length < squash(p.name).length) acc += squash(body[i++]);
  return { name: p.name, season: p.season, description: joinText(body.slice(i)) || null };
});

writeFileSync(output, JSON.stringify({ source: 'Evankeliumikirja (Kirkkokäsikirja II), uudistettu painos 2021, PDF', periods: periodIntros, days }, null, 2) + '\n');
console.log(`Parsed ${days.length} days and ${periodIntros.length} period introductions → ${output}`);
