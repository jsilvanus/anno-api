/**
 * Evankeliumikirja Parser
 *
 * Parses the Evankeliumikirja (Finnish Evangelical-Lutheran Church Book of Gospels)
 * from Markdown format into structured JSON data.
 *
 * Usage: node parse-evankeliumikirja.js <input.md> <output-dir>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// ─── Configuration ──────────────────────────────────────────────────────────

const BIBLE_REF_PATTERN = /^(?:(?:\d\.\s+)?(?:Mooseksen kirja|Samuelin kirja|kuninkaiden kirja|aikakirja|Makk\.|Kun\.|Sam\.)|(?:Ps|1|2|3)\.\s+\d|(?:Jes|Jer|Hes|Dan|Hoos|Jooel|Aam|Ob|Joona|Miika|Nah|Hab|Sef|Hag|Sak|Mal|Matt|Mark|Luuk|Joh|Ap|Room|1|2|3)\.\s|(?:Sananl|Saarn|Laulujen laulu|Jes|Jer|Val|Hes|Dan|Hoos|Jooel|Aam|Ob|Joona|Miika|Nah|Hab|Sef|Hag|Sak|Mal|Matt|Mark|Luuk|Joh|Ap|Room|Gal|Ef|Fil|Kol|Tiit|Filem|Hepr|Jaak|Ilm)\b)/;

// Matches references like "Jes. 62:10--12", "Matt. 21:1--9", "Ps. 24:7--10", "1. Joh. 4:7--12"
const VERSE_REF_REGEX = /^(?:\d\.\s+)?(?:[A-ZÄÖÅ][a-zäöå]+\.?\s*(?:t\.\s*)?)\s*\d+[\s:]\d+(?:\s*--\s*\d+)?(?:,\s*\d+(?:\s*--\s*\d+)?)*$/;

// Broader reference match - includes book name + chapter:verse
const BROAD_REF_REGEX = /^(?:\d\.\s+)?[A-ZÄÖÅ][a-zäöåA-ZÄÖÅ\s.]+\d+[:\s]\d+/;

// Short reference like "Ps. 24:7--10" or "Sak. 9:9" or "Luuk. 24:34"
const SHORT_REF_REGEX = /^(?:\d\.\s+)?(?:[A-ZÄÖÅ][a-zäöå]+\.?\s*(?:t\.\s*)?)\s*\d+[.:]\d+/;

// Book intro like "Jesajan kirjasta, luvusta 62" or "Evankeliumista Matteuksen mukaan, luvusta 21"
const BOOK_INTRO_REGEX = /(?:kirjasta|mukaan|kirjeestä|ilmestyksestä|teoista|kirjeestään|laulujen laulusta)/i;

// ─── Helpers ────────────────────────────────────────────────────────────────

// Matches "Evankeliumi" with optional markdown footnote marker: Evankeliumi, Evankeliumi*, Evankeliumi\*
function isEvankeliumiLine(line) {
  const t = line.trim();
  return t === 'Evankeliumi' || t === 'Evankeliumi*' || t === 'Evankeliumi\\*';
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/\(.*?\)/g, '')          // Remove parenthetical content
    .replace(/\*/g, '')               // Remove markdown italic markers
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

function cleanText(text) {
  return text
    .replace(/\\\s*$/gm, '')   // Remove trailing backslashes (line continuations)
    .replace(/\\\n/g, '\n')    // Convert \<newline> to plain newline
    .trim();
}

function isLineBreakContinuation(line) {
  return line.endsWith('\\');
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
    .replace(/\*(.*?)\*/g, '$1')       // italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // links
    .trim();
}

// ─── Section Parsing ────────────────────────────────────────────────────────

/**
 * Split the document into major sections by #### headings (holy day entries).
 * Returns an array of { heading, content, lineStart } objects.
 */
