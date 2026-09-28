/**
 * Weekly lectionary (viikkolektionaari): prayer-hour texts for every day.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDate, generateChurchYear, firstAdventSunday, addDays, formatDate, dayOfWeek,
  dailyLectionary, getByHolyDay, getHolyDayNames,
} from '../src/index.js';

const refs = passages => passages.map(p => p.reference);

describe('Weekly lectionary', () => {
  it('gives the Monday readings and hour psalms (28.9.2026)', () => {
    const r = resolveDate('2026-09-28', { allYearCycles: false });
    const l = r.weekdayMaterial.dailyLectionary;
    assert.equal(r.weekdayMaterial.slug, '18-sunnuntai-helluntaista');
    assert.deepEqual(refs(l.morning.readings), ['1. Kor. 7:19–23']);
    assert.deepEqual(refs(l.morning.psalms), ['Ps. 5:2–9, 12–13']);
    assert.deepEqual(refs(l.noon.psalms), ['Ps. 67:2–8']);
    assert.deepEqual(refs(l.evening.readings), ['1. Kor. 8:4–13']);
    assert.deepEqual(refs(l.dayPsalm), ['Ps. 138']);
    assert.match(l.morning.readings[0].text, /^On yhdentekevää, onko ihminen ympärileikattu/);
    assert.match(l.morning.psalms[0].chant, /\*/, 'psalms carry cadence marks');
  });

  it('gives the Sunday first vespers, week psalm and apocrypha (27.9.2026)', () => {
    const l = resolveDate('2026-09-27').holyDay.dailyLectionary;
    assert.deepEqual(refs(l.firstVespers.readings), ['Ap. t. 10:9–16']);
    assert.deepEqual(refs(l.weekPsalm), ['Ps. 119:97–104']);
    assert.deepEqual(refs(l.apocrypha), ['Sir. 5:9–6:1']);
  });

  it('prays the Sunday\'s first vespers on Saturday evening and its second vespers on Sunday evening', () => {
    const sat = resolveDate('2026-09-26').weekdayMaterial.dailyLectionary.evening;
    assert.equal(sat.vespers, 'first');
    assert.deepEqual(sat.of, { date: '2026-09-27', slug: '18-sunnuntai-helluntaista', name: '18. sunnuntai helluntaista' });
    assert.deepEqual(refs(sat.readings), ['Ap. t. 10:9–16']);
    assert.deepEqual(refs(sat.psalms), ['Ps. 122']);
    const sun = resolveDate('2026-09-27').holyDay.dailyLectionary.evening;
    assert.equal(sun.vespers, 'second');
    assert.equal(sun.of.slug, '18-sunnuntai-helluntaista');
    assert.deepEqual(refs(sun.readings), ['Room. 14:1–8']);
  });

  it('takes Saturday\'s first vespers from the next day, not from the week (31.1. and 7.2.2026)', () => {
    // The week of 3. sunnuntai loppiaisesta is followed by 4. sunnuntai loppiaisesta in
    // some years; in 2026 by 3. sunnuntai ennen paastonaikaa, and that by kynttilänpäivä
    const jan31 = resolveDate('2026-01-31').weekdayMaterial.dailyLectionary.evening;
    assert.equal(jan31.of.slug, '3-sunnuntai-ennen-paastonaikaa');
    assert.deepEqual(refs(jan31.readings), ['1. Moos. 6:9–22']);
    const feb7 = resolveDate('2026-02-07').weekdayMaterial.dailyLectionary.evening;
    assert.equal(feb7.of.slug, 'kynttilanpaiva');
    assert.deepEqual(refs(feb7.readings), refs(resolveDate('2026-02-08').holyDay.dailyLectionary.firstVespers.readings));
  });

  it('gives a feast on the Saturday its second vespers and the Sunday\'s first vespers alongside (pyhäinpäivä 31.10.2026)', () => {
    const l = resolveDate('2026-10-31').holyDay.dailyLectionary;
    assert.equal(l.evening.vespers, 'second');
    assert.equal(l.evening.of.slug, 'pyhainpaiva');
    assert.equal(l.nextDayFirstVespers.vespers, 'first');
    assert.equal(l.nextDayFirstVespers.of.slug, '23-sunnuntai-helluntaista');
    // and the Friday evening before is pyhäinpäivä's first vespers
    assert.equal(resolveDate('2026-10-30').weekdayMaterial.dailyLectionary.evening.of.slug, 'pyhainpaiva');
  });

  it('gives each service on Good Friday its own texts', () => {
    const r = resolveDate('2026-04-03');
    const evening = r.additionalServices.find(d => d.slug === 'pitkaperjantain-ilta').dailyLectionary;
    assert.ok(refs(evening.evening.readings).includes('Mark. 15:42–47'));
    assert.deepEqual(refs(r.holyDay.dailyLectionary.morning.readings), ['Mark. 15:21–41']);
  });

  it('uses the week of the displaced Sunday after Marian ilmestyspäivä (23.3.2026)', () => {
    const l = resolveDate('2026-03-23').weekdayMaterial.dailyLectionary;
    assert.deepEqual(refs(l.morning.readings), ['Hepr. 5:1–6']);
  });

  it('borrows the readings of 26. sunnuntai helluntaista for 6. sunnuntai loppiaisesta', () => {
    const six = dailyLectionary('6-sunnuntai-loppiaisesta', 1);
    const twentySix = dailyLectionary('26-sunnuntai-helluntaista', 1);
    assert.deepEqual(six.morning.readings, twentySix.morning.readings);
    assert.deepEqual(six.dayPsalm, dailyLectionary('5-sunnuntai-loppiaisesta', 1).dayPsalm);
  });

  it('has texts for every day of every church year 2021–2040', () => {
    const problems = [];
    for (let year = 2021; year <= 2040; year++) {
      const end = firstAdventSunday(year + 1);
      for (let d = generateChurchYear(year)[0].date; d < end; d = addDays(d, 1)) {
        const r = resolveDate(d, { allYearCycles: false });
        for (const day of [r.holyDay, ...r.additionalServices, r.weekdayMaterial]) {
          if (!day || day.type === 'observance') continue;
          const l = day.dailyLectionary;
          if (!l) { problems.push(`${formatDate(d)} ${day.slug}: none`); continue; }
          const all = [l.firstVespers, l.morning, l.noon, l.evening].filter(Boolean)
            .flatMap(h => [...h.readings, ...h.psalms]).concat(l.dayPsalm, l.weekPsalm, l.apocrypha);
          if (!all.length) problems.push(`${formatDate(d)} ${day.slug}: empty`);
          for (const p of all) if (!p.text) problems.push(`${formatDate(d)} ${day.slug}: no text for ${p.reference}`);
        }
        // Every weekday without a holy day has a morning and an evening reading
        if (!r.holyDay) {
          const l = r.weekdayMaterial?.dailyLectionary;
          if (!l?.morning?.readings.length || !l?.evening?.readings.length) {
            problems.push(`${formatDate(d)} ${r.weekdayMaterial?.slug}: morning/evening reading`);
          }
          // Saturday has no vespers of its own: its evening is the next day's first vespers
          const evening = r.weekdayMaterial?.dailyLectionary?.evening;
          if (dayOfWeek(d) === 6 && (evening?.vespers !== 'first' || evening.of.date !== formatDate(addDays(d, 1)))) {
            problems.push(`${formatDate(d)}: Saturday evening is not the next day's first vespers`);
          }
        }
      }
    }
    assert.deepEqual([...new Set(problems)].slice(0, 20), []);
  });

  it('gives first vespers also where the site leaves them out', () => {
    // Saturday 3.1.2026: the site gives only the psalm; Sunday 4.1. is 2. sunnuntai joulusta
    const sat = resolveDate('2026-01-03').weekdayMaterial.dailyLectionary.evening;
    assert.deepEqual(refs(sat.readings), refs(resolveDate('2026-01-04').holyDay.dailyLectionary.firstVespers.readings));
    assert.deepEqual(refs(sat.psalms), ['Ps. 122']);
    // Wednesday 5.1.2028, eve of loppiainen: the site has only the psalm; the feast's
    // eve text is 2. Kor. 4:3–6 (on the site only when 6.1. is a Sunday)
    assert.deepEqual(refs(resolveDate('2028-01-05').weekdayMaterial.dailyLectionary.evening.readings), ['2. Kor. 4:3–6']);
  });

  it('uses the same morning, midday and evening psalms on every ordinary weekday', () => {
    const byWeekday = new Map();
    for (let d = new Date(Date.UTC(2026, 5, 1)); d < new Date(Date.UTC(2026, 10, 1)); d = addDays(d, 1)) {
      const r = resolveDate(d, { allYearCycles: false });
      if (r.holyDay || dayOfWeek(d) === 0 || dayOfWeek(d) === 6) continue;
      const l = r.weekdayMaterial.dailyLectionary;
      // By psalm: the site gives one week a shorter Ps. 104 (without 27–30)
      const key = [l.morning, l.noon, l.evening].map(h => refs(h.psalms).map(r => r.replace(/:.*/, '')).join('+')).join(' | ');
      const seen = byWeekday.get(dayOfWeek(d));
      if (seen) assert.equal(key, seen, formatDate(d));
      else byWeekday.set(dayOfWeek(d), key);
    }
  });

  it('agrees with the lectionary index of the viikkolektionaari PDF', () => {
    // Index contexts → [weekday, hour]
    const CONTEXT = {
      'sunnuntai-ilta': [0, 'evening'], maanantaiaamu: [1, 'morning'], 'maanantai-ilta': [1, 'evening'],
      tiistaiaamu: [2, 'morning'], 'tiistai-ilta': [2, 'evening'], keskiviikkoaamu: [3, 'morning'],
      keskiviikkoilta: [3, 'evening'], torstaiaamu: [4, 'morning'], 'torstai-ilta': [4, 'evening'],
      perjantaiaamu: [5, 'morning'], 'perjantai-ilta': [5, 'evening'], lauantaiaamu: [6, 'morning'],
    };
    const slugify = t => t.toLowerCase().replace(/\(.*?\)/g, '').replace(/[äå]/g, 'a').replace(/ö/g, 'o')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    const norm = ref => ref.replace(/[-–]+/g, '–').replace(/;/g, ',').replace(/\s+/g, '');
    const mismatches = [];
    let checked = 0;
    for (const name of getHolyDayNames()) {
      const slug = slugify(name);
      for (const entry of getByHolyDay(name)[name] ?? []) {
        const ctx = CONTEXT[entry.context];
        if (!ctx) continue;
        const [weekday, hourName] = ctx;
        const l = dailyLectionary(slug, weekday);
        if (!l) continue; // index names that are not calendar days
        checked++;
        const got = (l[hourName]?.readings ?? []).map(p => norm(p.reference));
        const want = norm(`${entry.abbreviation} ${entry.reference}`);
        if (!got.includes(want)) mismatches.push(`${name} ${entry.context}: index ${want}, site ${got.join(' / ') || '-'}`);
      }
    }
    assert.ok(checked > 400, `checked ${checked}`);
    assert.deepEqual(mismatches, []);
  });
});
