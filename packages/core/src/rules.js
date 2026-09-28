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
 * The Maundy Thursday Mass (Kiirastorstain messu) includes the Gloria. Lent
 * lasts until the Easter Vigil (pääsiäisyö), where Gloria and Hallelujah return.
 */

import { addDays, easterSunday, sameDay } from './computus.js';

const SOURCE = 'Jumalanpalvelusten kirja (Kirkkokäsikirja I, 2000)';

/**
 * @param {Date} date
 * @param {Array} calendar — generateChurchYear output for the date's church year
 * @param {object|null} day — the enriched day (holy day or weekday material)
 */
export function liturgicalRules(date, calendar, day) {
  const advent1 = calendar[0].date;
  const easter = calendar.find(e => e.slug === 'paasiaispaiva')?.date ?? easterSunday(date.getUTCFullYear());
  const ashWednesday = addDays(easter, -46);
  const judica = addDays(easter, -14);
  const holySaturday = addDays(easter, -1);
  const christmasEve = new Date(Date.UTC(advent1.getUTCFullYear(), 11, 24));

  const inAdvent = date > advent1 && (date < christmasEve || (sameDay(date, christmasEve) && day?.slug === '4-adventtisunnuntai'));
  const inLent = date >= ashWednesday && date <= holySaturday;
  const maundyThursday = sameDay(date, addDays(easter, -3));
  const passiontide = date >= judica && date <= holySaturday;

  const gloria = !((inAdvent || inLent) && !maundyThursday);
  const hallelujah = !inLent;
  const notes = [];
  if (inAdvent) notes.push('Kunnia ja kiitosvirsi jätetään pois adventtiaikana (1. adventtisunnuntain jälkeisestä maanantaista lähtien).');
  if (inLent && !maundyThursday) notes.push('Kunnia ja kiitosvirsi jätetään pois paastonaikana (tuhkakeskiviikosta lähtien).');
  if (maundyThursday) notes.push('Kiirastorstain messussa lauletaan Kunnia ja kiitosvirsi.');
  if (inLent) notes.push('Halleluja jätetään pois paastonaikana tuhkakeskiviikosta lähtien. Hallelujalaulun sijasta voidaan käyttää psalmilausetta.');
  if (passiontide) notes.push('Pieni kunnia jätetään pois paastonaikana 5. paastonajan sunnuntaista lähtien.');
  if (sameDay(date, holySaturday)) notes.push('Pääsiäisyön messussa Kunnia ja halleluja lauletaan jälleen.');

  return {
    gloria,
    hallelujah,
    psalmVerseInsteadOfHallelujah: !hallelujah,
    gloriaPatri: !passiontide,
    notes,
    source: SOURCE,
  };
}
