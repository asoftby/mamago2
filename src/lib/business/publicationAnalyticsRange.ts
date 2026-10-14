/** Civil-day analytics windows in Belarus time (UTC+03, no DST). */
export type BusinessStatsPeriod = "today" | "yesterday" | "week" | "month" | "custom";
const MINSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export function minskDateKey(at: Date): string {
  return new Date(at.getTime() + MINSK_OFFSET_MS).toISOString().slice(0, 10);
}
export function parseMinskDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m! - 1 || utc.getUTCDate() !== d) return null;
  return new Date(utc.getTime() - MINSK_OFFSET_MS);
}
export function businessPublicationDayRange(
  period: Exclude<BusinessStatsPeriod, "custom">,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const today = parseMinskDay(minskDateKey(now))!;
  const day = period === "yesterday" ? -1 : period === "week" ? -6 : period === "month" ? -29 : 0;
  const start = new Date(today.getTime() + day * DAY_MS);
  const end = period === "yesterday"
    ? new Date(today.getTime() - 1)
    : now;
  return { start, end };
}
/** A manually selected inclusive date range, bounded by publication creation and now. */
export function businessPublicationCustomRange(args: {
  from: string;
  to: string;
  publishedAt: Date;
  now?: Date;
}): { start: Date; end: Date } | null {
  const now = args.now ?? new Date();
  const startDay = parseMinskDay(args.from);
  const endDay = parseMinskDay(args.to);
  if (!startDay || !endDay || startDay > endDay || startDay > now) return null;
  const firstAllowed = args.publishedAt;
  const start = new Date(Math.max(startDay.getTime(), firstAllowed.getTime()));
  const end = new Date(Math.min(endDay.getTime() + DAY_MS - 1, now.getTime()));
  if (start > end) return null;
  return { start, end };
}
