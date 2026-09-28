/**
 * Propers Service — maps liturgical propers from Jumalanpalvelusten kirja
 * to specific church year dates and seasons.
 *
 * Source: Kirkkokäsikirja I (Jumalanpalvelusten kirja, 2000)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

let propersData = null;

function loadPropers() {
  if (propersData) return propersData;
  const raw = readFileSync(join(DATA_DIR, 'propers.json'), 'utf-8');
  propersData = JSON.parse(raw);
  return propersData;
}

// ─── Season Mapping ─────────────────────────────────────────────────────────

/**
 * Map a holy day slug and its metadata to the appropriate liturgical season
 * for propers selection.
 *
 * @param {string} slug - Holy day slug
 * @param {Object} dayData - Parsed day data from Evankeliumikirja
 * @returns {string[]} Matching season keys for propers lookup
 */
export function getSeasonKeys(slug, dayData) {
  const keys = [];
  const period = dayData?.period || '';

  // Christmas
  if (slug === '1-adventtisunnuntai') keys.push('1-adventtisunnuntai');
  if (period === 'Adventtiaika' || slug.includes('adventti')) keys.push('adventtiaika');
  if (slug === 'jouluaatto') keys.push('jouluaatto', 'jouluaika');
  if (slug === 'jouluyo') keys.push('jouluyo', 'jouluaika');
  if (slug === 'jouluaamu' || slug === 'joulupaiva') keys.push('joulupaiva', 'jouluaika');
  if (slug === 'loppiainen') keys.push('loppiainen');
  if (period === 'Jouluaika' && slug !== 'loppiainen') keys.push('jouluaika');
  if (period === 'Loppiaisaika' && slug !== 'loppiainen') keys.push('loppiaisaika', 'paastonaikaa-edeltavat');
  if (period === 'Paastonaikaa edeltävät sunnuntait') keys.push('loppiaisaika', 'paastonaikaa-edeltavat');

  // Lent and Holy Week: kärsimysaika from 5. paastonajan sunnuntai
  const passiontide = slug === '5-paastonajan-sunnuntai' || slug === 'palmusunnuntai' ||
    slug.startsWith('hiljai') || ['kiirastorstai', 'pitkaperjantai', 'jeesuksen-kuolinhetki', 'pitkaperjantain-ilta'].includes(slug);
  if (['pitkaperjantai', 'jeesuksen-kuolinhetki', 'pitkaperjantain-ilta', 'hiljainen-lauantai'].includes(slug)) keys.push('pitkaperjantai');
  if (passiontide) keys.push('karsimysaika');
  if (period === 'Paastonaika') keys.push('paastonaika');

  // Easter
  if (slug === 'paasiaisyo') keys.push('paasiaisyo', 'paasiaispaiva');
  if (slug === 'paasiaispaiva') keys.push('paasiaispaiva');
  if (period === 'Pääsiäisaika') keys.push('paasiaisaika');
  if (['helatorstai', '6-sunnuntai-paasiaisesta', 'helluntaiaatto'].includes(slug)) keys.unshift('helatorstai-helluntaiaatto');

  // Pentecost
  if (slug === 'helluntaipaiva' || slug.startsWith('helluntain-jalkeinen-viikko')) keys.push('helluntai');

  // Days with their own propers
  for (const own of ['apostolien-paiva', 'pyhan-henrikin-muistopaiva', 'mikkelinpaiva', 'valvomisen-sunnuntai', 'tuomiosunnuntai']) {
    if (slug === own) keys.push(own);
  }
  if (slug === 'kynttilanpaiva') keys.push('kynttilanpaiva', 'jouluaika');
  if (slug === 'marian-ilmestyspaiva') keys.push('marian-ilmestyspaiva', 'jouluaika');

  return [...new Set(keys)];
}

// ─── Prefaatio Resolution ───────────────────────────────────────────────────

/**
 * Get the appropriate preface ending for a given holy day.
 *
 * @param {string} slug - Holy day slug
 * @param {Object} dayData - Parsed day data
 * @returns {Object|null} Matching preface ending
 */
