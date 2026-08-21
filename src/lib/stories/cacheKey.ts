import { startOfZonedDay, addDateKeyDays, zonedDateKey } from "./ranges";
import type { OngoingTemporalPolicy } from "./ongoingPolicy";

/**
 * Cache key includes the civil date in city TZ so the entry dies at midnight
 * when the key changes — not after a timer from process start.
 */
export function storyRailCountsCacheKey(input: {
  cityId: string;
  dateKey: string;
  ongoingPolicy: OngoingTemporalPolicy;
}): string {
  return `stories:rail:counts:v2:${input.cityId}:${input.dateKey}:${input.ongoingPolicy}`;
}

export function storyRailSlotContentCacheKey(input: {
  cityId: string;
  slotId: string;
  dateKey: string;
  ongoingPolicy: OngoingTemporalPolicy;
}): string {
  return `stories:rail:slot:v2:${input.cityId}:${input.slotId}:${input.dateKey}:${input.ongoingPolicy}`;
}

export function storyRailCityCacheTag(cityId: string): string {
  return `stories:canonical:${cityId}`;
}

/** Seconds until next local midnight in `timeZone` (min 60). */
export function secondsUntilNextZonedMidnight(now: Date, timeZone: string): number {
  const todayKey = zonedDateKey(now, timeZone);
  const nextMidnight = startOfZonedDay(addDateKeyDays(todayKey, 1), timeZone);
  const ms = nextMidnight.getTime() - now.getTime();
  return Math.max(60, Math.ceil(ms / 1000));
}
