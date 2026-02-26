/**
 * Tests for Kirkkovuosi API
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  easterSunday,
  formatDate,
  makeDate,
  generateChurchYear,
  getYearCycle,
  getChurchYearStart,
} from '../services/computus.js';
import { resolveDate, getDayData } from '../services/resolver.js';

// ─── Easter Calculation ─────────────────────────────────────────────────────

describe('Computus — Easter calculation', () => {
  const knownEasters = [
    [2020, '2020-04-12'],
    [2021, '2021-04-04'],
    [2022, '2022-04-17'],
    [2023, '2023-04-09'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2029, '2029-04-01'],
    [2030, '2030-04-21'],
  ];

  for (const [year, expected] of knownEasters) {
    it(`Easter ${year} = ${expected}`, () => {
      assert.equal(formatDate(easterSunday(year)), expected);
    });
  }
});

// ─── Church Year Generation ─────────────────────────────────────────────────

describe('Church year generation', () => {
  it('generates entries for church year 2025–2026', () => {
    const calendar = generateChurchYear(2025);
    assert.ok(calendar.length > 80, `Expected 80+ entries, got ${calendar.length}`);

    // First entry should be 1st Advent 2025
    const first = calendar.find(e => e.slug === '1-adventtisunnuntai');
    assert.ok(first, '1st Advent Sunday should exist');
    assert.equal(first.dateStr, '2025-11-30');
  });

  it('places Christmas on Dec 25', () => {
    const calendar = generateChurchYear(2025);
    const christmas = calendar.find(e => e.slug === 'joulupaiva');
    assert.ok(christmas);
    assert.equal(christmas.dateStr, '2025-12-25');
  });

  it('places Easter correctly for 2025–2026', () => {
    const calendar = generateChurchYear(2025);
    const easter = calendar.find(e => e.slug === 'paasiaispaiva');
    assert.ok(easter);
    assert.equal(easter.dateStr, '2026-04-05'); // Easter 2026
  });

  it('places Ascension 39 days after Easter', () => {
    const calendar = generateChurchYear(2025);
    const ascension = calendar.find(e => e.slug === 'helatorstai');
    assert.ok(ascension);
    assert.equal(ascension.dateStr, '2026-05-14');
  });

  it('places Pentecost 49 days after Easter', () => {
    const calendar = generateChurchYear(2025);
    const pentecost = calendar.find(e => e.slug === 'helluntaipaiva');
    assert.ok(pentecost);
    assert.equal(pentecost.dateStr, '2026-05-24');
  });

  it('places Tuomiosunnuntai as last Sunday before next Advent', () => {
    const calendar = generateChurchYear(2025);
    const tuo = calendar.find(e => e.slug === 'tuomiosunnuntai');
    assert.ok(tuo);
    assert.equal(tuo.dateStr, '2026-11-22');
  });

  it('generates correct number of Epiphany Sundays', () => {
    const calendar = generateChurchYear(2025);
    const epiphSundays = calendar.filter(e => e.slug.includes('sunnuntai-loppiaisesta'));
    assert.ok(epiphSundays.length >= 1 && epiphSundays.length <= 6,
      `Expected 1-6 Epiphany Sundays, got ${epiphSundays.length}`);
  });

  it('includes Hiljainen viikko entries', () => {
    const calendar = generateChurchYear(2025);
    const hvMa = calendar.find(e => e.slug === 'hiljaisen-viikon-maanantai');
    assert.ok(hvMa, 'Holy Monday should exist');
    assert.equal(hvMa.dateStr, '2026-03-30');
  });
});

// ─── Year Cycle ─────────────────────────────────────────────────────────────

describe('Year cycle calculation', () => {
  it('cycles through 1, 2, 3', () => {
    // 2024 → cycle 3, 2025 → cycle 1, 2026 → cycle 2
    const cycles = [2024, 2025, 2026].map(getYearCycle);
    assert.deepEqual(cycles, [3, 1, 2]);
    // And wraps back
    assert.equal(getYearCycle(2027), 3);
  });

  it('determines church year start correctly', () => {
    // Feb 2026 is in church year 2025–2026
    const feb = makeDate(2026, 2, 15);
    assert.equal(getChurchYearStart(feb), 2025);

    // Dec 2025 after Advent 1 is in church year 2025–2026
    const dec = makeDate(2025, 12, 5);
    assert.equal(getChurchYearStart(dec), 2025);

    // Nov 20, 2025 is still in church year 2024–2025
    const nov = makeDate(2025, 11, 20);
    assert.equal(getChurchYearStart(nov), 2024);
  });
});

// ─── Date Resolution ────────────────────────────────────────────────────────

describe('Date resolution', () => {
  it('resolves 1st Advent Sunday 2025', () => {
    const result = resolveDate('2025-11-30');
    assert.ok(result.holyDay);
    assert.equal(result.holyDay.slug, '1-adventtisunnuntai');
    assert.equal(result.holyDay.name, '1. adventtisunnuntai');
    assert.ok(result.holyDay.liturgicalColor);
    assert.ok(result.holyDay.prayers?.length > 0);
  });

  it('resolves a weekday correctly', () => {
    const result = resolveDate('2026-02-03'); // A Tuesday
    // Should either be a holy day or have a preceding Sunday
    if (!result.holyDay) {
      assert.ok(result.precedingSunday, 'Should have a preceding Sunday');
    }
    assert.equal(result.dayOfWeek, 'tiistai');
  });

  it('resolves Christmas Day', () => {
    const result = resolveDate('2025-12-25');
    assert.ok(result.holyDay);
    assert.equal(result.holyDay.slug, 'joulupaiva');
  });

  it('resolves Easter Sunday 2026', () => {
    const result = resolveDate('2026-04-05');
    assert.ok(result.holyDay);
    assert.equal(result.holyDay.slug, 'paasiaispaiva');
    assert.ok(result.holyDay.texts, 'Should have Bible texts');
  });

  it('provides year cycle for the resolved date', () => {
    const result = resolveDate('2025-11-30');
    assert.ok(result.churchYear);
    assert.equal(result.churchYear.yearCycle, 1); // 2025 → cycle 1
  });

  it('resolves Pitkäperjantai', () => {
    const result = resolveDate('2026-04-03');
    assert.ok(result.holyDay);
    assert.equal(result.holyDay.slug, 'pitkaperjantai');
  });

  it('resolves cross-referenced texts', () => {
    // Pääsiäispäivä cycle 2 has firstReading cross-referencing cycle 1
    const result = resolveDate('2026-04-05'); // Easter, year cycle 2
    if (result.holyDay?.texts?.firstReading) {
      // If it's a cross-reference that was resolved, it should have text
      const fr = result.holyDay.texts.firstReading;
      if (fr.reference?.includes('ks.')) {
        assert.ok(fr.text, 'Cross-referenced text should be resolved');
      }
    }
  });
});

// ─── Data Loading ───────────────────────────────────────────────────────────

describe('Data loading', () => {
  it('loads 1-adventtisunnuntai data', () => {
    const data = getDayData('1-adventtisunnuntai');
    assert.ok(data);
    assert.equal(data.name, '1. adventtisunnuntai');
    assert.ok(data.yearCycles);
    assert.ok(data.yearCycles['1']);
    assert.ok(data.yearCycles['2']);
    assert.ok(data.yearCycles['3']);
    assert.ok(data.prayers?.length > 0);
  });

  it('loads pitkäperjantai data', () => {
    const data = getDayData('pitkaperjantai');
    assert.ok(data);
    assert.ok(data.psalm);
    assert.ok(data.yearCycles);
  });
});
