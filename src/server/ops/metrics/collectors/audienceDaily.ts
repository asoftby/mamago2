/**
 * audience.dau — every 15 min (§21 Step 5, Phase C; redefined by the
 * canonical audience contract).
 *
 * Uses the canonical mamaGo audience identity
 * (`@/server/services/analytics/canonicalAudience`) — PAGE_VIEW-only,
 * authenticated userId (excluding ADMIN/MODERATOR) plus anonymous-only
 * sessionId — over the same `resolvePerformanceWindow()` "today" window
 * (Europe/Minsk) the Traffic block's `uniqueVisitorsToday` uses, so the
 * two agree for the same instant. This is the SAME identity
 * /admin/performance's `dau`/`trackedVisitors` and the WAU/MAU collector
 * use — one shared definition, not reimplemented per consumer.
 */
import { resolvePerformanceWindow } from "@/lib/performance/performanceMetrics";
import { computeCanonicalAudience } from "@/server/services/analytics/canonicalAudience";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

export async function collectAudienceDau(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const window = resolvePerformanceWindow("today", ctx.now);
  const audience = await computeCanonicalAudience(ctx.prisma, window.start, window.end);
  return [{ metric: "audience.dau", value: audience.visitors }];
}

export const audienceDauCollector: MetricCollector = {
  name: "audience_dau",
  intervalSec: 900,
  timeoutMs: 15_000,
  collect: collectAudienceDau,
};
