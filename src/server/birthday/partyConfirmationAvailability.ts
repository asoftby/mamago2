import { PartyApiError } from "./partyDraft.validation";

/** Party booking units currently use Europe/Minsk; never guess an alternate timezone. */
export function minskBookingWindow(
  date: Date,
  timeFrom: string,
  timeTo: string,
  prepMinutes: number,
  cleanupMinutes: number,
) {
  const yyyyMmDd = date.toISOString().slice(0, 10);
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const fromMatch = timePattern.exec(timeFrom);
  const toMatch = timePattern.exec(timeTo);
  if (!fromMatch || !toMatch || timeTo <= timeFrom ||
      prepMinutes < 0 || cleanupMinutes < 0) {
    throw new PartyApiError(422, "Некорректный интервал праздника");
  }
  const serviceStart = new Date(`${yyyyMmDd}T${timeFrom}:00+03:00`);
  const serviceEnd = new Date(`${yyyyMmDd}T${timeTo}:00+03:00`);
  const blockStart = new Date(serviceStart.getTime() - prepMinutes * 60_000);
  const blockEnd = new Date(serviceEnd.getTime() + cleanupMinutes * 60_000);
  const startMinutes = Number(fromMatch[1]) * 60 + Number(fromMatch[2]);
  const endMinutes = Number(toMatch[1]) * 60 + Number(toMatch[2]);
  const day = date.getUTCDay();
  return {
    serviceStart, serviceEnd, blockStart, blockEnd,
    startMinutes, endMinutes, weekday: day === 0 ? 7 : day,
  };
}

export function isWithinSchedule(
  window: { startMinutes: number; endMinutes: number; weekday: number },
  rules: Array<{ weekday: number; startMinutes: number; endMinutes: number }>,
  exceptions: Array<{ kind: "CLOSED" | "OPEN_OVERRIDE"; startMinutes: number | null; endMinutes: number | null }>,
) {
  const contains = (from: number | null, to: number | null) =>
    (from ?? 0) <= window.startMinutes && (to ?? 1440) >= window.endMinutes;
  const overlaps = (from: number | null, to: number | null) =>
    (from ?? 0) < window.endMinutes && (to ?? 1440) > window.startMinutes;
  if (exceptions.some((e) => e.kind === "CLOSED" && overlaps(e.startMinutes, e.endMinutes))) return false;
  const overrides = exceptions.filter((e) => e.kind === "OPEN_OVERRIDE");
  if (overrides.length) return overrides.some((e) => contains(e.startMinutes, e.endMinutes));
  return rules.some((r) => r.weekday === window.weekday &&
    contains(r.startMinutes, r.endMinutes));
}
