export type RecurrenceRule = {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  startDate: string;
  weekdays?: number[];
  untilDate?: string | null;
  maxOccurrences?: number | null;
};

function parseDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("invalid_date");
  const date = new Date(value + "T00:00:00.000Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("invalid_date");
  return date;
}

/** Pure, capped expansion; materialization and permissions belong to the existing plan service. */
export function expandRecurrence(rule: RecurrenceRule, from: string, to: string): string[] {
  const start = parseDay(rule.startDate);
  const lo = parseDay(from).getTime();
  const hi = parseDay(to).getTime();
  if (hi < lo || hi - lo > 366 * 86400000) throw new Error("invalid_window");
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 365) throw new Error("invalid_interval");
  const until = rule.untilDate ? parseDay(rule.untilDate).getTime() : Infinity;
  const cap = rule.maxOccurrences ?? Infinity;
  if (cap !== Infinity && (!Number.isInteger(cap) || cap < 1 || cap > 10000)) throw new Error("invalid_count");
  const weekdays = rule.weekdays ?? [];
  if (rule.frequency === "WEEKLY" && (!weekdays.length || weekdays.some(x => !Number.isInteger(x) || x < 1 || x > 7))) throw new Error("invalid_weekdays");
  if (rule.frequency !== "DAILY" && rule.frequency !== "WEEKLY" && rule.frequency !== "MONTHLY") throw new Error("invalid_frequency");
  const out: string[] = [];
  let ordinal = 0;
  const startDay = start.getTime();
  const end = Math.min(hi, until);
  // Scan from series start so occurrence-count semantics remain stable across windows.
  if (end - startDay > 3660 * 86400000) throw new Error("series_too_long");
  for (let ms = startDay; ms <= end; ms += 86400000) {
    const days = Math.round((ms - startDay) / 86400000);
    const d = new Date(ms);
    let matches = false;
    if (rule.frequency === "DAILY") matches = days % rule.interval === 0;
    if (rule.frequency === "WEEKLY") {
      const week = Math.floor((days + ((start.getUTCDay() + 6) % 7)) / 7);
      matches = week % rule.interval === 0 && weekdays.includes(((d.getUTCDay() + 6) % 7) + 1);
    }
    if (rule.frequency === "MONTHLY") {
      const months = (d.getUTCFullYear() - start.getUTCFullYear()) * 12 + d.getUTCMonth() - start.getUTCMonth();
      matches = months >= 0 && months % rule.interval === 0 && d.getUTCDate() === start.getUTCDate();
    }
    if (!matches) continue;
    ordinal++;
    if (ordinal > cap) break;
    if (ms >= lo) {
      if (out.length >= 366) throw new Error("too_many_occurrences");
      out.push(d.toISOString().slice(0, 10));
    }
  }
  return out;
}
