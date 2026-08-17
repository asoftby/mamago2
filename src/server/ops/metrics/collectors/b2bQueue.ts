/**
 * queue.b2b.pending_size — every 5 min (§21 Step 5, Phase I).
 *
 * `BusinessAccessRequest.status = 'PENDING'` — the exact status the
 * existing admin page (src/app/admin/b2b/access-requests/page.tsx)
 * defaults to when showing the actionable queue. Not "all businesses",
 * not "all leads" — only requests genuinely awaiting admin action.
 */
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

export async function collectB2bQueueMetrics(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const pendingSize = await ctx.prisma.businessAccessRequest.count({ where: { status: "PENDING" } });
  return [{ metric: "queue.b2b.pending_size", value: pendingSize }];
}

export const b2bQueueMetricsCollector: MetricCollector = {
  name: "b2b_queue_metrics",
  intervalSec: 300,
  timeoutMs: 10_000,
  collect: collectB2bQueueMetrics,
};
