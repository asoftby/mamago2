import { getZonedDateTimeParts } from "@/lib/formatters/date";

/**
 * Deterministic Russian date/time formatting for event page (SSR-safe).
 * Event wall-clock values are always rendered in the product/venue timezone,
 * not in the browser or server ambient timezone.
 */

const RU_MONTH_SHORT = [
  "янв.",
  "фев.",
  "мар.",
  "апр.",
  "мая",
  "июн.",
  "июл.",
  "авг.",
  "сен.",
  "окт.",
  "ноя.",
  "дек.",
] as const;

const RU_WEEKDAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function weekdayIndex(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** e.g. пн, 4 мар. · 18:30 */
export function formatRuSessionSlot(iso: string): string {
  try {
    const p = getZonedDateTimeParts(iso);
    if (!p) return "";
    const wd = RU_WEEKDAY_SHORT[weekdayIndex(p.year, p.month, p.day)];
    const month = RU_MONTH_SHORT[p.month - 1];
    return `${wd}, ${p.day} ${month} · ${pad2(p.hour)}:${pad2(p.minute)}`;
  } catch {
    return "";
  }
}

/** Longer line for hero: пн, 4 мар. 2026 · 18:30 */
export function formatRuSessionHero(iso: string): string {
  try {
    const p = getZonedDateTimeParts(iso);
    if (!p) return "";
    const wd = RU_WEEKDAY_SHORT[weekdayIndex(p.year, p.month, p.day)];
    const month = RU_MONTH_SHORT[p.month - 1];
    return `${wd}, ${p.day} ${month} ${p.year} · ${pad2(p.hour)}:${pad2(p.minute)}`;
  } catch {
    return "";
  }
}
