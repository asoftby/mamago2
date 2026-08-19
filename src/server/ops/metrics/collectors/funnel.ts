/**
 * funnel.content_opens / funnel.saves / funnel.plan_adds /
 * funnel.cta_clicks — every 15 min (§21 Step 5, Phase E).
 *
 * Reuses the exact `UserEvent.eventType` mapping already codified by three
 * independent existing analytics services (analyticsFunnels.service.ts,
 * businessWorkspace.service.ts, performanceDashboard.service.ts):
 *
 *   content_opens -> DETAIL_OPEN
 *   saves         -> SAVE
 *   plan_adds     -> PLAN_ADD
 *   cta_clicks    -> CTA_CLICK
 *
 * Counts are for this collector's own rolling window (trailing 15
 * minutes), not an all-time cumulative counter, per Phase E. No
 * business/admin/internal exclusion — none exists in the canonical
 * UserEvent writers either (see audit), so none is invented here.
 */
import type { UserEventType } from "@prisma/client";

import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

const FUNNEL_WINDOW_SEC = 900;

const FUNNEL_EVENT_METRIC: ReadonlyArray<{ eventType: UserEventType; metric: string }> = [
  { eventType: "DETAIL_OPEN", metric: "funnel.content_opens" },
  { eventType: "SAVE", metric: "funnel.saves" },
  { eventType: "PLAN_ADD", metric: "funnel.plan_adds" },
  { eventType: "CTA_CLICK", metric: "funnel.cta_clicks" },
];

export async function collectFunnelMetrics(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const windowStart = new Date(ctx.now.getTime() - FUNNEL_WINDOW_SEC * 1000);

  const counts = await Promise.all(
    FUNNEL_EVENT_METRIC.map(({ eventType }) =>
      ctx.prisma.userEvent.count({
        where: { eventType, createdAt: { gte: windowStart, lt: ctx.now } },
      }),
    ),
  );

  return FUNNEL_EVENT_METRIC.map(({ metric }, i) => ({ metric, value: counts[i] }));
}

export const funnelMetricsCollector: MetricCollector = {
  name: "funnel_metrics",
  intervalSec: FUNNEL_WINDOW_SEC,
  timeoutMs: 15_000,
  collect: collectFunnelMetrics,
};
