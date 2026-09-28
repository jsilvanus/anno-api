/**
 * Liturgical colours.
 *
 * Evankeliumikirja gives each day's colour as text, e.g.
 *   "vihreä"
 *   "violetti tai sininen"
 *   "valkoinen, maanantaista lauantaihin vihreä"
 *   "valkoinen. Jos jouluaatto on neljäntenä adventtisunnuntaina, käytetään …"
 *   "punainen tai, varsinkin iltajumalanpalveluksessa, valkoinen"
 */

export const COLORS = ['valkoinen', 'violetti', 'sininen', 'vihreä', 'punainen', 'musta'];

const COLOR_EN = {
  valkoinen: 'white',
  violetti: 'violet',
  sininen: 'blue',
  vihreä: 'green',
  punainen: 'red',
  musta: 'black',
};

function colorsIn(text) {
  // Word order in the text is the order of preference.
  return (text.match(new RegExp(`\\b(${COLORS.join('|')})`, 'g')) || []).filter((c, i, all) => all.indexOf(c) === i);
}

/**
 * Parse a colour description.
 * @returns {{ color: string, alternatives: string[], weekdays: object|null, note: string|null, text: string } | null}
 */
export function parseLiturgicalColor(text) {
  if (!text) return null;
  const [main, ...rest] = text.split(/\.\s+/);
  const note = rest.join('. ').trim() || null;
  const weekdayMatch = main.match(/^(.*?),\s*maanantaista lauantaihin\s+(.*)$/);
  const dayPart = weekdayMatch ? weekdayMatch[1] : main;
  const colors = colorsIn(dayPart);
  const weekdayColors = weekdayMatch ? colorsIn(weekdayMatch[2]) : null;
  return {
    color: colors[0] ?? null,
    alternatives: colors.slice(1),
    weekdays: weekdayColors ? { color: weekdayColors[0] ?? null, alternatives: weekdayColors.slice(1) } : null,
    note,
    text,
  };
}

/**
 * The colour of a day, or of the weekdays that use its material.
 * @returns {{ color: string, alternatives: string[], english: string[], note: string|null, text: string } | null}
 */
export function colorForDay(text, { weekday = false } = {}) {
  const parsed = parseLiturgicalColor(text);
  if (!parsed) return null;
  const chosen = weekday && parsed.weekdays ? parsed.weekdays : parsed;
  return {
    color: chosen.color,
    alternatives: chosen.alternatives,
    english: [chosen.color, ...chosen.alternatives].filter(Boolean).map(c => COLOR_EN[c]),
    note: weekday ? null : parsed.note,
    text: parsed.text,
  };
}
