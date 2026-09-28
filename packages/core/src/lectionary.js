/**
 * Lectionary Index Service
 *
 * Provides lookup into the Bible text index from:
 * "Kirkkovuoden pyhäpäivien ja arkipäivien raamatuntekstit
 *  Evankeliumikirjassa ja viikkolektionaarissa"
 *
 * Source: viikkolektionaarin_raamatunkohdat.pdf
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

let indexData = null;

function load() {
  if (indexData) return indexData;
  const raw = readFileSync(join(DATA_DIR, 'lectionary-index.json'), 'utf-8');
  indexData = JSON.parse(raw);
  return indexData;
}

/**
 * Get all entries from the lectionary index.
 */
export function getAllEntries() {
  return load().entries;
}

/**
 * Get the index metadata (title, description, counts).
 */
export function getIndexMeta() {
  const data = load();
  return {
    title: data.title,
    description: data.description,
    note: data.note,
    entryCount: data.entryCount,
    holyDayCount: Object.keys(data.byHolyDay).length,
  };
}

/**
 * Get all lectionary readings for a given holy day name.
 * Matches are case-insensitive and support partial substring matching.
 *
 * @param {string} holyDayName - e.g. "pääsiäisyö", "1. adventtisunnuntai"
 * @returns {Array}
 */
export function getByHolyDay(holyDayName) {
  const data = load();
  const q = holyDayName.toLowerCase().trim();

  const results = {};
  for (const [key, readings] of Object.entries(data.byHolyDay)) {
    if (key.toLowerCase().includes(q)) {
      results[key] = readings;
    }
  }
  return results;
}

/**
 * Search lectionary entries by Bible reference (book abbreviation + chapter/verse).
 * E.g. "Matt. 5", "Ps. 22", "Room. 8"
 *
 * @param {string} query
 * @returns {Array}
 */
export function searchByReference(query) {
  const data = load();
  const q = query.toLowerCase().trim();

  return data.entries.filter(entry => {
    const abbr = entry.abbreviation?.toLowerCase() || '';
    const ref = entry.reference?.toLowerCase() || '';
    const book = entry.book?.toLowerCase() || '';
    return abbr.includes(q) || ref.includes(q) || book.includes(q) ||
      `${abbr} ${ref}`.includes(q);
  });
}

/**
 * Get all holy day names used in the lectionary index.
 */
export function getHolyDayNames() {
  return Object.keys(load().byHolyDay).sort();
}
