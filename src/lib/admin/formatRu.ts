/**
 * Форматирование дат и чисел в админке (ТЗ «Аналитика админки», блок E):
 * русская локаль и часовой пояс Europe/Minsk независимо от ОС сервера и браузера.
 *
 *   дата          27 окт. 2026
 *   дата и время  27.10.2026, 08:46
 *   число         12 345 (неразрывные пробелы ru-RU)
 *
 * Календарные компоненты читаются через getZonedDateTimeParts, а не через
 * Date#getDate() и не через toLocale*String() без пояса, поэтому SSR и клиент
 * дают одну и ту же строку.
 */
import { getZonedDateTimeParts } from "@/lib/formatters/date";

const MONTHS_SHORT = ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."];

const EM_DASH = "—";

type DateInput = Date | string | number | null | undefined;

function parts(value: DateInput) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return getZonedDateTimeParts(d);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** «27 окт. 2026»; пусто или невалидно — «—». */
export function formatAdminDate(value: DateInput): string {
  const p = parts(value);
  return p ? `${p.day} ${MONTHS_SHORT[p.month - 1]} ${p.year}` : EM_DASH;
}

/** «27.10.2026, 08:46»; пусто или невалидно — «—». */
export function formatAdminDateTime(value: DateInput): string {
  const p = parts(value);
  return p ? `${pad2(p.day)}.${pad2(p.month)}.${p.year}, ${pad2(p.hour)}:${pad2(p.minute)}` : EM_DASH;
}

/** «08:46». */
export function formatAdminTime(value: DateInput): string {
  const p = parts(value);
  return p ? `${pad2(p.hour)}:${pad2(p.minute)}` : EM_DASH;
}

/** «1 окт. 2026 — 27 окт. 2026». */
export function formatAdminDateRange(start: DateInput, end: DateInput): string {
  return `${formatAdminDate(start)} — ${formatAdminDate(end)}`;
}

/** Целое/дробное число по правилам ru-RU; null и NaN — «—». */
export function formatAdminNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (value == null || !Number.isFinite(value)) return EM_DASH;
  return value.toLocaleString("ru-RU", { maximumFractionDigits });
}

/** Доля 0..1 как «12,3%»; null — «—». */
export function formatAdminPercent(share: number | null | undefined, fractionDigits = 1): string {
  if (share == null || !Number.isFinite(share)) return EM_DASH;
  return `${(share * 100).toLocaleString("ru-RU", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}
