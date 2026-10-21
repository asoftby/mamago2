/** Working response hours for party providers: 09:00–21:00 Europe/Minsk (UTC+3). */
const HOUR = 3_600_000;
const MINUTE = 60_000;
const MINSK_OFFSET = 3 * HOUR;
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

export function partyResponseDeadline(now: Date, eventStart: Date): Date {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(eventStart.getTime()) || eventStart <= now) {
    throw new RangeError("Invalid party response window");
  }
  const urgent = eventStart.getTime() - now.getTime() < 72 * HOUR;
  let remaining = (urgent ? 1 : 2) * HOUR;
  let cursor = now.getTime();
  while (remaining > 0) {
    const minsk = cursor + MINSK_OFFSET;
    const dayStart = Math.floor(minsk / (24 * HOUR)) * 24 * HOUR - MINSK_OFFSET;
    const open = dayStart + OPEN_HOUR * HOUR;
    const close = dayStart + CLOSE_HOUR * HOUR;
    if (cursor < open) cursor = open;
    if (cursor >= close) { cursor = open + 24 * HOUR; continue; }
    const available = close - cursor;
    const portion = Math.min(remaining, available);
    cursor += portion;
    remaining -= portion;
  }
  // Confirmation must conclude before the party, even for urgent requests.
  const latest = eventStart.getTime() - HOUR;
  if (latest <= now.getTime()) throw new RangeError("Party starts before the response window");
  return new Date(Math.min(cursor, latest));
}
