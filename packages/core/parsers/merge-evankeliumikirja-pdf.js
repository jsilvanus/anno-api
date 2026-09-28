/**
 * Merge the PDF-parsed Evankeliumikirja (evankeliumikirja-pdf.json) into
 * all-days.json, filling what the earlier Markdown-based parse missed.
 *
 * Existing Bible texts are kept where present (the PDF text layer has
 * occasional spacing glitches); the PDF fills in:
 *   - readings of days with a single set of texts (jouluaatto, 26. sunnuntai helluntaista, …)
 *   - missing readings and texts in year cycles, "ks. N. vuosikerta" cross-references
 *   - alternative readings ("TAI") and alternative sermon texts
 *   - hallelujah verses and Lent psalm verses (psalmilause), which the earlier parse mixed up
 *   - psalms, prayers and liturgical colours where missing
 *   - theme, Latin name and alternative name of each day
 *   - introductions of each period (aika) → periods.json
 *
 * Usage:
 *   node packages/core/parsers/merge-evankeliumikirja-pdf.js packages/core/data refs/evankeliumikirja-pdf.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dataDir = process.argv[2] || 'packages/core/data';
const days = JSON.parse(readFileSync(join(dataDir, 'all-days.json'), 'utf-8'));
const pdfPath = process.argv[3] || 'refs/evankeliumikirja-pdf.json';
const pdf = JSON.parse(readFileSync(pdfPath, 'utf-8'));

// ─── Kerning repair ─────────────────────────────────────────────────────────
// pdftotext splits some italic words ("Jesa jan kirjasta", "Luukk aan muk aan").
// Rejoin two tokens when the joined word occurs elsewhere in the data and one
// of the halves does not.
const vocabulary = new Set();
const addWords = text => { for (const w of (text || '').split(/[^A-Za-zÅÄÖåäö]+/)) if (w) vocabulary.add(w.toLowerCase()); };
(function collect(value) {
  if (typeof value === 'string') addWords(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
})(days);

function fixKerning(text) {
  if (!text) return text;
  const known = w => vocabulary.has(w.toLowerCase().replace(/[^a-zåäö]/g, ''));
  const tokens = text.split(' ');
  const out = [tokens[0]];
  for (const token of tokens.slice(1)) {
    const prev = out.at(-1);
    const joinable = /[A-Za-zÅÄÖåäö]$/.test(prev) && /^[a-zåäö]/.test(token);
    if (joinable && known(prev + token) && (!known(prev) || !known(token) || Math.min(prev.length, token.length) <= 3)) {
      out[out.length - 1] = prev + token;
    } else {
      out.push(token);
    }
  }
  return out.join(' ');
}

function fixReadingKerning(reading) {
  if (!reading || typeof reading !== 'object') return reading;
  const out = { ...reading, bookIntro: fixKerning(reading.bookIntro) };
  if (out.alternatives) out.alternatives = out.alternatives.map(fixReadingKerning);
  return out;
}

const refKey = ref => (ref || '').replace(/\s*\(ks\.[^)]*\)/, '').replace(/[\s–-]+/g, '').toLowerCase();

/** Prefer the existing text for the same passage; otherwise take the PDF reading. */
function mergeReading(existing, fromPdf) {
  if (!fromPdf) return existing ?? null;
  const { alternatives = [], ...pdfReading } = fromPdf;
  const base = existing && refKey(existing.reference) === refKey(pdfReading.reference) && existing.text
    ? { ...existing, reference: pdfReading.reference }
    : pdfReading;
  const result = fixReadingKerning({ ...base });
  if (alternatives.length) result.alternatives = alternatives.map(fixReadingKerning);
  return result;
}

