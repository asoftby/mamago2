/** Only accept unambiguous ISO timestamps with an explicit UTC offset. */
export function parseExplicitReminderInstant(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)) {
    throw new Error("invalid_reminder_at");
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("invalid_reminder_at");
  return parsed;
}