function splitIntoEntries(lines) {
  const entries = [];
  let currentEntry = null;

  // Track season/period context from ## and ### headings
  let currentSeason = null;
  let currentPeriod = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track seasons (## level)
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      const seasonName = line.replace(/^## /, '').trim();
      // Only track church year seasons, not indexes
      if (!seasonName.match(/^\d\.|^Hakemistot/)) {
        currentSeason = seasonName;
        currentPeriod = null;
      } else {
        // We've reached the indexes section, stop parsing
        if (currentEntry) {
          entries.push(currentEntry);
        }
        break;
      }
      continue;
    }

    // Track periods (### level)
    if (line.startsWith('### ')) {
      currentPeriod = line.replace(/^### /, '').trim();
      continue;
    }

    // Holy day entries (#### level)
    if (line.startsWith('#### ')) {
      if (currentEntry) {
        entries.push(currentEntry);
      }
      const heading = line.replace(/^#### /, '').trim();
      currentEntry = {
        heading,
        season: currentSeason,
        period: currentPeriod,
        lines: [],
        lineStart: i,
      };
      continue;
    }

    if (currentEntry) {
      currentEntry.lines.push(line);
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
}

// ─── Entry Parsing ──────────────────────────────────────────────────────────

function parseEntry(entry) {
  const { heading, season, period, lines } = entry;

  const result = {
    name: cleanHeading(heading),
    slug: slugify(heading),
    season: season || null,
    period: period || null,
    latinName: extractLatinName(heading),
    description: null,
    liturgicalColor: null,
    hymns: null,
    psalm: null,
    hallelujah: null,
    psalmVerse: null,  // Psalmilause (Lent alternative)
    yearCycles: null,
    prayers: null,
    weekdayTexts: null, // For weekday entries with multiple OT/NT readings
  };

  // Find major section boundaries
  const textStart = findLine(lines, /^#{5}\s+Raamatuntekstit/);
  const prayerStart = findLine(lines, /^#{5}\s+(?:Päivän rukoukset|Rukouksi[at]|Rukous)$/);

  // Parse description + metadata (everything before "##### Raamatuntekstit")
  const metaLines = textStart !== -1 ? lines.slice(0, textStart) : lines.slice(0, prayerStart !== -1 ? prayerStart : lines.length);
  parseMetadata(metaLines, result);

  // Parse Bible texts section
  if (textStart !== -1) {
    const textEnd = prayerStart !== -1 ? prayerStart : lines.length;
    const textLines = lines.slice(textStart + 1, textEnd);
    parseBibleTexts(textLines, result);
  }

  // Parse prayers section
  if (prayerStart !== -1) {
    const prayerLines = lines.slice(prayerStart + 1);
    result.prayers = parsePrayers(prayerLines);
  }

  return result;
}

function cleanHeading(heading) {
  // Remove footnote markers like \*
  return heading.replace(/\\\*/g, '').replace(/\*/g, '').trim();
}

function extractLatinName(heading) {
  // Extract Latin names from parentheses, e.g. "1. paastonajan sunnuntai (Invocavit)"
  const match = heading.match(/\(([A-Z][a-z]+(?:\s+[a-z]+)*)\)/);
  return match ? match[1] : null;
}

// ─── Metadata Parsing ───────────────────────────────────────────────────────

function parseMetadata(lines, result) {
  const text = lines.join('\n');

  // Extract liturgical color
  const colorMatch = text.match(/LITURGINEN VÄRI:\s*(.+?)(?:\n\n|\n[A-Z])/s);
  if (colorMatch) {
    result.liturgicalColor = colorMatch[1].replace(/\n/g, ' ').trim().replace(/\.$/, '');
  }

  // Extract hymn suggestions
  const hymnStart = lines.findIndex(l => l.match(/^VIRSISUOSITUKSET/));
  if (hymnStart !== -1) {
    const colorIdx = lines.findIndex(l => l.match(/^LITURGINEN VÄRI/));
    const descEnd = colorIdx !== -1 ? colorIdx : hymnStart;
    result.hymns = parseHymns(lines.slice(hymnStart + 1));

    // Description is everything before LITURGINEN VÄRI (or VIRSISUOSITUKSET)
    const descLines = lines.slice(0, descEnd).filter(l => l.trim());
    result.description = descLines.join('\n').trim() || null;
  } else {
    // No hymns section - look for LITURGINEN VÄRI
    const colorIdx = lines.findIndex(l => l.match(/^LITURGINEN VÄRI/));
    const descEnd = colorIdx !== -1 ? colorIdx : lines.length;
    const descLines = lines.slice(0, descEnd).filter(l => l.trim());
    result.description = descLines.join('\n').trim() || null;
  }

  // Clean description from markdown
  if (result.description) {
    result.description = stripMarkdown(result.description);
  }
}

function parseHymns(lines) {
  const hymns = {
    opening: [],     // A (alkuvirsi)
    dayHymns: [],    // Pv (päivän virsi)
    additional: [],  // Lisäksi
    other: [],       // Unnumbered/other
  };

  let currentCategory = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Stop at next section
    if (trimmed.startsWith('#')) break;

    // Determine category
    if (trimmed.startsWith('A ')) {
      currentCategory = 'opening';
      const hymnData = parseHymnLine(trimmed.replace(/^A\s+/, ''));
      if (hymnData) hymns.opening.push(hymnData);
      continue;
    }
    if (trimmed.startsWith('Pv ')) {
      currentCategory = 'dayHymns';
      const hymnData = parseHymnLine(trimmed.replace(/^Pv\s+/, ''));
      if (hymnData) hymns.dayHymns.push(hymnData);
      continue;
    }
    if (trimmed.startsWith('Lisäksi ')) {
      currentCategory = 'additional';
      const hymnData = parseHymnLine(trimmed.replace(/^Lisäksi\s+/, ''));
      if (hymnData) hymns.additional.push(hymnData);
      continue;
    }

    // Continuation of current category
    const hymnData = parseHymnLine(trimmed);
    if (hymnData) {
      if (currentCategory) {
        hymns[currentCategory].push(hymnData);
      } else {
        hymns.other.push(hymnData);
      }
    }
  }

  return hymns;
}

function parseHymnLine(line) {
  // Match "2 Avaja porttis, ovesi" or "756 Oi saavu jo, Immanuel" or "299:1--6 Ei mikään..."
  const match = line.match(/^(\d+(?::\d+(?:--\d+)?)?)\s+(.+)/);
  if (match) {
    return { number: match[1], title: match[2].trim() };
  }
  // Some hymn lines are just descriptions like "Pääsiäisvirsien lisäksi sopivat"
  if (line.match(/virsien lisäksi|sopivat/i)) {
    return null; // Skip descriptive text
  }
  return null;
}

// ─── Bible Texts Parsing ────────────────────────────────────────────────────

function parseBibleTexts(lines, result) {
  // Determine if this is a Sunday entry (with year cycles) or weekday entry
  const hasYearCycles = lines.some(l => l.match(/^\d+\\\.\s+vuosikerta/));
  const hasWeekdayStructure = lines.some(l => l.match(/^Vanhan testamentin lukukappaleet|^Uuden testamentin lukukappaleet/));

  // Parse psalm (always present)
  result.psalm = parsePsalm(lines);

  // Parse hallelujah verse
  result.hallelujah = parseHallelujah(lines);

  // Parse psalmilause (Lent alternative)
  result.psalmVerse = parsePsalmVerse(lines);

  if (hasYearCycles) {
    result.yearCycles = parseYearCycles(lines);
  } else if (hasWeekdayStructure) {
    result.weekdayTexts = parseWeekdayTexts(lines);
  } else {
    // Some entries have a simple structure (single readings without year cycles)
    result.weekdayTexts = parseSimpleReadings(lines);
  }
}

function parsePsalm(lines) {
  const psalmSection = findSection(lines, /^Päivän psalmi$|^Psalmi$/);
  if (!psalmSection) return null;

  const psalm = {
    antiphon: null,
    antiphonReference: null,
    text: null,
    reference: null,
    gloriaPatri: false,
    alternativePsalm: null,
  };

  const sectionLines = psalmSection.lines;
  let phase = 'pre-antiphon'; // pre-antiphon -> antiphon -> psalm -> done
  let currentText = [];
  let foundAntifoniLabel = false;

  for (let i = 0; i < sectionLines.length; i++) {
    const line = sectionLines[i].trim();

    // Stop at next major section
    if (line.match(/^Hallelujasäe$|^Psalmilause$|^\d+\\\.\s+vuosikerta|^Vanhan testamentin|^Uuden testamentin|^Lukukappale$/) || isEvankeliumiLine(line)) {
      break;
    }

    // Handle TAI (alternative psalm)
    if (line === 'TAI' && psalm.text) {
      // There's an alternative psalm; parse the rest as alternative
      const remaining = sectionLines.slice(i + 1);
      psalm.alternativePsalm = parsePsalm(
        [{ trim: () => 'Psalmi' }].concat(remaining.map(l => ({ trim: () => l.trim() })))
          .map(x => (typeof x === 'string' ? x : x.trim()))
      );
      // Actually, let's do this simpler by just noting there's an alternative
      psalm.alternativePsalm = parseAlternativePsalm(sectionLines.slice(i + 1));
      break;
    }

    if (line === 'Antifoni:' || line === 'Antifoni') {
      foundAntifoniLabel = true;
      phase = 'antiphon';
      currentText = [];
      continue;
    }

    if (line === 'Psalmi:' || line === 'Psalmi') {
      // Save antiphon
      if (currentText.length > 0 && phase === 'antiphon') {
        const { text, reference } = extractTextAndReference(currentText);
        psalm.antiphon = text;
        psalm.antiphonReference = reference;
      }
      phase = 'psalm';
      currentText = [];
      continue;
    }

    if (line === 'Antifoni toistetaan.' || line === 'Antifoni toistetaan') {
      // Save psalm text
      if (currentText.length > 0 && phase === 'psalm') {
        const { text, reference } = extractTextAndReference(currentText);
        psalm.text = text;
        psalm.reference = reference;
      }
      continue;
    }

    if (line.startsWith('Kunnia Isälle ja Pojalle') || line.startsWith('Kunnia Isälle')) {
      // Gloria Patri - save psalm text first
      if (currentText.length > 0 && phase === 'psalm' && !psalm.text) {
        const { text, reference } = extractTextAndReference(currentText);
        psalm.text = text;
        psalm.reference = reference;
        currentText = [];
      }
      psalm.gloriaPatri = true;
      // Skip the rest of the Gloria Patri lines
      while (i + 1 < sectionLines.length) {
        const nextLine = sectionLines[i + 1].trim();
        if (nextLine === '' || nextLine.startsWith('Kunnia') || nextLine.startsWith('ja Pyhälle') ||
            nextLine.startsWith('niin kuin oli') || nextLine.startsWith('iankaikkisesta') ||
            nextLine === 'Aamen.' || nextLine.endsWith('Aamen.')) {
          i++;
          continue;
        }
        break;
      }
      continue;
    }

    if (line === '' && currentText.length === 0) continue;

    // If we haven't found an "Antifoni:" label but we're in the psalm section
    // and the text looks like psalm content, accumulate it
    if (phase === 'pre-antiphon' && !foundAntifoniLabel && line && !line.match(/^Antifoni/)) {
      // This might be a weekday psalm without explicit antiphon label
      phase = 'psalm';
    }

    currentText.push(line);
  }

  // Handle case where psalm text wasn't terminated by "Antifoni toistetaan"
  if (currentText.length > 0) {
    if (phase === 'antiphon' && !psalm.antiphon) {
      const { text, reference } = extractTextAndReference(currentText);
      psalm.antiphon = text;
      psalm.antiphonReference = reference;
    } else if (phase === 'psalm' && !psalm.text) {
      const { text, reference } = extractTextAndReference(currentText);
      psalm.text = text;
      psalm.reference = reference;
    }
  }

  return (psalm.text || psalm.antiphon) ? psalm : null;
}

function parseAlternativePsalm(lines) {
  const alt = {
    antiphon: null,
    antiphonReference: null,
    text: null,
    reference: null,
  };

  let phase = 'pre';
  let currentText = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.match(/^Hallelujasäe$|^Psalmilause$|^\d+\\\.\s+vuosikerta|^Antifoni toistetaan/)) {
      if (currentText.length > 0 && phase === 'psalm') {
        const { text, reference } = extractTextAndReference(currentText);
        alt.text = text;
        alt.reference = reference;
      }
      break;
    }

    if (line === 'Antifoni:' || line === 'Antifoni') {
      phase = 'antiphon';
      currentText = [];
      continue;
    }
    if (line === 'Psalmi:' || line === 'Psalmi') {
      if (currentText.length > 0) {
        const { text, reference } = extractTextAndReference(currentText);
        alt.antiphon = text;
        alt.antiphonReference = reference;
      }
      phase = 'psalm';
      currentText = [];
      continue;
    }

    if (line.startsWith('Kunnia Isälle')) continue;
    if (line === '') continue;

    currentText.push(line);
  }

  if (currentText.length > 0 && !alt.text) {
    const { text, reference } = extractTextAndReference(currentText);
    if (phase === 'psalm') {
      alt.text = text;
      alt.reference = reference;
    } else if (phase === 'antiphon') {
      alt.antiphon = text;
      alt.antiphonReference = reference;
    }
  }

  return (alt.text || alt.antiphon) ? alt : null;
}

function parseHallelujah(lines) {
  const section = findSection(lines, /^Hallelujasäe$/);
  if (!section) return null;

  const textLines = [];
  for (const line of section.lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.match(/^Psalmilause$|^\d+\\\.\s+vuosikerta|^Vanhan testamentin|^Uuden testamentin|^Lukukappale$|^TAI$/) || isEvankeliumiLine(trimmed)) break;
    textLines.push(trimmed);
  }

  const { text, reference } = extractTextAndReference(textLines);
  return text ? { text, reference } : null;
}

function parsePsalmVerse(lines) {
  const section = findSection(lines, /^Psalmilause$/);
  if (!section) return null;

  // Psalmilause can have alternatives (TAI)
  const verses = [];
  let currentText = [];

  for (const line of section.lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.match(/^\d+\\\.\s+vuosikerta|^Vanhan testamentin|^Uuden testamentin/)) break;

    if (trimmed === 'TAI') {
      if (currentText.length > 0) {
        const { text, reference } = extractTextAndReference(currentText);
        if (text) verses.push({ text, reference });
        currentText = [];
      }
      continue;
    }

    currentText.push(trimmed);
  }

  if (currentText.length > 0) {
    const { text, reference } = extractTextAndReference(currentText);
    if (text) verses.push({ text, reference });
  }

  return verses.length > 0 ? verses : null;
}

function parseYearCycles(lines) {
  const cycles = {};

  // Find year cycle starts
  const cycleStarts = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\d+)\\\.\s+vuosikerta/);
    if (match) {
      cycleStarts.push({ cycle: parseInt(match[1]), index: i });
    }
  }

  for (let c = 0; c < cycleStarts.length; c++) {
    const start = cycleStarts[c].index + 1;
    const end = c + 1 < cycleStarts.length ? cycleStarts[c + 1].index : lines.length;
    const cycleLines = lines.slice(start, end);

    cycles[cycleStarts[c].cycle] = parseReadings(cycleLines);
  }

  return Object.keys(cycles).length > 0 ? cycles : null;
}

