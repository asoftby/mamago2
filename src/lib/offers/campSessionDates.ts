/**
 * Combines a YYYY-MM-DD date with an optional HH:MM time into a local Date.
 * Falls back to defaultTime when time is missing (e.g. residential camp shifts with no fixed hour).
 */
export function combineDateTime(
  date: string,
  time: string | null | undefined,
  defaultTime: string,
): Date {
  const t = time && time.trim() ? time.trim() : defaultTime;
  return new Date(`${date}T${t}:00`);
}
