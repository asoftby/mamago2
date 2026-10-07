import { addDays, diffDays, type DateKey } from "@/lib/date/dateKey";

/** /api/plan/day-markers rejects ranges longer than this (FAMILY_CALENDAR_MAX_RANGE_DAYS). */
export const MAX_REQUEST_DAYS = 42;

// Fixed 35-day, Monday-aligned chunks: any visible window maps onto whole chunks, so a
// request is never larger than MAX_REQUEST_DAYS and chunks are cached/reused across windows.
export const CHUNK_DAYS = 35;
const EPOCH: DateKey = "2020-01-06";

export function chunkStart(key: DateKey): DateKey {
  return addDays(EPOCH, Math.floor(diffDays(EPOCH, key) / CHUNK_DAYS) * CHUNK_DAYS);
}

export function chunkEnd(start: DateKey): DateKey {
  return addDays(start, CHUNK_DAYS - 1);
}

/** Chunk starts covering [from, to]. */
export function chunkStartsFor(from: DateKey, to: DateKey): DateKey[] {
  const starts: DateKey[] = [];
  for (let s = chunkStart(from); s <= to; s = addDays(s, CHUNK_DAYS)) starts.push(s);
  return starts;
}