function parseReadings(lines) {
  const readings = {
    firstReading: null,
    secondReading: null,
    gospel: null,
    alternativeSermonTexts: [],
  };

  // Find reading section boundaries
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.match(/^1\\\.\s+lukukappale$/)) {
      sections.push({ type: 'firstReading', index: i });
    } else if (line.match(/^2\\\.\s+lukukappale$/)) {
      sections.push({ type: 'secondReading', index: i });
    } else if (isEvankeliumiLine(line)) {
      sections.push({ type: 'gospel', index: i });
      // Skip footnote lines that follow "Evankeliumi*"
    } else if (line === 'Lukukappale') {
      // Single reading (weekday entries)
      sections.push({ type: 'firstReading', index: i });
    }
  }

  for (let s = 0; s < sections.length; s++) {
    const start = sections[s].index + 1;
    const end = s + 1 < sections.length ? sections[s + 1].index : lines.length;
    const readingLines = lines.slice(start, end);

    const reading = parseSingleReading(readingLines);
    if (reading) {
      readings[sections[s].type] = reading;
    }
  }

  return readings;
}

function cleanReference(ref) {
  if (!ref) return ref;
  // Remove markdown escaping: "1\." -> "1." 
  return ref.replace(/\\+\./g, '.').replace(/\\+/g, '');
}

