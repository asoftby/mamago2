import type { AnalyticsOverviewDateRange } from "@/lib/analytics/adminOverviewTypes";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { addDateKeyDays, startOfZonedDay, zonedDateKey } from "@/lib/stories/ranges";
import { ANALYTICS_TIME_ZONE } from "@/server/services/analytics/metricDefinitions";

const RANGE_DAYS: Record<AnalyticsOverviewDateRange, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

/**
 * Окно отчётов `/admin/analytics` в минских сутках (B2): с 00:00 по Минску
 * дня `today - (N-1)` до `now`. Раньше границы считались `date-fns`
 * `startOfDay` в TZ контейнера (UTC), и событие в 01:30 по Минску попадало во
 * «вчера». Та же логика, что `resolvePerformanceWindow` для `/admin`.
 */
export function resolveAnalyticsDateRange(
  dateRange: AnalyticsOverviewDateRange,
  now: Date = new Date(),
  timeZone: string = ANALYTICS_TIME_ZONE,
): { start: Date; end: Date } {
  const days = RANGE_DAYS[dateRange] ?? RANGE_DAYS["30d"];
  const todayKey = zonedDateKey(now, timeZone);
  const start = startOfZonedDay(addDateKeyDays(todayKey, -(days - 1)), timeZone);
  return { start, end: now };
}

/** Минские календарные дни (YYYY-MM-DD) окна, по возрастанию, не больше `maxDays` последних. */
export function analyticsDayKeys(
  start: Date,
  end: Date,
  maxDays = 90,
  timeZone: string = ANALYTICS_TIME_ZONE,
): string[] {
  const keys: string[] = [];
  const last = zonedDateKey(end, timeZone);
  for (let key = zonedDateKey(start, timeZone); key <= last; key = addDateKeyDays(key, 1)) keys.push(key);
  return keys.slice(-maxDays);
}

export async function resolveCityIdFromSlug(slug: string): Promise<string | null> {
  if (!slug.trim()) return null;
  const row = await findCityBySlug(slug.trim(), { select: { id: true } });
  return row?.id ?? null;
}