export function getPrefaatio(slug, dayData) {
  const propers = loadPropers();
  const seasonKeys = getSeasonKeys(slug, dayData);

  // Season keys are ordered from most to least specific.
  for (const key of seasonKeys) {
    const prefaatio = propers.prefaatiot.find(p => p.appliesTo.includes(key));
    if (prefaatio) {
      return {
        title: prefaatio.title,
        period: prefaatio.period,
        text: prefaatio.text,
      };
    }
  }

  return null;
}

// ─── Kyrie-litania Resolution ───────────────────────────────────────────────

/**
 * Get the appropriate Kyrie litany for a given holy day.
 */
export function getKyrieLitania(slug, dayData) {
  const propers = loadPropers();
  const seasonKeys = getSeasonKeys(slug, dayData);

  // Map season keys to Kyrie slugs
  const kyrieMapping = {
    '1-adventtisunnuntai': '1-adventtisunnuntai',
    'adventtiaika': 'adventtiaika',
    'jouluaatto': 'joulu-jouluaika',
    'jouluyo': 'joulu-jouluaika',
    'joulupaiva': 'joulu-jouluaika',
    'jouluaika': 'joulu-jouluaika',
    'paastonaika': 'paastonaika',
    'karsimysaika': 'karsimysaika',
    'pitkaperjantai': 'pitkaperjantai-hiljainen-lauantai',
    'paasiaisyo': 'paasiainen-paasiaisaika',
    'paasiaispaiva': 'paasiainen-paasiaisaika',
    'paasiaisaika': 'paasiainen-paasiaisaika',
    'helatorstai-helluntaiaatto': 'helatorstai-helluntaiaatto',
    'helluntai': 'helluntai',
  };

  for (const key of seasonKeys) {
    const kyrieSlug = kyrieMapping[key];
    if (kyrieSlug) {
      const litania = propers.kyrieLitaniat.find(k => k.slug === kyrieSlug);
      if (litania) return litania;
    }
  }

  return null;
}

// ─── Kertosäe (Psalm Refrain) Resolution ────────────────────────────────────

/**
 * Get the appropriate psalm refrain for a given holy day.
 */
export function getKertosae(slug, dayData) {
  const propers = loadPropers();

  // Map slugs to kertosäe occasion keywords
  const occasionMap = {
    '1-adventtisunnuntai': '1. adventtisunnuntai',
    'adventtiaika': 'Adventtiaikana',
    'jouluaatto': 'Jouluaattona',
    'jouluyo': 'Jouluyönä',
    'jouluaamu': '-aamuna',
    'joulupaiva': 'joulupäivänä',
    'apostoli-johanneksen-paiva': 'jouluaikana',
    'viattomien-lasten-paiva': 'jouluaikana',
    '3-sunnuntai-ennen-paastonaikaa': 'Paastonaikaa edeltävinä',
    '2-sunnuntai-ennen-paastonaikaa': 'Paastonaikaa edeltävinä',
    '1-paastonajan-sunnuntai': 'Paastonajan alkupuolella',
    '2-paastonajan-sunnuntai': 'Paastonajan alkupuolella',
    '3-paastonajan-sunnuntai': 'Paastonajan alkupuolella',
    '4-paastonajan-sunnuntai': '4. paastonajan',
    '5-paastonajan-sunnuntai': '5. paastonajan',
    'tapaninpaiva': 'Tapaninpäivänä',
    'loppiainen': 'Loppiaisena',
    'laskiaissunnuntai': 'Laskiaissunnuntaina',
    'palmusunnuntai': 'Palmusunnuntaina',
    'kiirastorstai': 'Kiirastorstaina',
    'pitkaperjantai': 'Pitkäperjantaina',
    'paasiaisyo': 'Pääsiäisyönä',
    'paasiaispaiva': 'Pääsiäis',
    'helluntaipaiva': 'Helluntaina',
    'pyhan-kolminaisuuden-paiva': 'Pyhän Kolminaisuuden',
    'reformaation-paiva': 'Uskonpuhdistuksen',
    'kynttilanpaiva': 'Kynttilänpäivänä',
    'marian-ilmestyspaiva': 'Marian ilmestyspäivänä',
    'juhannuspaiva': 'Juhannuspäivänä',
    'mikkelinpaiva': 'Mikkelinpäivänä',
    'pyhainpaiva': 'Pyhäinpäivänä',
    'pyhan-henrikin-muistopaiva': 'Pyhän Henrikin',
  };

  const keywords = [];
  if (occasionMap[slug]) keywords.push(occasionMap[slug]);

  // Also match by season
  const seasonKeys = getSeasonKeys(slug, dayData);
  for (const key of seasonKeys) {
    if (key === 'adventtiaika') keywords.push('Adventtiaikana');
    if (key === 'loppiaisaika') keywords.push('Loppiaisaikana');
    if (key === 'paastonaika' && !seasonKeys.includes('karsimysaika')) keywords.push('Paastonajan alkupuolella');
    if (key === 'paasiaisaika') keywords.push('Pääsiäisaikana');
    if (key === 'jouluaika') keywords.push('jouluaikana');
  }

  // Keywords are ordered from most to least specific.
  for (const keyword of keywords) {
    const refrain = propers.kertosaakeet.find(r => (r.occasion || '').includes(keyword));
    if (refrain) return refrain;
  }

  return null;
}