function parseSingleReading(lines) {
  if (lines.length === 0) return null;

  const reading = {
    reference: null,
    bookIntro: null,
    text: null,
  };

  let phase = 'reference'; // reference -> bookIntro -> text
  let textLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (phase === 'text' && textLines.length > 0) {
        textLines.push(''); // Preserve paragraph breaks
      }
      continue;
    }

    // Stop at next section markers
    if (line.match(/^#{5}\s|^Vaihtoehtoinen|^Lisäksi soveltuu/)) break;

    // Skip footnote lines (from Evankeliumi* references)
    // Footnotes start with \* or * and can span multiple lines
    if (line.startsWith('\\*') || (line.startsWith('*') && !line.startsWith('**'))) {
      // Skip this and subsequent continuation lines until an empty line
      while (i + 1 < lines.length && lines[i + 1].trim() !== '') {
        const nextLine = lines[i + 1].trim();
        // If next line looks like a Bible reference, stop skipping
        if (SHORT_REF_REGEX.test(nextLine)) break;
        i++;
      }
      continue;
    }

    if (phase === 'reference') {
      // First non-empty line is the reference (e.g., "Jes. 62:10--12")
      reading.reference = cleanReference(line);
      phase = 'bookIntro';
      continue;
    }

    if (phase === 'bookIntro') {
      // Book intro like "Jesajan kirjasta, luvusta 62"
      if (BOOK_INTRO_REGEX.test(line) || line.match(/^Kristus sanoo|^Profeetta sanoi|^Herra sanoo/)) {
        reading.bookIntro = line;
        phase = 'text';
        continue;
      }
      // Sometimes there's no book intro, the text starts directly
      phase = 'text';
      textLines.push(line);
      continue;
    }

    if (phase === 'text') {
      textLines.push(line);
    }
  }

  // Clean up trailing empty lines from text
  while (textLines.length > 0 && textLines[textLines.length - 1] === '') {
    textLines.pop();
  }

  if (textLines.length > 0) {
    reading.text = cleanText(textLines.join('\n'));
  }

  return reading.reference ? reading : null;
}

