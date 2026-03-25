/**
 * Deterministic Russian date/time formatting for event page (SSR-safe).
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

/** e.g. пн, 4 мар. · 18:30 */
export function formatRuSessionSlot(iso: string): string {
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    if (isNaN(d.getTime())) return "";
    const wd = RU_WEEKDAY_SHORT[d.getDay()];
    const day = d.getDate();
    const month = RU_MONTH_SHORT[d.getMonth()];
    return `${wd}, ${day} ${month} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  } catch {
    return "";
  }
}

/** Longer line for hero: пн, 4 марта 2026 · 18:30 */
export function formatRuSessionHero(iso: string): string {
  try {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    if (isNaN(d.getTime())) return "";
    const wd = RU_WEEKDAY_SHORT[d.getDay()];
    const day = d.getDate();
    const month = RU_MONTH_SHORT[d.getMonth()];
    const year = d.getFullYear();
    return `${wd}, ${day} ${month} ${year} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  } catch {
    return "";
  }
}