// ─── Get All Propers for a Day ──────────────────────────────────────────────

/**
 * Get all applicable propers for a given holy day.
 */
export function getPropers(slug, dayData) {
  return {
    prefaatio: getPrefaatio(slug, dayData),
    kyrieLitania: getKyrieLitania(slug, dayData),
    kertosae: getKertosae(slug, dayData),
    postCommunionPrayer: getPostCommunionPrayer(slug, dayData),
  };
}

// ─── Kiitosrukous ehtoollisen jälkeen (post-communion prayer) ───────────────

/**
 * Get the seasonal thanksgiving prayer after communion. Outside the seasons
 * listed in Jumalanpalvelusten kirja the prayer is chosen freely (null).
 */
export function getPostCommunionPrayer(slug, dayData) {
  const propers = loadPropers();
  const seasonKeys = getSeasonKeys(slug, dayData);
  const mapping = {
    'adventtiaika': 'adventtiaika',
    'jouluaatto': 'jouluaika',
    'jouluyo': 'jouluaika',
    'joulupaiva': 'jouluaika',
    'jouluaika': 'jouluaika',
    'karsimysaika': 'karsimysaika',
    'paastonaika': 'paastonaika',
    'paasiaisyo': 'paasiaisyo-paasiaispaiva',
    'paasiaispaiva': 'paasiaisyo-paasiaispaiva',
    'paasiaisaika': 'paasiaisaika',
    'helatorstai-helluntaiaatto': 'paasiaisaika',
    'helluntai': 'helluntai',
  };
  for (const key of seasonKeys) {
    const found = propers.kiitosrukouksetEhtoollinen?.find(k => k.slug === mapping[key]);
    if (found) return found;
  }
  return null;
}

// ─── Direct Access ──────────────────────────────────────────────────────────

/**
 * Get all prefaatio endings.
 */
export function getAllPrefaatiot() {
  return loadPropers().prefaatiot;
}

/**
 * Get all Kyrie litanies.
 */
export function getAllKyrieLitaniat() {
  return loadPropers().kyrieLitaniat;
}

/**
 * Get all synninpäästöt.
 */
export function getAllSynninpaastot() {
  return loadPropers().synninpaastot;
}

/**
 * Get all kiitosrukoukset.
 */
export function getAllKiitosrukoukset() {
  return loadPropers().kiitosrukoukset;
}

/**
 * Get all kertosäkeet.
 */
export function getAllKertosaakeet() {
  return loadPropers().kertosaakeet;
}

/**
 * Get all seasonal thanksgiving prayers after communion.
 */
export function getAllKiitosrukouksetEhtoollinen() {
  return loadPropers().kiitosrukouksetEhtoollinen;
}

/**
 * Get the Improperia text (Good Friday).
 */
export function getImproperia() {
  return loadPropers().improperia;
}
