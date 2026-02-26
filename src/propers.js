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
function getSeasonKeys(slug, dayData) {
  const keys = [];
  const period = dayData?.period || '';
  const season = dayData?.season || '';

  // Specific day mappings
  if (slug === '1-adventtisunnuntai') keys.push('1-adventtisunnuntai');
  if (slug.includes('adventti')) keys.push('adventtiaika');
  if (slug === 'jouluaatto') keys.push('jouluaatto', 'jouluaika');
  if (slug === 'jouluyo') keys.push('jouluyo', 'jouluaika');
  if (slug === 'joulupaiva') keys.push('joulupaiva', 'jouluaika');
  if (slug === 'tapaninpaiva') keys.push('jouluaika');
  if (slug.includes('sunnuntai-joulusta')) keys.push('jouluaika');
  if (slug === 'uudenvuodenpaiva') keys.push('jouluaika');
  if (slug === 'loppiainen') keys.push('loppiainen');
  if (slug.includes('sunnuntai-loppiaisesta')) keys.push('loppiaisaika', 'paastonaikaa-edeltavat');
  if (slug.includes('ennen-paastonaikaa')) keys.push('loppiaisaika', 'paastonaikaa-edeltavat');
  if (slug === 'laskiaissunnuntai') keys.push('loppiaisaika', 'paastonaikaa-edeltavat');
  if (slug === 'tuhkakeskiviikko') keys.push('paastonaika');
  if (slug.match(/\d-paastonajan-sunnuntai/)) {
    keys.push('paastonaika');
    // 5. paastonajan sunnuntaista lähtien = kärsimysaika
    const num = parseInt(slug);
    if (num >= 5) keys.push('karsimysaika');
  }
  if (slug === 'palmusunnuntai') keys.push('karsimysaika');
  if (slug.includes('hiljaisen-viikon')) keys.push('karsimysaika');
  if (slug === 'kiirastorstai') keys.push('karsimysaika');
  if (slug === 'pitkaperjantai') keys.push('karsimysaika', 'pitkaperjantai');
  if (slug === 'hiljainen-lauantai') keys.push('karsimysaika');
  if (slug === 'paasiaisyo') keys.push('paasiaisyo', 'paasiaispaiva');
  if (slug === 'paasiaispaiva') keys.push('paasiaispaiva');
  if (slug === '2-paasiaispaiva') keys.push('paasiaisaika');
  if (slug.includes('jalkeinen') && slug.includes('paasiai')) keys.push('paasiaisaika');
  if (slug.match(/\d-sunnuntai-paasiaisesta/)) keys.push('paasiaisaika');
  if (slug === 'helatorstai') keys.push('helatorstai-helluntaiaatto');
  if (slug === '6-sunnuntai-paasiaisesta') keys.push('helatorstai-helluntaiaatto');
  if (slug === 'helluntaiaatto') keys.push('helatorstai-helluntaiaatto');
  if (slug === 'helluntaipaiva') keys.push('helluntai');
  if (slug === 'apostolien-paiva') keys.push('apostolien-paiva');
  if (slug === 'pyhan-henrikin-muistopaiva') keys.push('pyhan-henrikin-muistopaiva');
  if (slug === 'mikkelinpaiva') keys.push('mikkelinpaiva');
  if (slug === 'valvomisen-sunnuntai') keys.push('valvomisen-sunnuntai');
  if (slug === 'tuomiosunnuntai') keys.push('tuomiosunnuntai');
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

  for (const prefaatio of propers.prefaatiot) {
    for (const appliesTo of prefaatio.appliesTo) {
      if (seasonKeys.includes(appliesTo)) {
        return {
          title: prefaatio.title,
          period: prefaatio.period,
          text: prefaatio.text,
        };
      }
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
    'joulupaiva': 'joulupäivänä',
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
    if (key === 'loppiaisaika') keywords.push('Loppiaisaikana');
    if (key === 'paastonaika') keywords.push('Paastonajan', 'paastonajan');
    if (key === 'paasiaisaika') keywords.push('Pääsiäisaikana');
    if (key === 'jouluaika') keywords.push('jouluaikana');
  }

  for (const refrain of propers.kertosaakeet) {
    const occasion = refrain.occasion || '';
    for (const keyword of keywords) {
      if (occasion.includes(keyword)) {
        return refrain;
      }
    }
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
  };
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
 * Get the Improperia text (Good Friday).
 */
export function getImproperia() {
  return loadPropers().improperia;
}