function parseWeekdayTexts(lines) {
  const result = {
    otReadings: [],
    ntReadings: [],
    gospel: null,
  };

  // Find OT, NT, and Gospel sections
  const otStart = lines.findIndex(l => l.trim().match(/^Vanhan testamentin lukukappaleet$/));
  const ntStart = lines.findIndex(l => l.trim().match(/^Uuden testamentin lukukappaleet$/));
  const gospelStart = lines.findIndex(l => isEvankeliumiLine(l.trim()));
  if (otStart !== -1) {
    const end = ntStart !== -1 ? ntStart : (gospelStart !== -1 ? gospelStart : lines.length);
    result.otReadings = parseMultipleReadings(lines.slice(otStart + 1, end));
  }

  // Parse NT readings (multiple)
  if (ntStart !== -1) {
    const end = gospelStart !== -1 ? gospelStart : lines.length;
    result.ntReadings = parseMultipleReadings(lines.slice(ntStart + 1, end));
  }

  // Parse Gospel
  if (gospelStart !== -1) {
    const gospelLines = lines.slice(gospelStart + 1);
    result.gospel = parseSingleReading(gospelLines);
  }

  return result;
}

function parseMultipleReadings(lines) {
  const readings = [];
  let currentReading = [];
  let readingStarted = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // A new reference line starts a new reading
    if (trimmed && SHORT_REF_REGEX.test(trimmed) && !BOOK_INTRO_REGEX.test(trimmed)) {
      if (currentReading.length > 0) {
        const reading = parseSingleReading(currentReading);
        if (reading) readings.push(reading);
      }
      currentReading = [line];
      readingStarted = true;
      continue;
    }

    if (readingStarted) {
      currentReading.push(line);
    }
  }

  if (currentReading.length > 0) {
    const reading = parseSingleReading(currentReading);
    if (reading) readings.push(reading);
  }

  return readings;
}

