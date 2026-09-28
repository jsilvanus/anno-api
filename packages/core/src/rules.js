/**
 * Seasonal rubrics of the Mass (messu), from Jumalanpalvelusten kirja (2000):
 *
 *   "Kunnia ja kiitosvirsi jätetään pois paastonaikana (tuhkakeskiviikosta
 *    lähtien) ja adventtiaikana (1. adventtisunnuntain jälkeisestä
 *    maanantaista lähtien)."
 *   "Halleluja jätetään pois paastonaikana tuhkakeskiviikosta lähtien.
 *    Tällöin hallelujalaulun sijasta voidaan käyttää psalmilausetta."
 *   "Pieni kunnia jätetään pois paastonaikana 5. paastonajan sunnuntaista
 *    lähtien."
 *
 * The rubrics are worked out per day or service, not per date:
 *
 * - Hallelujah and Gloria Patri follow what Evankeliumikirja prints for the
 *   day: a hallelujah verse (hallelujasäe) or a psalm verse (psalmilause), and
 *   the psalm with or without Gloria Patri. The seasonal rule is only the
 *   fallback for material that prints neither.
 * - Feasts keep the Gloria in Lent: the Maundy Thursday Mass (Kiirastorstain
 *   messu), Marian ilmestyspäivä (also in Passiontide) and the Easter Vigil
 *   (pääsiäisyö), where Gloria and Hallelujah return.
 */

import { addDays, easterSunday, sameDay } from './computus.js';

const SOURCE = 'Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000); Evankeliumikirja (2021)';

/** Days that keep the Gloria in Advent or Lent. (The Easter Vigil is outside Lent below.) */
const GLORIA_KEPT = {
  'kiirastorstai': 'Kiirastorstain messussa lauletaan Kunnia ja kiitosvirsi.',
  'marian-ilmestyspaiva': 'Marian ilmestyspäivänä lauletaan Kunnia ja kiitosvirsi myös paastonaikana.',
};

/**
 * @param {Date} date
 * @param {Array} calendar — generateChurchYear output for the date's church year
 * @param {object|null} day — the enriched day or service (holy day or weekday material)
 */
export function liturgicalRules(date, calendar, day) {
  const advent1 = calendar[0].date;
  const easter = calendar.find(e => e.slug === 'paasiaispaiva')?.date ?? easterSunday(date.getUTCFullYear());
  const ashWednesday = addDays(easter, -46);
  const judica = addDays(easter, -14);
  const holySaturday = addDays(easter, -1);
  const christmasEve = new Date(Date.UTC(advent1.getUTCFullYear(), 11, 24));
  const slug = day?.slug;
  const easterVigil = slug === 'paasiaisyo';

  const inAdvent = date > advent1 && (date < christmasEve || (sameDay(date, christmasEve) && slug === '4-adventtisunnuntai'));
  const inLent = date >= ashWednesday && date <= holySaturday && !easterVigil;
  const passiontide = date >= judica && date <= holySaturday && !easterVigil;
  const notes = [];

  // Gloria: seasonal rule with the feasts that keep it
  const gloriaKept = (inAdvent || inLent) && GLORIA_KEPT[slug];
  const gloria = !(inAdvent || inLent) || Boolean(gloriaKept);
  if (gloriaKept) notes.push(GLORIA_KEPT[slug]);
  else if (inAdvent) notes.push('Kunnia ja kiitosvirsi jätetään pois adventtiaikana (1. adventtisunnuntain jälkeisestä maanantaista lähtien).');
  else if (inLent) notes.push('Kunnia ja kiitosvirsi jätetään pois paastonaikana (tuhkakeskiviikosta lähtien).');
  if (easterVigil) notes.push('Pääsiäisyön messussa Kunnia ja kiitosvirsi sekä halleluja lauletaan jälleen.');

  // Hallelujah: what the book prints for the day, else the seasonal rule
  const hallelujah = day?.hallelujah ? true : day?.psalmVerse ? false : !inLent;
  if (!hallelujah) notes.push('Halleluja jätetään pois paastonaikana tuhkakeskiviikosta lähtien. Hallelujalaulun sijasta voidaan käyttää psalmilausetta.');
  else if (inLent && day?.hallelujah) notes.push(`${day.name}: hallelujasäe lauletaan myös paastonaikana.`);

  // Gloria Patri: as printed with the day's psalm, else the seasonal rule
  const gloriaPatri = typeof day?.psalm?.gloriaPatri === 'boolean' ? day.psalm.gloriaPatri : !passiontide;
  if (!gloriaPatri) notes.push('Pieni kunnia jätetään pois paastonaikana 5. paastonajan sunnuntaista lähtien.');
  else if (passiontide) notes.push(`${day.name}: psalmiin liitetään pieni kunnia myös kärsimysaikana.`);

  return {
    gloria,
    hallelujah,
    psalmVerseInsteadOfHallelujah: !hallelujah,
    gloriaPatri,
    notes,
    source: SOURCE,
  };
}