/** The earlier parse left the day's subtitle and theme as the first lines of its description. */
function stripHeadings(description, headings) {
  if (!description) return description;
  const lines = description.split('\n');
  const known = new Set(headings.filter(Boolean).map(h => h.replace(/\\/g, '').trim()));
  while (lines.length > 1 && known.has(lines[0].replace(/\\/g, '').replace(/\*$/, '').trim())) lines.shift();
  return lines.join('\n');
}

/** "Matt. 1:18--24 (ks. 1. vuosikerta)" → 1 */
const crossRefCycle = ref => Number(ref?.match(/\(ks\. (\d)\. vuosikerta\)/)?.[1]) || null;

function mergeCycle(existing = {}, fromPdf = {}) {
  const out = { ...existing };
  for (const key of ['firstReading', 'secondReading', 'gospel']) {
    const crossRef = existing[key]?.sameAsYearCycle ?? crossRefCycle(existing[key]?.reference) ?? crossRefCycle(fromPdf[key]?.reference);
    out[key] = mergeReading(existing[key], fromPdf[key]);
    if (crossRef && out[key]) {
      out[key].reference = out[key].reference.replace(/\s*\(ks\.[^)]*\)/, '');
      out[key].sameAsYearCycle = crossRef;
    }
  }
  if (fromPdf.alternativeSermonTexts?.length) out.alternativeSermonTexts = fromPdf.alternativeSermonTexts;
  return out;
}

/** A cross-referenced reading ("ks. 1. vuosikerta") is the same reading, alternatives included, as in that cycle. */
function resolveCrossReferences(yearCycles) {
  for (const cycle of Object.values(yearCycles)) {
    for (const key of ['firstReading', 'secondReading', 'gospel']) {
      const reading = cycle[key];
      const source = reading?.sameAsYearCycle && yearCycles[reading.sameAsYearCycle]?.[key];
      if (reading && source) cycle[key] = { ...source, sameAsYearCycle: reading.sameAsYearCycle };
    }
  }
}

function fixVerse(verse) {
  if (!verse) return null;
  return {
    ...verse,
    text: fixKerning(verse.text),
    reference: fixKerning(verse.reference),
    alternatives: (verse.alternatives || []).map(v => ({ ...v, text: fixKerning(v.text), reference: fixKerning(v.reference) })),
  };
}

const pdfBySlug = new Map(pdf.days.map(d => [d.slug, d]));
const seen = new Set();
const merged = [];