function parseSimpleReadings(lines) {
  // For entries that don't have explicit year cycles or OT/NT divisions
  // Just try to find Lukukappale and Evankeliumi
  const result = {
    readings: [],
    gospel: null,
  };

  const gospelStart = lines.findIndex(l => isEvankeliumiLine(l.trim()));
  const readingStart = lines.findIndex(l => l.trim() === 'Lukukappale');

  if (readingStart !== -1) {
    const end = gospelStart !== -1 ? gospelStart : lines.length;
    const reading = parseSingleReading(lines.slice(readingStart + 1, end));
    if (reading) result.readings.push(reading);
  }

  if (gospelStart !== -1) {
    result.gospel = parseSingleReading(lines.slice(gospelStart + 1));
  }

  return (result.readings.length > 0 || result.gospel) ? result : null;
}

// ─── Prayers Parsing ────────────────────────────────────────────────────────

function parsePrayers(lines) {
  const prayers = [];
  let currentPrayer = [];
  let currentNumber = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Stop at next entry
    if (trimmed.startsWith('#### ')) break;

    // New numbered prayer: "1\." or "2\." etc.
    const numberMatch = trimmed.match(/^(\d+)\\?\.\s*$/);
    if (numberMatch) {
      if (currentPrayer.length > 0 && currentNumber !== null) {
        prayers.push({
          number: currentNumber,
          text: cleanText(currentPrayer.join('\n')),
        });
      }
      currentNumber = parseInt(numberMatch[1]);
      currentPrayer = [];
      continue;
    }

    if (currentNumber !== null) {
      currentPrayer.push(trimmed);
    }
  }

  // Don't forget the last prayer
  if (currentPrayer.length > 0 && currentNumber !== null) {
    prayers.push({
      number: currentNumber,
      text: cleanText(currentPrayer.join('\n')),
    });
  }

  return prayers.length > 0 ? prayers : null;
}

