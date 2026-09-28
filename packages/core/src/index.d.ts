/**
 * Type declarations for @anno-api/core (the implementation is plain ESM JavaScript).
 */

export interface Reading {
  reference: string;
  bookIntro: string | null;
  text: string | null;
  alternatives?: Reading[];
  sameAsYearCycle?: number;
}

export interface Verse {
  text: string;
  reference: string | null;
  alternatives?: Verse[];
}

export interface Psalm {
  antiphon: string | null;
  antiphonReference: string | null;
  alternativeAntiphons?: Verse[];
  text: string | null;
  reference: string | null;
  gloriaPatri: boolean;
  alternativePsalm: Psalm | null;
}

export interface Texts {
  yearCycle: number;
  sameInAllCycles: boolean;
  weekday?: boolean;
  firstReading?: Reading | null;
  secondReading?: Reading | null;
  gospel?: Reading | null;
  otReadings?: Reading[];
  ntReadings?: Reading[];
  readings?: Reading[];
  alternativeSermonTexts?: string[];
}

export interface LiturgicalColor {
  color: string | null;
  alternatives: string[];
  english: string[];
  note: string | null;
  text: string;
}

export interface Propers {
  prefaatio: { title: string; period: string; text: string } | null;
  kyrieLitania: { season: string; slug: string; texts: string[] } | null;
  kertosae: { number: number; title: string; occasion: string; alternatives: unknown[] } | null;
  postCommunionPrayer: { season: string; slug: string; texts: string[] } | null;
}

export interface Liturgy {
  gloria: boolean;
  hallelujah: boolean;
  psalmVerseInsteadOfHallelujah: boolean;
  gloriaPatri: boolean;
  notes: string[];
  source: string;
}

export interface Day {
  name: string;
  slug: string;
  date: string | null;
  type: string | null;
  theme: string | null;
  latinName: string | null;
  alternativeName: string | null;
  season: string | null;
  period: string | null;
  description: string | null;
  liturgicalColor: LiturgicalColor | null;
  replaces: string | null;
  materialFrom?: string;
  texts: Texts | null;
  allYearCycles?: Record<string, unknown>;
  psalm: Psalm | null;
  hallelujah: Verse | null;
  psalmVerse: Verse | null;
  prayers: { number: number; text: string }[];
  hymns: Record<string, { number: string; title: string }[]> | null;
  propers: Propers;
  /** Number of altar candles, e.g. "Kaksi alttarikynttilää". */
  altarCandles: string | null;
  /** Prayer-hour texts of this day on this weekday (viikkolektionaari). */
  dailyLectionary?: DailyLectionary | null;
  /** Rubrics of this day or service (null for an undated holy day lookup). */
  liturgy?: Liturgy | null;
}

export interface Passage {
  reference: string;
  text: string | null;
  /** Psalm text with cadence marks: "*" pause, "_x_" syllable where the cadence starts. */
  chant?: string;
}

export interface PrayerHour {
  readings: Passage[];
  psalms: Passage[];
}

export interface DailyLectionary {
  eve: PrayerHour | null;
  morning: PrayerHour | null;
  noon: PrayerHour | null;
  evening: PrayerHour | null;
  dayPsalm: Passage[];
  weekPsalm: Passage[];
  apocrypha: Passage[];
}

export interface ChurchYear {
  start: number;
  label: string;
  yearCycle: number;
  firstAdventSunday: string;
  easter: string;
  lastDay: string;
}

export interface ResolvedDate {
  date: string;
  dayOfWeek: string;
  churchYear: ChurchYear;
  season: string | null;
  period: string | null;
  holyDay: Day | null;
  additionalServices: Day[];
  weekdayMaterial: Day | null;
  liturgicalColor: LiturgicalColor | null;
  liturgy: Liturgy;
}

export interface CalendarEntry {
  date: string;
  slug: string;
  name: string;
  type: string;
  theme: string | null;
  liturgicalColor: string | null;
  gospel: string | null;
  replaces?: string;
}

export interface RawDay {
  name: string;
  slug: string;
  theme: string | null;
  latinName: string | null;
  alternativeName?: string | null;
  season: string;
  period: string;
  description: string | null;
  liturgicalColor: string | null;
  [key: string]: unknown;
}

export interface ReadingSearchResult {
  holyDay: string;
  slug: string;
  yearCycle: number | null;
  readingType: string;
  reference: string;
  alternative: boolean;
}

export function resolveDate(date: Date | string, options?: { allYearCycles?: boolean }): ResolvedDate;
export function getHolyDay(slug: string, options?: { yearCycle?: number | null; churchYear?: number | null }): (Day & { churchYear: ChurchYear }) | null;
export function getDayData(slug: string): RawDay | null;
export function getAllDays(): RawDay[];
export function getPeriods(): { name: string; season: string; description: string }[];
export function getChurchYearCalendar(startYear: number): { churchYear: ChurchYear; entries: CalendarEntry[] };

export function easterSunday(year: number): Date;
export function makeDate(year: number, month: number, day: number): Date;
export function addDays(date: Date, days: number): Date;
export function dayOfWeek(date: Date): number;
export function sameDay(a: Date, b: Date): boolean;
export function formatDate(date: Date): string;
export function parseDate(str: string): Date;
export function firstAdventSunday(year: number): Date;
export function generateChurchYear(startYear: number): unknown[];
export function weekdayMaterialSlug(calendar: unknown[], date: Date): string | null;
export function getYearCycle(churchYearStartYear: number): number;
export function getChurchYearStart(date: Date): number;
export const ENTRY_TYPES: string[];

export function getPropers(slug: string, dayData: unknown): Propers;
export function getSeasonKeys(slug: string, dayData: unknown): string[];
export function getPrefaatio(slug: string, dayData: unknown): Propers['prefaatio'];
export function getKyrieLitania(slug: string, dayData: unknown): Propers['kyrieLitania'];
export function getKertosae(slug: string, dayData: unknown): Propers['kertosae'];
export function getPostCommunionPrayer(slug: string, dayData: unknown): Propers['postCommunionPrayer'];
export function getAllPrefaatiot(): unknown[];
export function getAllKyrieLitaniat(): unknown[];
export function getAllSynninpaastot(): unknown[];
export function getAllKiitosrukoukset(): unknown[];
export function getAllKertosaakeet(): unknown[];
export function getAllKiitosrukouksetEhtoollinen(): unknown[];
export function getImproperia(): string;

export function getIndexMeta(): { title: string; description: string; note: string; entryCount: number; holyDayCount: number };
export function getByHolyDay(holyDayName: string): Record<string, unknown[]>;
export function searchByReference(query: string): unknown[];
export function getHolyDayNames(): string[];
export function getAllEntries(): unknown[];

export const COLORS: string[];
export function parseLiturgicalColor(text: string | null | undefined): unknown;
export function colorForDay(text: string | null | undefined, options?: { weekday?: boolean }): LiturgicalColor | null;
export function liturgicalRules(date: Date, calendar: unknown[], day: unknown): Liturgy;
export function searchReadings(query: string): ReadingSearchResult[];
export function dailyLectionary(slug: string, weekday: number): DailyLectionary | null;
export function altarCandles(slug: string): string | null;
export function weeklyLectionaryMeta(): { source: string; fetched: string };
export function todayInFinland(now?: Date): string;