for (const day of days) {
  if (seen.has(day.slug)) continue; // all-days.json listed kansalliset-rukouspaivat twice
  seen.add(day.slug);
  const p = pdfBySlug.get(day.slug);
  if (!p) { merged.push(day); continue; }

  const out = { ...day };
  out.theme = p.theme ?? null;
  out.latinName = p.latinName ?? day.latinName ?? null;
  out.alternativeName = p.alternativeName ?? null;
  out.liturgicalColor = day.liturgicalColor ?? p.liturgicalColor ?? null;
  if (p.liturgicalColorLabel) out.liturgicalColorNote = p.liturgicalColorLabel;
  out.description = stripHeadings(day.description ?? p.description ?? null, [out.theme, out.alternativeName, p.name]);

  // Psalm: keep existing text, add alternatives from the PDF
  if (p.psalm) {
    const { alternativeAntiphons = [], alternativePsalm = null, ...pdfPsalm } = p.psalm;
    out.psalm = day.psalm?.text ? { ...day.psalm } : { ...pdfPsalm };
    if (!out.psalm.antiphon && pdfPsalm.antiphon) {
      out.psalm.antiphon = pdfPsalm.antiphon;
      out.psalm.antiphonReference = pdfPsalm.antiphonReference;
    }
    // Whole-chapter psalms ("Ps. 23") lost their reference in the earlier parse
    if (!out.psalm.reference) out.psalm.reference = pdfPsalm.reference;
    if (!out.psalm.antiphonReference && out.psalm.antiphon) out.psalm.antiphonReference = pdfPsalm.antiphonReference;
    out.psalm.alternativeAntiphons = alternativeAntiphons;
    out.psalm.alternativePsalm = alternativePsalm;
  }

  // Hallelujah verse and Lent psalm verse: always from the PDF (the earlier parse merged them with readings)
  out.hallelujah = fixVerse(p.hallelujah);
  out.psalmVerse = fixVerse(p.psalmVerse);

  if (p.yearCycles) {
    const cycles = {};
    for (const c of ['1', '2', '3']) cycles[c] = mergeCycle(day.yearCycles?.[c], p.yearCycles[c]);
    resolveCrossReferences(cycles);
    out.yearCycles = cycles;
    out.readings = null;
  } else if ((p.firstReading || p.secondReading || p.gospel) && !(p.reading || p.otReadings || p.ntReadings)) {
    // One set of texts for every year cycle
    // The earlier parse stored these under weekdayTexts; later runs find them under readings.
    out.readings = mergeCycle(
      day.readings ?? { gospel: day.weekdayTexts?.gospel, firstReading: day.weekdayTexts?.readings?.[0] },
      p,
    );
    out.yearCycles = null;
  } else {
    out.readings = null;
  }

  // Weekday material (1st Advent week, Holy Week days, Easter week days, Pentecost week)
  if (p.otReadings || p.ntReadings || p.reading || (day.weekdayTexts && !out.readings)) {
    const wt = day.weekdayTexts || {};
    out.weekdayTexts = {
      ...(p.otReadings || wt.otReadings ? { otReadings: (p.otReadings || []).map((r, i) => mergeReading(wt.otReadings?.[i], r)) } : {}),
      ...(p.ntReadings || wt.ntReadings ? { ntReadings: (p.ntReadings || []).map((r, i) => mergeReading(wt.ntReadings?.[i], r)) } : {}),
      ...(p.reading || wt.readings?.length ? { readings: [mergeReading(wt.readings?.[0], p.reading)].filter(Boolean) } : {}),
      gospel: mergeReading(wt.gospel, p.gospel) ?? null,
    };
  } else {
    out.weekdayTexts = null;
  }

  if (p.prayers?.length && (!day.prayers || day.prayers.length < p.prayers.length)) out.prayers = p.prayers;

  merged.push(out);
}

// Key order: identity, calendar, texts, prayers, hymns
const ORDER = ['name', 'slug', 'theme', 'latinName', 'alternativeName', 'season', 'period', 'description',
  'liturgicalColor', 'liturgicalColorNote', 'psalm', 'hallelujah', 'psalmVerse', 'yearCycles', 'readings',
  'weekdayTexts', 'prayers', 'hymns'];
const ordered = merged.map(d => Object.fromEntries([
  ...ORDER.filter(k => k in d).map(k => [k, d[k]]),
  ...Object.entries(d).filter(([k]) => !ORDER.includes(k)),
]));

writeFileSync(join(dataDir, 'all-days.json'), JSON.stringify(ordered, null, 2) + '\n');
const hymnCount = h => h ? Object.values(h).reduce((n, list) => n + (list?.length || 0), 0) : 0;
writeFileSync(join(dataDir, 'index.json'), JSON.stringify(ordered.map(d => ({
  name: d.name,
  slug: d.slug,
  theme: d.theme ?? null,
  season: d.season,
  period: d.period,
  latinName: d.latinName,
  liturgicalColor: d.liturgicalColor,
  hasYearCycles: !!d.yearCycles,
  hasReadings: !!d.readings,
  hasWeekdayTexts: !!d.weekdayTexts,
  prayerCount: d.prayers?.length || 0,
  hymnCount: hymnCount(d.hymns),
})), null, 2) + '\n');
writeFileSync(join(dataDir, 'periods.json'), JSON.stringify({
  source: pdf.source,
  periods: pdf.periods.filter(p => p.description),
}, null, 2) + '\n');
console.log(`Merged ${ordered.length} days; wrote periods.json`);