// ─── Utility Functions ──────────────────────────────────────────────────────

function findLine(lines, regex) {
  return lines.findIndex(l => regex.test(l.trim()));
}

function findSection(lines, headingRegex) {
  const start = lines.findIndex(l => headingRegex.test(l.trim()));
  if (start === -1) return null;

  const sectionLines = [];
  for (let i = start + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Stop at the next heading-like boundary of same level or higher
    if (trimmed.match(/^#{4,5}\s/) && !headingRegex.test(trimmed)) break;
    // Stop at next major section within ##### Raamatuntekstit
    if (i > start + 1 && (trimmed.match(/^(?:Päivän psalmi|Hallelujasäe|Psalmilause|\d+\\\.\s+vuosikerta|Vanhan testamentin|Uuden testamentin|Lukukappale)$/) || isEvankeliumiLine(trimmed)) && !headingRegex.test(trimmed)) {
      break;
    }
    sectionLines.push(lines[i]);
  }

  return { startIndex: start, lines: sectionLines };
}

function extractTextAndReference(lines) {
  if (lines.length === 0) return { text: null, reference: null };

  // The last non-empty line is often the reference
  let reference = null;
  let textLines = [...lines];

  // Remove trailing empty lines
  while (textLines.length > 0 && textLines[textLines.length - 1].trim() === '') {
    textLines.pop();
  }

  // Check if last line looks like a Bible reference
  if (textLines.length > 0) {
    const lastLine = textLines[textLines.length - 1].trim();
    if (SHORT_REF_REGEX.test(lastLine) && lastLine.length < 40) {
      reference = lastLine;
      textLines.pop();
    }
  }

  // Remove trailing empty lines again
  while (textLines.length > 0 && textLines[textLines.length - 1].trim() === '') {
    textLines.pop();
  }

  const text = cleanText(textLines.join('\n')) || null;
  return { text, reference };
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node parse-evankeliumikirja.js <input.md> [output-dir]');
    process.exit(1);
  }

  const inputFile = resolve(args[0]);
  const outputDir = resolve(args[1] || './data');

  console.log(`Reading: ${inputFile}`);
  const content = readFileSync(inputFile, 'utf-8');
  const lines = content.split('\n');

  console.log(`Total lines: ${lines.length}`);

  // Split into entries
  const entries = splitIntoEntries(lines);
  console.log(`Found ${entries.length} holy day entries`);

  // Parse each entry
  const holyDays = entries.map((entry, idx) => {
    try {
      const parsed = parseEntry(entry);
      return parsed;
    } catch (err) {
      console.error(`Error parsing entry ${idx} "${entry.heading}":`, err.message);
      return { name: entry.heading, error: err.message };
    }
  });

  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Write individual files
  const textsDir = join(outputDir, 'days');
  if (!existsSync(textsDir)) {
    mkdirSync(textsDir, { recursive: true });
  }

  for (const day of holyDays) {
    const filename = `${day.slug || 'unknown'}.json`;
    writeFileSync(
      join(textsDir, filename),
      JSON.stringify(day, null, 2),
      'utf-8'
    );
  }

  // Write index file with metadata only (no full texts)
  const index = holyDays.map(d => ({
    name: d.name,
    slug: d.slug,
    season: d.season,
    period: d.period,
    latinName: d.latinName,
    liturgicalColor: d.liturgicalColor,
    hasYearCycles: !!d.yearCycles,
    hasWeekdayTexts: !!d.weekdayTexts,
    prayerCount: d.prayers ? d.prayers.length : 0,
    hymnCount: d.hymns
      ? (d.hymns.opening?.length || 0) + (d.hymns.dayHymns?.length || 0) + (d.hymns.additional?.length || 0) + (d.hymns.other?.length || 0)
      : 0,
  }));

  writeFileSync(
    join(outputDir, 'index.json'),
    JSON.stringify(index, null, 2),
    'utf-8'
  );

  // Write combined file
  writeFileSync(
    join(outputDir, 'all-days.json'),
    JSON.stringify(holyDays, null, 2),
    'utf-8'
  );

  // Print summary
  console.log('\n=== PARSE SUMMARY ===');
  console.log(`Total entries: ${holyDays.length}`);
  console.log(`With year cycles: ${holyDays.filter(d => d.yearCycles).length}`);
  console.log(`With weekday texts: ${holyDays.filter(d => d.weekdayTexts).length}`);
  console.log(`With prayers: ${holyDays.filter(d => d.prayers).length}`);
  console.log(`With psalms: ${holyDays.filter(d => d.psalm).length}`);
  console.log(`With hallelujah: ${holyDays.filter(d => d.hallelujah).length}`);
  console.log(`With psalm verses: ${holyDays.filter(d => d.psalmVerse).length}`);
  console.log(`With hymns: ${holyDays.filter(d => d.hymns).length}`);
  console.log(`With errors: ${holyDays.filter(d => d.error).length}`);

  // Print season distribution
  const seasons = {};
  for (const d of holyDays) {
    const key = d.season || 'unknown';
    seasons[key] = (seasons[key] || 0) + 1;
  }
  console.log('\nBy season:');
  for (const [season, count] of Object.entries(seasons)) {
    console.log(`  ${season}: ${count}`);
  }

  // List entries with issues
  const noTexts = holyDays.filter(d => !d.yearCycles && !d.weekdayTexts);
  if (noTexts.length > 0) {
    console.log(`\nEntries without parsed texts (${noTexts.length}):`);
    for (const d of noTexts.slice(0, 10)) {
      console.log(`  - ${d.name}`);
    }
    if (noTexts.length > 10) console.log(`  ... and ${noTexts.length - 10} more`);
  }

  console.log(`\nOutput written to: ${outputDir}`);
}

main();
