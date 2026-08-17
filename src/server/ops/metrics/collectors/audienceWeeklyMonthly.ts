/**
 * audience.wau / audience.mau — every 60 min (§21 Step 5, Phase C).
 * Same canonical definition as audienceDaily.ts, just the 7-day/30-day
 * windows instead of the 1-day window — kept as a separate collector
 * because the frozen §8 interval for WAU/MAU (3600s) differs from DAU's
 * (900s); a MetricCollector has exactly one interval.
 */
import { Prisma } from "@prisma/client";

import { resolvePerformanceWindow } from "@/lib/performance/performanceMetrics";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

interface WauMauRow {
  wau: bigint;
  mau: bigint;
}

export async function collectAudienceWeeklyMonthly(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const weekWindow = resolvePerformanceWindow("7d", ctx.now);
  const monthWindow = resolvePerformanceWindow("30d", ctx.now);

  const rows = await ctx.prisma.$queryRaw<WauMauRow[]>(Prisma.sql`
    SELECT
      COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= ${weekWindow.start} AND "createdAt" < ${weekWindow.end})::bigint AS wau,
      COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= ${monthWindow.start} AND "createdAt" < ${monthWindow.end})::bigint AS mau
    FROM "UserEvent"
    WHERE "createdAt" >= ${monthWindow.start} AND "createdAt" < ${monthWindow.end}
  `);

  return [
    { metric: "audience.wau", value: Number(rows[0].wau) },
    { metric: "audience.mau", value: Number(rows[0].mau) },
  ];
}

export const audienceWeeklyMonthlyCollector: MetricCollector = {
  name: "audience_wau_mau",
  intervalSec: 3_600,
  timeoutMs: 20_000,
  collect: collectAudienceWeeklyMonthly,
};
