/**
 * Everything that varies over the church year is present in a resolved day.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDate, getAllDays, getHolyDay, getChurchYearCalendar, getPeriods } from '../src/resolver.js';
import { parseLiturgicalColor } from '../src/colors.js';
import { generateChurchYear, formatDate, addDays, makeDate } from '../src/computus.js';

describe('Data completeness', () => {
  it('every Sunday and holy day in 2021–2030 has readings, prayers and a colour', () => {
    const problems = [];
    for (let year = 2021; year <= 2030; year++) {
      for (const e of generateChurchYear(year)) {
        if (!['sunday', 'feast'].includes(e.type)) continue;
        const r = resolveDate(e.dateStr);
        const day = [r.holyDay, ...r.additionalServices].find(d => d.slug === e.slug);
        if (!day.texts?.gospel?.text) problems.push(`${e.dateStr} ${e.slug}: gospel`);
        if (!day.texts?.firstReading?.text && !day.texts?.weekday) problems.push(`${e.dateStr} ${e.slug}: 1st reading`);
        if (!day.prayers?.length) problems.push(`${e.dateStr} ${e.slug}: prayers`);
        if (!day.liturgicalColor?.color) problems.push(`${e.dateStr} ${e.slug}: colour`);
        if (!day.psalm?.reference) problems.push(`${e.dateStr} ${e.slug}: psalm`);
        if (!day.hallelujah && !day.psalmVerse) problems.push(`${e.dateStr} ${e.slug}: hallelujah/psalm verse`);
      }
    }
    assert.deepEqual(problems, []);
  });

  it('every weekday of a church year has material, colour and rubrics', () => {
    const problems = [];
    for (let d = makeDate(2025, 11, 30); d < makeDate(2026, 11, 29); d = addDays(d, 1)) {
      const r = resolveDate(d);
      const day = r.holyDay ?? r.weekdayMaterial;
      if (!day) { problems.push(`${formatDate(d)}: no day`); continue; }
      if (!day.texts) problems.push(`${formatDate(d)} ${day.slug}: texts`);
      if (!r.liturgicalColor?.color) problems.push(`${formatDate(d)} ${day.slug}: colour`);
      if (typeof r.liturgy?.gloria !== 'boolean') problems.push(`${formatDate(d)}: liturgy`);
      if (!r.season || !r.period) problems.push(`${formatDate(d)} ${day.slug}: season/period`);
    }
    assert.deepEqual(problems, []);
  });

  it('no Bible text is missing from the data', () => {
    const missing = [];
    for (const day of getAllDays()) {
      const sets = day.yearCycles ? Object.values(day.yearCycles) : day.readings ? [day.readings] : [];
      for (const set of sets) {
        for (const key of ['firstReading', 'secondReading', 'gospel']) {
          if (set[key] && !set[key].text) missing.push(`${day.slug} ${key}`);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  it('every day has a theme and period introductions exist', () => {
    const withoutTheme = getAllDays()
      .filter(d => (d.yearCycles || d.readings) && !d.theme)
      .map(d => d.slug);
    assert.deepEqual(withoutTheme, []);
    assert.ok(getPeriods().some(p => p.name === 'Adventtiaika' && p.description.length > 100));
  });
});

describe('Weekdays', () => {
  it('uses the displaced Sunday after Marian ilmestyspäivä (2026)', () => {
    const r = resolveDate('2026-03-24');
    assert.equal(r.holyDay, null);
    assert.equal(r.weekdayMaterial.slug, '5-paastonajan-sunnuntai');
    assert.equal(r.liturgicalColor.color, 'violetti');
  });

  it('switches to the season colour on weekdays after a pistepyhä', () => {
    // Kynttilänpäivä 8.2.2026: white on Sunday, green from Monday
    assert.equal(resolveDate('2026-02-08').liturgicalColor.color, 'valkoinen');
    const monday = resolveDate('2026-02-09');
    assert.equal(monday.weekdayMaterial.slug, '2-sunnuntai-ennen-paastonaikaa');
    assert.equal(monday.liturgicalColor.color, 'vihreä');
  });

  it('uses the 1st Advent week material and its violet colour', () => {
    const r = resolveDate('2025-12-02');
    assert.equal(r.weekdayMaterial.slug, '1-adventtisunnuntain-jalkeinen-viikko');
    assert.ok(r.weekdayMaterial.texts.otReadings.length > 0);
    assert.equal(r.liturgicalColor.color, 'violetti');
  });

  it('6. sunnuntai loppiaisesta uses the texts of 26. sunnuntai helluntaista', () => {
    const day = getHolyDay('6-sunnuntai-loppiaisesta');
    assert.equal(day.materialFrom, '26-sunnuntai-helluntaista');
    assert.match(day.texts.gospel.reference, /^Matt\. 24:1/);
  });
});

describe('Liturgical rubrics', () => {
  it('omits Gloria in Advent from the Monday after 1st Advent', () => {
    assert.equal(resolveDate('2025-11-30').liturgy.gloria, true);
    assert.equal(resolveDate('2025-12-07').liturgy.gloria, false);
    assert.equal(resolveDate('2025-12-25').liturgy.gloria, true);
  });

  it('omits Gloria and Hallelujah in Lent, keeps Gloria on Maundy Thursday', () => {
    const lent = resolveDate('2026-03-01');
    assert.equal(lent.liturgy.gloria, false);
    assert.equal(lent.liturgy.hallelujah, false);
    assert.equal(lent.liturgy.psalmVerseInsteadOfHallelujah, true);
    assert.ok(lent.holyDay.psalmVerse?.text, 'Lent Sunday has a psalm verse');
    assert.equal(resolveDate('2026-04-02').liturgy.gloria, true);
    assert.equal(resolveDate('2026-04-05').liturgy.hallelujah, true);
  });

  it('keeps Gloria, hallelujah and Gloria Patri on Marian ilmestyspäivä in every Lent week (2021–2030)', () => {
    for (let year = 2021; year <= 2030; year++) {
      const entry = generateChurchYear(year).find(e => e.slug === 'marian-ilmestyspaiva');
      const r = resolveDate(entry.dateStr);
      assert.equal(r.holyDay.slug, 'marian-ilmestyspaiva');
      assert.ok(r.holyDay.hallelujah?.text, `${entry.dateStr}: hallelujah verse`);
      assert.deepEqual(
        { gloria: r.liturgy.gloria, hallelujah: r.liturgy.hallelujah, gloriaPatri: r.liturgy.gloriaPatri },
        { gloria: true, hallelujah: true, gloriaPatri: true },
        entry.dateStr,
      );
    }
  });

  it('gives the Easter Vigil its own rubrics on Holy Saturday', () => {
    const r = resolveDate('2026-04-04');
    assert.equal(r.holyDay.slug, 'hiljainen-lauantai');
    assert.deepEqual([r.liturgy.gloria, r.liturgy.hallelujah, r.liturgy.gloriaPatri], [false, false, false]);
    const vigil = r.additionalServices.find(d => d.slug === 'paasiaisyo');
    assert.deepEqual([vigil.liturgy.gloria, vigil.liturgy.hallelujah, vigil.liturgy.gloriaPatri], [true, true, true]);
  });

  it('follows the hallelujah verse / psalm verse and Gloria Patri printed for each day (2021–2030)', () => {
    const problems = [];
    for (let year = 2021; year <= 2030; year++) {
      for (const e of generateChurchYear(year)) {
        if (e.type === 'weekday' || e.type === 'observance') continue;
        const r = resolveDate(e.dateStr, { allYearCycles: false });
        const day = [r.holyDay, ...r.additionalServices].find(d => d.slug === e.slug);
        if (day.hallelujah && !day.liturgy.hallelujah) problems.push(`${e.dateStr} ${e.slug}: hallelujah printed but omitted`);
        if (day.psalmVerse && !day.hallelujah && day.liturgy.hallelujah) problems.push(`${e.dateStr} ${e.slug}: psalm verse printed but hallelujah sung`);
        if (typeof day.psalm?.gloriaPatri === 'boolean' && day.psalm.gloriaPatri !== day.liturgy.gloriaPatri) problems.push(`${e.dateStr} ${e.slug}: Gloria Patri`);
      }
    }
    assert.deepEqual(problems, []);
  });

  it('omits Gloria Patri from 5. paastonajan sunnuntai', () => {
    assert.equal(resolveDate('2026-03-15').liturgy.gloriaPatri, true);
    assert.equal(resolveDate('2028-04-02').liturgy.gloriaPatri, false); // 5. paastonajan sunnuntai
    assert.equal(resolveDate('2026-03-24').liturgy.gloriaPatri, false); // weekday with Judica material
    assert.equal(resolveDate('2026-03-29').liturgy.gloriaPatri, false); // Palmusunnuntai
  });
});

describe('Propers', () => {
  it('returns the kärsimysaika preface and post-communion prayer from 5. paastonajan sunnuntai', () => {
    const day = getHolyDay('5-paastonajan-sunnuntai');
    assert.match(day.propers.prefaatio.title, /kärsimysaikana/);
    assert.equal(day.propers.postCommunionPrayer.slug, 'karsimysaika');
    assert.equal(day.propers.kyrieLitania.slug, 'karsimysaika');
  });
});

describe('Liturgical colours', () => {
  it('parses Sunday and weekday colours', () => {
    const c = parseLiturgicalColor('valkoinen, maanantaista lauantaihin violetti tai sininen');
    assert.equal(c.color, 'valkoinen');
    assert.deepEqual(c.weekdays, { color: 'violetti', alternatives: ['sininen'] });
  });

  it('parses a note after the colour', () => {
    const c = parseLiturgicalColor('valkoinen. Jos jouluaatto on neljäntenä adventtisunnuntaina, käytetään aamupäivän jumalanpalveluksessa vielä violettia tai sinistä väriä');
    assert.equal(c.color, 'valkoinen');
    assert.match(c.note, /neljäntenä adventtisunnuntaina/);
  });
});

describe('Calendar', () => {
  it('lists the displaced Sunday for feasts that take a Sunday', () => {
    const calendar = getChurchYearCalendar(2025);
    const marian = calendar.entries.find(e => e.slug === 'marian-ilmestyspaiva');
    assert.equal(marian.date, '2026-03-22');
    assert.equal(marian.replaces, '5-paastonajan-sunnuntai');
    assert.ok(marian.gospel);
  });
});
