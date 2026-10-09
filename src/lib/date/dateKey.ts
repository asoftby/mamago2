import { getLocalDateKey } from "./localDateKey";

/**
 * Civil-day arithmetic on `YYYY-MM-DD` keys. A day is a string, never a
 * `Date`: all math runs in UTC on a calendar date, so it does not depend on
 * the process timezone. "Today" is derived from `getLocalDateKey` (Europe/Minsk).
 */
export type DateKey = string;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

const WEEKDAYS_SHORT = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"] as const;
const WEEKDAYS_FULL = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
] as const;
const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
] as const;
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
] as const;
const MONTHS_SHORT = [
  "ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН",
  "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК",
] as const;

function toUtcMs(key: DateKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

function fromUtcMs(ms: number): DateKey {
  const dt = new Date(ms);
  const y = String(dt.getUTCFullYear()).padStart(4, "0");
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) return false;
  return fromUtcMs(toUtcMs(value)) === value;
}

export function todayKey(tz?: string, now: Date = new Date()): DateKey {
  return getLocalDateKey(now, tz);
}

export function addDays(key: DateKey, n: number): DateKey {
  return fromUtcMs(toUtcMs(key) + n * MS_PER_DAY);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: DateKey): number {
  return (new Date(toUtcMs(key)).getUTCDay() + 6) % 7;
}

export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -weekdayIndex(key));
}

export function weekDays(key: DateKey): DateKey[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthOf(key: DateKey): number {
  return Number(key.slice(5, 7));
}

export function yearOf(key: DateKey): number {
  return Number(key.slice(0, 4));
}

export function dayOfMonth(key: DateKey): number {
  return Number(key.slice(8, 10));
}

export function startOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 8)}01`;
}

export function addMonths(key: DateKey, n: number): DateKey {
  const idx = yearOf(key) * 12 + (monthOf(key) - 1) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  const first = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
  const lastDay = daysInMonth(first);
  return addDays(first, Math.min(dayOfMonth(key), lastDay) - 1);
}

function daysInMonth(key: DateKey): number {
  return diffDays(startOfMonth(key), startOfMonth(addDays(startOfMonth(key), 32)));
}

/** Monday-first matrix covering the month: 5 or 6 weeks of 7 keys. */
export function monthMatrix(key: DateKey): DateKey[][] {
  const first = startOfMonth(key);
  const start = startOfWeek(first);
  const weeks = Math.max(5, Math.ceil((weekdayIndex(first) + daysInMonth(first)) / 7));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
  );
}

export function isToday(key: DateKey, today: DateKey = todayKey()): boolean {
  return key === today;
}

export function isPast(key: DateKey, today: DateKey = todayKey()): boolean {
  return key < today;
}

export function weekdayShort(key: DateKey): string {
  return WEEKDAYS_SHORT[(weekdayIndex(key) + 1) % 7]!;
}

export function weekdayFull(key: DateKey): string {
  return WEEKDAYS_FULL[(weekdayIndex(key) + 1) % 7]!;
}

/** «Октябрь» */
export function monthName(key: DateKey): string {
  return MONTHS_NOM[monthOf(key) - 1]!;
}

/** «октября» */
export function monthGenitive(key: DateKey): string {
  return MONTHS_GEN[monthOf(key) - 1]!;
}

/** «ОКТ» */
export function monthShort(key: DateKey): string {
  return MONTHS_SHORT[monthOf(key) - 1]!;
}

/** «8 октября» */
export function dayMonthLabel(key: DateKey): string {
  return `${dayOfMonth(key)} ${monthGenitive(key)}`;
}

/** «Сегодня / Завтра / Вчера / Четверг, 8 октября» */
export function relativeLabel(key: DateKey, today: DateKey = todayKey()): string {
  const diff = diffDays(today, key);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff === -1) return "Вчера";
  return `${weekdayFull(key)}, ${dayMonthLabel(key)}`;
}

export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
