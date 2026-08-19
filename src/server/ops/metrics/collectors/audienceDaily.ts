/**
 * audience.dau — every 15 min (§21 Step 5, Phase C).
 *
 * Reuses the canonical mamaGo "active user" definition verbatim — the
 * same `COUNT(DISTINCT "userId")` over `UserEvent`, same
 * `resolvePerformanceWindow()` window resolution (Europe/Minsk calendar
 * days) already used by /admin/performance
 * (src/server/services/performance/performanceDashboard.service.ts).
 *
 * Identity key: authenticated `UserEvent.userId` only — anonymous
 * `sessionId` activity is a separate concept (`trackedVisitors` in the
 * canonical dashboard), never merged in here. No bot/admin/business
 * exclusion — the canonical definition doesn't apply one, and Step 5 must
 * not silently change it.
 */
import { Prisma } from "@prisma/client";

import { resolvePerformanceWindow } from "@/lib/performance/performanceMetrics";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

interface DauRow {
  dau: bigint;
}

export async function collectAudienceDau(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const window = resolvePerformanceWindow("today", ctx.now);

  const rows = await ctx.prisma.$queryRaw<DauRow[]>(Prisma.sql`
    SELECT COUNT(DISTINCT "userId")::bigint AS dau
    FROM "UserEvent"
    WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end}
  `);

  return [{ metric: "audience.dau", value: Number(rows[0].dau) }];
}

export const audienceDauCollector: MetricCollector = {
  name: "audience_dau",
  intervalSec: 900,
  timeoutMs: 15_000,
  collect: collectAudienceDau,
};
