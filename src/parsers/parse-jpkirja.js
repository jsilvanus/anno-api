/**
 * Parser for Jumalanpalvelusten kirja (Kirkkokäsikirja I)
 *
 * Extracts church-year-specific liturgical propers:
 * - Prefaation päätökset (preface endings by season)
 * - Kyrie-litaniat (Kyrie litanies by season)
 * - Moitteet / Improperia (Good Friday)
 * - Pääsiäisylistys / Exsultet (Easter)
 * - Kertosäkeet (psalm refrains by season)
 * - Synninpäästöt (absolutions)
 * - Kiitosrukoukset (general thanksgiving prayers, numbered 1–4)
 * - Kiitosrukoukset ehtoollisen jälkeen (church-year post-communion thanksgiving prayers)
 * - Sakaristorukouksia (sacristy prayers)
 * - Päivän rukouksia (collects for daily offices)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// ─── Helpers ────────────────────────────────────────────────────────────────

function cleanText(text) {
  return text
    .replace(/!\[.*?\]\(.*?\)(\{.*?\})?/g, '')                     // Remove image refs
    .replace(/\[.*?\]\{[^}]*\.anchor\}/g, '')                       // Remove anchor refs
    .replace(/\[?\]\{[^}]*\}/g, '')                                 // Remove empty anchors
    .replace(/^\s*>\s?/gm, '')                                      // Remove blockquote markers
    .replace(/\*\*([ES])\*\*/g, '$1')                               // **E** → E, **S** → S
    .replace(/\\\[/g, '[')                                           // Unescape brackets
    .replace(/\\\]/g, ']')
    .replace(/\\$/gm, '')                                            // Remove line-ending backslashes
    .replace(/\{width="[^"]*"\s*\n?height="[^"]*"\}/g, '')          // Remove {width=... height=...}
    .replace(/\{width="[^"]*"\s+height="[^"]*"\}/g, '')             // Same, single-line variant
    .replace(/\d+\\\./g, m => m.replace('\\', ''))                   // 5\. → 5.
    .replace(/\n{3,}/g, '\n\n')                                      // Collapse multiple blank lines
    .trim();
}

function stripImages(text) {
  return text
    .replace(/>\s*!\[.*?\]\(.*?\)(\{.*?\})?\s*\n?/g, '')
    .replace(/!\[.*?\]\(.*?\)(\{.*?\})?/g, '')
    .trim();
}

// ─── Section Extraction ─────────────────────────────────────────────────────

function extractBetween(lines, startRegex, endRegex, inclusive = false) {
  let collecting = false;
  let startLine = -1;
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    if (!collecting && startRegex.test(lines[i])) {
      collecting = true;
      startLine = i;
      if (inclusive) result.push(lines[i]);
      continue;
    }
    if (collecting && endRegex.test(lines[i])) {
      break;
    }
    if (collecting) {
      result.push(lines[i]);
    }
  }

  return result;
}

function findLine(lines, regex) {
  return lines.findIndex(l => regex.test(l));
}

// ─── Prefaatio Parser ───────────────────────────────────────────────────────

