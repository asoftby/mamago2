import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { getZonedDateTimeParts } from "@/lib/formatters/date";
import { normalizePublicationPrice, type PublicationPriceMode } from "@/domain/pricing/normalizedPrice";

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
const DAY_CODES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

function dayParts(value: Date | string | null | undefined) {
  if (value == null) return null;
  // Dates from scheduleJson are local calendar days, not UTC instants.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const check = new Date(Date.UTC(y!, m! - 1, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m! - 1 || check.getUTCDate() !== d) return null;
    return { year: y!, month: m!, day: d! };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return getZonedDateTimeParts(date);
}

/** «4 сен», «4–12 сен», «4 сен – 12 окт» in the event's Minsk calendar. */
export function formatSearchDateRange(
  start: Date | string | null | undefined,
  end?: Date | string | null,
): string | null {
  const from = dayParts(start);
  if (!from) return null;
  const to = dayParts(end);
  const month = MONTHS[from.month - 1]!;
  if (!to || (from.year === to.year && from.month === to.month && from.day === to.day)) {
    return `${from.day} ${month}`;
  }
  const endMonth = MONTHS[to.month - 1]!;
  return from.year === to.year && from.month === to.month
    ? `${from.day}–${to.day} ${month}`
    : `${from.day} ${month} – ${to.day} ${endMonth}`;
}

/** Prefer the explicit publication period; don't turn a year of repeating sessions into a fictitious festival. */
export function formatActivitySearchDates(args: {
  scheduleJson?: unknown;
  sessions?: Array<{ startsAt: Date }>;
  nextOccurrenceAt?: Date | null;
}): string | null {
  const schedule = args.scheduleJson && typeof args.scheduleJson === "object" && !Array.isArray(args.scheduleJson)
    ? args.scheduleJson as Record<string, unknown>
    : null;
  if (schedule) {
    const start = schedule.dateFrom ?? schedule.startDate ?? schedule.date;
    const end = schedule.dateTo ?? schedule.endDate;
    if (typeof start === "string" || start instanceof Date) {
      const label = formatSearchDateRange(start, typeof end === "string" || end instanceof Date ? end : null);
      if (label) return label;
    }
  }
  const starts = (args.sessions ?? []).map((s) => s.startsAt)
    .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (starts.length) {
    const first = starts[0]!;
    const last = starts[starts.length - 1]!;
    // A bounded series can be described as an event period; long-running schedules show the next date only.
    return formatSearchDateRange(first, last.getTime() - first.getTime() <= 14 * 86400000 ? last : null);
  }
  return formatSearchDateRange(args.nextOccurrenceAt);
}

function compactMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

export function formatSearchPublicationPrice(input: {
  priceMode?: PublicationPriceMode | null;
  priceFrom?: number | null;
  priceTo?: number | null;
  priceItems?: unknown;
  priceText?: string | null;
}): string | null {
  const normalized = normalizePublicationPrice({
    mode: input.priceMode,
    min: input.priceFrom,
    max: input.priceTo,
    priceItems: input.priceItems,
    priceText: input.priceText,
  });
  const { mode, min, max } = normalized;
  if (mode === "FREE") return "Бесплатно";
  if (mode === "ON_REQUEST") return "По запросу";
  if (min == null || !Number.isFinite(min)) return null;
  if (mode === "EXACT") return `${compactMoney(min)} ${BYN_SYMBOL}`;
  if (mode === "FROM") return `от ${compactMoney(min)} ${BYN_SYMBOL}`;
  if (mode === "RANGE") {
    if (max == null || !Number.isFinite(max)) return `от ${compactMoney(min)} ${BYN_SYMBOL}`;
    return min === max
      ? `${compactMoney(min)} ${BYN_SYMBOL}`
      : `${compactMoney(min)}–${compactMoney(max)} ${BYN_SYMBOL}`;
  }
  return null;
}

type SearchOpeningHoursRule = {
  dayOfWeek: string;
  isOpen: boolean;
  allDay: boolean;
  intervals: Array<{ startTime: string; endTime: string }>;
};

/** Short, accurate weekly opening-hours summary. Missing days are not invented. */
export function formatSearchOpeningHours(rules: SearchOpeningHoursRule[]): string | null {
  const open = rules.filter((r) => r.isOpen);
  if (open.length === 0) return null;
  const descriptions = new Map<string, string[]>();
  for (const rule of open) {
    const index = DAY_CODES.indexOf(rule.dayOfWeek as typeof DAY_CODES[number]);
    if (index < 0) continue;
    const hours = rule.allDay
      ? "круглосуточно"
      : rule.intervals.map((t) => `${t.startTime}–${t.endTime}`).join(", ");
    if (!hours) continue;
    descriptions.set(hours, [...(descriptions.get(hours) ?? []), rule.dayOfWeek]);
  }
  if (descriptions.size === 0) return null;
  if (descriptions.size === 1 && open.length === 7 && open.every((r) => DAY_CODES.includes(r.dayOfWeek as typeof DAY_CODES[number]))) {
    const hours = [...descriptions.keys()][0]!;
    return hours === "круглосуточно" ? "Круглосуточно" : `Ежедневно ${hours}`;
  }
  return [...descriptions].map(([hours, days]) => {
    const indexes = days.map((d) => DAY_CODES.indexOf(d as typeof DAY_CODES[number]))
      .filter((i) => i >= 0).sort((a, b) => a - b);
    const consecutive = indexes.every((n, i) => i === 0 || n === indexes[i - 1]! + 1);
    const dayLabel = indexes.length > 2 && consecutive
      ? `${DAYS[indexes[0]!]}–${DAYS[indexes[indexes.length - 1]!]}`
      : indexes.map((i) => DAYS[i]).join(", ");
    return `${dayLabel} ${hours}`;
  }).join("; ");
}
