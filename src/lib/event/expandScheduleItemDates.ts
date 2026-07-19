import { addDaysLocal } from "@/lib/date/localDateKey";

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ScheduleItemLike = {
  date?: unknown;
  dateEnd?: unknown;
};

export function isLocalDateString(value: unknown): value is string {
  return typeof value === "string" && LOCAL_DATE_RE.test(value);
}

function compareLocalDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function expandScheduleItemDates(items: ScheduleItemLike[]): string[] {
  const expanded: string[] = [];

  for (const item of items) {
    if (!isLocalDateString(item.date)) continue;

    const start = item.date;
    const end = isLocalDateString(item.dateEnd) ? item.dateEnd : start;
    const from = compareLocalDateKeys(start, end) <= 0 ? start : end;
    const to = compareLocalDateKeys(start, end) <= 0 ? end : start;

    let cursor = from;
    while (compareLocalDateKeys(cursor, to) <= 0) {
      expanded.push(cursor);
      cursor = addDaysLocal(cursor, 1);
    }
  }

  return [...new Set(expanded)].sort(compareLocalDateKeys);
}
