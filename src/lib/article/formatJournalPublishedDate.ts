/** Display year only when the publication belongs to a previous calendar year. */
export function formatJournalPublishedDate(value: Date | string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Minsk",
  }).format(date);
  const publishedYear = Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Europe/Minsk" }).format(date));
  const currentYear = Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Europe/Minsk" }).format(now));
  return publishedYear < currentYear ? `${parts} ’${String(publishedYear).slice(-2)}` : parts;
}
