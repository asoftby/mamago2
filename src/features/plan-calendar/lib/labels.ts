import {
  dayOfMonth,
  monthName,
  monthOf,
  monthShort,
  weekdayFull,
  monthGenitive,
  yearOf,
  pluralRu,
  type DateKey,
} from "@/lib/date/dateKey";

/** «ОКТЯБРЬ 2026», на стыке месяцев «ОКТ — НОЯ 2026» (на стыке годов с годом у каждого). */
export function weekHeaderLabel(days: readonly DateKey[]): string {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  if (monthOf(first) === monthOf(last) && yearOf(first) === yearOf(last)) {
    return `${monthName(first).toUpperCase()} ${yearOf(first)}`;
  }
  if (yearOf(first) === yearOf(last)) {
    return `${monthShort(first)} — ${monthShort(last)} ${yearOf(last)}`;
  }
  return `${monthShort(first)} ${yearOf(first)} — ${monthShort(last)} ${yearOf(last)}`;
}

/** «ОКТЯБРЬ 2026» for a single day (mobile header, month grid). */
export function monthYearLabel(key: DateKey): string {
  return `${monthName(key).toUpperCase()} ${yearOf(key)}`;
}

/** «Четверг, 8 октября, сегодня, записей: 2» */
export function dayAriaLabel(key: DateKey, opts: { today: boolean; count: number }): string {
  const parts = [`${weekdayFull(key)}, ${dayOfMonth(key)} ${monthGenitive(key)}`];
  if (opts.today) parts.push("сегодня");
  parts.push(`записей: ${opts.count}`);
  return parts.join(", ");
}

export function recordsCountLabel(n: number): string {
  return `${n} ${pluralRu(n, ["запись", "записи", "записей"])}`;
}