function parsePrefaatiot(lines) {
  const prefaatiot = [];

  // Find the MAIN prefaatio section (chapter 2 area, around line 14000+)
  // Look for the specific anchor pattern
  const anchorIdx = findLine(lines, /Prefaatio\[.*Prefaation_sävelmä/);

  // Find all "Prefaation päätös" headings AFTER the anchor
  const searchStart = anchorIdx !== -1 ? anchorIdx : 10000;
  const headings = [];
  for (let i = searchStart; i < lines.length; i++) {
    const match = lines[i].match(/^Prefaation päätös (.+)/);
    if (match) {
      const title = match[1].replace(/\[.*?\]\{[^}]*\}/g, '').replace(/\\/g, '').trim();
      headings.push({ title, lineIndex: i });
    }
    // Stop when we hit the next major section (Pyhä)
    if (i > searchStart + 10 && /^\[?\]\{.*__RefHeading___Toc297807937/.test(lines[i])) break;
    if (i > searchStart + 10 && /^.*Pyhä\[.*Vaihtoehtoisia_Pyhä/.test(lines[i])) break;
  }

  // Deduplicate by title (some appear in multiple document locations)
  const seen = new Set();
  const uniqueHeadings = headings.filter(h => {
    if (seen.has(h.title)) return false;
    seen.add(h.title);
    return true;
  });

  for (let h = 0; h < uniqueHeadings.length; h++) {
    const start = uniqueHeadings[h].lineIndex + 1;
    const end = h + 1 < uniqueHeadings.length
      ? uniqueHeadings[h + 1].lineIndex
      : start + 50;

    const raw = lines.slice(start, end).join('\n');
    const text = cleanText(stripImages(raw));

    // Only keep entries with actual prayer text (not just image/meta references)
    if (text.length > 30 && !text.startsWith('Kirkkovuoden')) {
      const title = uniqueHeadings[h].title;
      const mapping = mapPrefaatioToSeasons(title);

      prefaatiot.push({
        title: `Prefaation päätös ${title}`,
        period: title,
        appliesTo: mapping,
        text,
      });
    }
  }

  return prefaatiot;
}

function mapPrefaatioToSeasons(title) {
  const lower = title.toLowerCase();

  if (lower.includes('(yleinen)') || lower === 'yleinen') return ['yleinen'];
  if (lower.includes('adventtiaikana')) return ['adventtiaika'];
  if (lower === 'jouluna') return ['jouluaatto', 'jouluyo', 'joulupaiva'];
  if (lower.includes('jouluaikana')) return ['jouluaika', 'kynttilanpaiva', 'marian-ilmestyspaiva'];
  if (lower === 'loppiaisena') return ['loppiainen'];
  if (lower.includes('loppiaisaikana')) return ['loppiaisaika', 'paastonaikaa-edeltavat'];
  if (lower === 'paastonaikana') return ['paastonaika'];
  if (lower.includes('kärsimysaikana')) return ['karsimysaika'];
  if (lower.includes('pääsiäisyönä') || lower.includes('pääsiäispäivänä')) return ['paasiaisyo', 'paasiaispaiva'];
  if (lower.includes('pääsiäisaikana')) return ['paasiaisaika'];
  if (lower.includes('helatorstaista')) return ['helatorstai-helluntaiaatto'];
  if (lower.includes('helluntaina')) return ['helluntai'];
  if (lower.includes('apostolien')) return ['apostolien-paiva', 'pyhan-henrikin-muistopaiva'];
  if (lower.includes('mikkelinpäivänä')) return ['mikkelinpaiva'];
  if (lower.includes('valvomisen') || lower.includes('tuomiosunnuntaina')) return ['valvomisen-sunnuntai', 'tuomiosunnuntai'];

  return [lower];
}

// ─── Kyrie-litania Parser ───────────────────────────────────────────────────

function parseKyrieLitaniat(lines) {
  const litaniat = [];

  // Find the church year Kyrie section
  const sectionStart = findLine(lines, /adventtisunnuntai.*Kirkkovuoden_Kyrie_litaniat/);
  if (sectionStart === -1) return litaniat;

  // Find the end (Vaihtoehto B section)
  const sectionEnd = findLine(lines.slice(sectionStart), /^Vaihtoehto B$/);
  const endIdx = sectionEnd !== -1 ? sectionStart + sectionEnd : sectionStart + 500;

  const sectionLines = lines.slice(sectionStart, endIdx);

  // Split by season headings
  const seasonHeadings = [
    { regex: /^1\.\s*adventtisunnuntai/, name: '1. adventtisunnuntai', slug: '1-adventtisunnuntai' },
    { regex: /^Adventtiaika$/, name: 'Adventtiaika', slug: 'adventtiaika' },
    { regex: /^Joulu ja jouluaika$/, name: 'Joulu ja jouluaika', slug: 'joulu-jouluaika' },
    { regex: /^Paastonaika$/, name: 'Paastonaika', slug: 'paastonaika' },
    { regex: /^Kärsimysaika/, name: 'Kärsimysaika', slug: 'karsimysaika' },
    { regex: /^Pitkäperjantai ja hiljainen lauantai$/, name: 'Pitkäperjantai ja hiljainen lauantai', slug: 'pitkaperjantai-hiljainen-lauantai' },
    { regex: /^Pääsiäinen ja pääsiäisaika$/, name: 'Pääsiäinen ja pääsiäisaika', slug: 'paasiainen-paasiaisaika' },
    { regex: /^Helatorstaista helluntaiaattoon$/, name: 'Helatorstaista helluntaiaattoon', slug: 'helatorstai-helluntaiaatto' },
    { regex: /^Helluntai$/, name: 'Helluntai', slug: 'helluntai' },
  ];

  // Also look for the line with the Kirkkovuoden_Kyrie_litaniat anchor
  const anchorLine = sectionLines.findIndex(l => /Kirkkovuoden_Kyrie_litaniat/.test(l));
  if (anchorLine !== -1) {
    // The 1. adventtisunnuntai heading is on the same line as the anchor
    const heading0Idx = sectionLines.findIndex(l => /1\.\s*adventtisunnuntai/.test(l));
    if (heading0Idx !== -1) {
      // Already in seasonHeadings, but ensure it's found
    }
  }

  for (let h = 0; h < seasonHeadings.length; h++) {
    const idx = sectionLines.findIndex(l => seasonHeadings[h].regex.test(l.trim()));
    if (idx === -1) continue;

    // Find end of this section
    let endOfSection = sectionLines.length;
    for (let next = h + 1; next < seasonHeadings.length; next++) {
      const nextIdx = sectionLines.findIndex((l, i) => i > idx && seasonHeadings[next].regex.test(l.trim()));
      if (nextIdx !== -1) {
        endOfSection = nextIdx;
        break;
      }
    }

    const raw = sectionLines.slice(idx + 1, endOfSection).join('\n');

    // Split on "tai" for alternatives
    const alternatives = raw.split(/\n\s*tai\s*\n/).map(alt => cleanText(stripImages(alt)));

    litaniat.push({
      season: seasonHeadings[h].name,
      slug: seasonHeadings[h].slug,
      texts: alternatives.filter(t => t.length > 10),
    });
  }

  return litaniat;
}

// ─── Improperia (Moitteet) Parser ───────────────────────────────────────────

function parseImproperia(lines) {
  // Find the line with "Kansani, minun kansani" which is the actual Improperia text
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Kansani, minun kansani')) {
      // Go back to find the section heading
      for (let j = i - 1; j >= Math.max(i - 20, 0); j--) {
        if (lines[j].includes('Moitteet') && lines[j].includes('Improperia')) {
          start = j;
          break;
        }
      }
      if (start === -1) start = i - 2;
      break;
    }
  }
  if (start === -1) return null;

  // Find end — next section heading
  let end = start + 100;
  for (let i = start + 5; i < start + 200 && i < lines.length; i++) {
    if (/^\[?\]\{.*__RefHeading/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const raw = lines.slice(start, end).join('\n');
  const text = cleanText(stripImages(raw));
  return text.length > 100 ? text : null;
}

// ─── Exsultet (Pääsiäisylistys) Parser ──────────────────────────────────────

function parseExsultet(lines) {
  const results = [];

  // Find both versions (A and B)
  for (const pattern of [/Pääsiäisylistys.*voidaan laulaa/]) {
    const indices = [];
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) indices.push(i);
    }

    for (const start of indices) {
      // Find end - next major section heading
      let end = start + 1;
      for (let i = start + 1; i < lines.length && i < start + 300; i++) {
        if (/^#{2,3}\s|^\[?\]\{.*__RefHeading/.test(lines[i]) && i > start + 5) {
          end = i;
          break;
        }
      }

      const raw = lines.slice(start, end).join('\n');
      const text = cleanText(stripImages(raw));
      if (text.length > 50) {
        results.push(text);
      }
    }
  }

  return results.length > 0 ? results : null;
}

// ─── Synninpäästöt Parser ───────────────────────────────────────────────────

function parseSynninpaastot(lines) {
  const start = findLine(lines, /^.*Synninpäästö\[.*Synninpäästöt/);
  if (start === -1) return [];

  const end = findLine(lines.slice(start + 1), /^.*Kiitosrukous\[.*Kiitosrukoukset/);
  const endIdx = end !== -1 ? start + 1 + end : start + 200;

  const sectionLines = lines.slice(start + 1, endIdx);
  return parseNumberedTexts(sectionLines);
}

// ─── Kiitosrukoukset Parser ─────────────────────────────────────────────────

function parseKiitosrukoukset(lines) {
  const start = findLine(lines, /^.*Kiitosrukous\[.*Kiitosrukoukset/);
  if (start === -1) return [];

  const end = findLine(lines.slice(start + 1), /^\[?\]\{.*__RefHeading___Toc/);
  const endIdx = end !== -1 ? start + 1 + end : start + 100;

  const sectionLines = lines.slice(start + 1, endIdx);
  return parseNumberedTexts(sectionLines);
}

// ─── Kiitosrukouksia ehtoollisen jälkeen (Post-Communion Thanksgiving) Parser ─

/**
 * Parses church-year-specific post-communion thanksgiving prayers.
 *
 * In the jpkirja the "Kiitosrukous" section starts with general numbered prayers
 * (1–4) and then continues with season-specific variants:
 *   Adventtiaika, Jouluaika, Paastonaika (from Ash Wednesday),
 *   Kärsimysaika (from 5th Sunday of Lent), Pääsiäinen, Pääsiäisaika, Helluntai.
 *
 * These follow directly after the numbered prayers in the same Kiitosrukoukset
 * section, before the next major heading (Perhejumalanpalvelukset).
 */
function parseKiitosrukouksetEhtoollinen(lines) {
  // Find the Kiitosrukoukset section anchor
  const sectionStart = findLine(lines, /^.*Kiitosrukous\[.*Kiitosrukoukset/);
  if (sectionStart === -1) return [];

  // Find the end of the whole kiitosrukous block (next major heading after numbered texts)
  const nextMajor = findLine(lines.slice(sectionStart + 1), /Perhejumalanpalvelukset/);
  const sectionEnd = nextMajor !== -1 ? sectionStart + 1 + nextMajor : sectionStart + 400;

  const sectionLines = lines.slice(sectionStart + 1, sectionEnd);

  // Season definitions — title, slug, optional note about when it applies
  const seasons = [
    { regex: /^Adventtiaika$/,       name: 'Adventtiaika',  slug: 'adventtiaika',  note: null },
    { regex: /^Joulu(aika)?$/,        name: 'Jouluaika',     slug: 'jouluaika',     note: null },
    { regex: /^Paastonaika$/,         name: 'Paastonaika',   slug: 'paastonaika',   note: 'Tuhkakeskiviikosta lähtien' },
    { regex: /^K[äa]rsimysaika$/,     name: 'Kärsimysaika',  slug: 'karsimysaika',  note: '5. paastonajan sunnuntaista lähtien' },
    { regex: /^P[äa][äa]si[äa]inen$/, name: 'Pääsiäinen',   slug: 'paasiaisyo-paasiaispaiva', note: null },
    { regex: /^P[äa][äa]si[äa]isaika$/, name: 'Pääsiäisaika', slug: 'paasiaisaika', note: null },
    { regex: /^Helluntai$/,           name: 'Helluntai',     slug: 'helluntai',     note: null },
  ];

  const results = [];

  for (let s = 0; s < seasons.length; s++) {
    const idx = sectionLines.findIndex(l => seasons[s].regex.test(l.trim()));
    if (idx === -1) continue;

    // Find end of this season's block
    let endIdx = sectionLines.length;
    for (let next = s + 1; next < seasons.length; next++) {
      const nextIdx = sectionLines.findIndex((l, i) => i > idx && seasons[next].regex.test(l.trim()));
      if (nextIdx !== -1) {
        endIdx = nextIdx;
        break;
      }
    }

    // Collect prayer text(s) — split on blank lines or "tai" separators
    const raw = sectionLines.slice(idx + 1, endIdx).join('\n');
    const texts = raw
      .split(/\n\s*tai\s*\n|\n{3,}/)
      .map(t => cleanText(stripImages(t)))
      .filter(t => t.length > 20);

    // Extract note (usually a line like "Tuhkakeskiviikosta lähtien" right after heading)
    let note = seasons[s].note;
    if (!note) {
      const firstLine = sectionLines[idx + 1]?.trim();
      if (firstLine && /lähtien|alkaen|sunnuntai/.test(firstLine)) {
        note = cleanText(firstLine);
      }
    }

    results.push({
      season: seasons[s].name,
      slug: seasons[s].slug,
      ...(note ? { note } : {}),
      texts,
    });
  }

  return results;
}

// ─── Kertosäkeet (Psalm Refrains) Parser ────────────────────────────────────

function parseKertosaakeet(lines) {
  const start = findLine(lines, /^Kirkkovuoden juhla-ajat$/);
  if (start === -1) return [];

  const refrains = [];

  // First pass: find all entry start lines (e.g. "5\. Iloitse, tytär Siion")
  // These are lines matching NUMBER\. TITLE where title is a text (not "adventti" etc)
  const entries = [];
  for (let i = start + 1; i < lines.length && i < start + 1000; i++) {
    const trimmed = lines[i].trim();

    // Match: "5\. Iloitse, tytär Siion[]{#anchor}"
    // But NOT: "1\. adventtisunnuntaina; Sak. 9: 9."  (that's a sub-description)
    // The real entries have a title that starts with uppercase and is a phrase, not a date/occasion
    const entryMatch = trimmed.match(/^(\d+)\\\.\s+([A-ZÄÖÅ].+)/);
    if (entryMatch) {
      const title = entryMatch[2].replace(/\[.*?\]\{[^}]*\}/g, '').replace(/\\$/, '').trim();
      // Skip if it looks like a description (contains semicolon = Bible ref, or lowercase start after number)
      if (title.match(/^(adventti|Adventti|loppiai|Loppiai|paasto|jouluai|Virsikirjan|Sävelmä)/i)) continue;
      // Skip if it's a standalone occasion description
      if (title.match(/sunnuntain|päivän[aä]|aikana/i) && !title.match(/^[A-ZÄÖÅ][a-zäöå]/)) continue;

      entries.push({ number: parseInt(entryMatch[1]), title, lineIndex: i });
    }

    // Stop at Psalmeja section or next heading
    if (/^Psalmeja$/.test(trimmed) || /^#{2,3}\s/.test(trimmed)) break;
  }

  // Second pass: extract content for each entry
  for (let e = 0; e < entries.length; e++) {
    const entryStart = entries[e].lineIndex;
    const entryEnd = e + 1 < entries.length ? entries[e + 1].lineIndex : entryStart + 50;

    // Find occasion line (next non-empty line that looks like an occasion)
    let occasion = '';
    for (let j = entryStart + 1; j < entryEnd && j < entryStart + 5; j++) {
      const line = lines[j].trim();
      if (line && !line.startsWith('>') && !line.startsWith('!') && !line.startsWith('[') && !line.startsWith('Virsikirjan')) {
        // Check if it's an occasion (contains semicolon or matches time patterns)
        if (line.match(/;|aikana|päivänä|yönä|aamuna|sunnuntai/i)) {
          occasion = cleanText(line);
          break;
        }
      }
    }

    // Find all alternatives: look for (Virsi X: Y) lines and collect text above them
    const alternatives = [];
    for (let j = entryStart; j < entryEnd; j++) {
      const line = lines[j].trim();
      if (line.startsWith('(Virsi') || line.startsWith('(virsi')) {
        // Collect text lines going backwards from here until we hit tai/empty/image/blockquote
        const altLines = [];
        for (let k = j - 1; k >= entryStart; k--) {
          const prev = lines[k].trim();
          if (prev === '' || prev === 'tai' || prev === 'tait' || prev.startsWith('>') || prev.startsWith('!') || prev.startsWith('Virsikirjan')) break;
          altLines.unshift(prev);
        }
        const altText = altLines.join('\n').trim();
        if (altText) {
          alternatives.push({
            text: altText,
            source: line.replace(/[()]/g, '').trim(),
          });
        }
      }
    }

    refrains.push({
      number: entries[e].number,
      title: entries[e].title,
      occasion,
      alternatives,
    });
  }

  return refrains;
}

// ─── Generic Numbered Text Parser ───────────────────────────────────────────

function parseNumberedTexts(lines) {
  const texts = [];
  let current = null;
  let currentLines = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // New numbered entry
    const numMatch = trimmed.match(/^(\d+)\\?\.\s*$/);
    if (numMatch) {
      if (current !== null && currentLines.length > 0) {
        texts.push({ number: current, text: cleanText(currentLines.join('\n')) });
      }
      current = parseInt(numMatch[1]);
      currentLines = [];
      continue;
    }

    if (current !== null) {
      currentLines.push(line);
    }
  }

  if (current !== null && currentLines.length > 0) {
    texts.push({ number: current, text: cleanText(currentLines.join('\n')) });
  }

  return texts;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node parse-jpkirja.js <input.md> [output-dir]');
    process.exit(1);
  }

  const inputFile = resolve(args[0]);
  const outputDir = resolve(args[1] || './data-jpkirja');

  console.log(`Reading: ${inputFile}`);
  const content = readFileSync(inputFile, 'utf-8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);

  // Parse all sections
  console.log('\nParsing prefaatiot...');
  const prefaatiot = parsePrefaatiot(lines);
  console.log(`  Found ${prefaatiot.length} preface endings`);

  console.log('Parsing Kyrie-litaniat...');
  const kyrieLitaniat = parseKyrieLitaniat(lines);
  console.log(`  Found ${kyrieLitaniat.length} seasonal Kyrie litanies`);

  console.log('Parsing Improperia...');
  const improperia = parseImproperia(lines);
  console.log(`  Improperia: ${improperia ? 'found' : 'not found'}`);

  console.log('Parsing synninpäästöt...');
  const synninpaastot = parseSynninpaastot(lines);
  console.log(`  Found ${synninpaastot.length} absolutions`);

  console.log('Parsing kiitosrukoukset...');
  const kiitosrukoukset = parseKiitosrukoukset(lines);
  console.log(`  Found ${kiitosrukoukset.length} thanksgiving prayers`);

  console.log('Parsing kiitosrukouksia ehtoollisen jälkeen...');
  const kiitosrukouksetEhtoollinen = parseKiitosrukouksetEhtoollinen(lines);
  console.log(`  Found ${kiitosrukouksetEhtoollinen.length} seasonal post-communion thanksgiving prayers`);

  console.log('Parsing kertosäkeet...');
  const kertosaakeet = parseKertosaakeet(lines);
  console.log(`  Found ${kertosaakeet.length} psalm refrains`);

  // Assemble output
  const propers = {
    source: 'Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000)',
    prefaatiot,
    kyrieLitaniat,
    improperia,
    synninpaastot,
    kiitosrukoukset,
    kiitosrukouksetEhtoollinen,
    kertosaakeet,
  };

  // Write output
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(join(outputDir, 'propers.json'), JSON.stringify(propers, null, 2), 'utf-8');
  console.log(`\nWritten to: ${join(outputDir, 'propers.json')}`);

  // Print summary
  console.log('\n=== PREFAATIOT ===');
  for (const p of prefaatiot) {
    console.log(`  ${p.period}: ${p.text.substring(0, 60)}...`);
  }
  console.log('\n=== KYRIE-LITANIAT ===');
  for (const k of kyrieLitaniat) {
    console.log(`  ${k.season}: ${k.texts.length} variant(s)`);
  }
}

main();
