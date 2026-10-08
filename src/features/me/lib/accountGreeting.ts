export function getGreetingForHour(hour: number): string {
  if (!Number.isFinite(hour)) return "Добрый день";
  const normalizedHour = ((Math.trunc(hour) % 24) + 24) % 24;
  if (normalizedHour < 6) return "Доброй ночи";
  if (normalizedHour < 12) return "Доброе утро";
  if (normalizedHour < 18) return "Добрый день";
  return "Добрый вечер";
}

export function getHourInTimeZone(
  date: Date,
  timeZone: string,
): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return Number.isFinite(hour) ? hour : date.getHours();
}
