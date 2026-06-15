import { DEFAULT_TZ } from "@/server/geo/geoConstants";

export function getLocalDateKey(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TZ,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseLocalDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDaysLocal(input: string | Date, days: number): string {
  const base = typeof input === "string" ? parseLocalDateKey(input) : new Date(input);
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + days);
  return getLocalDateKey(next);
}

export function formatLocalPlanDate(
  dateKey: string,
  locale: string = "ru-BY",
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(parseLocalDateKey(dateKey));
}
