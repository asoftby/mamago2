function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function getLocalDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
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
