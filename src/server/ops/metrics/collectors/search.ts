/**
 * search.queries_total / search.zero_result_rate — every 15 min
 * (§21 Step 5, Phase D).
 *
 * Real search telemetry only (`SearchQueryLog`) — never inferred from
 * pageviews. Represents activity in this collector's own rolling window
 * (the trailing 15 minutes), not an all-time cumulative counter — unlike
 * audience.*, no canonical "search window" convention exists to reuse, so
 * Phase D's own "collection window, not cumulative" rule applies directly.
 *
 * zero_result_rate has no existing canonical unit in this codebase
 * (`computeSearchOverview` reports raw counts, never a ratio) — frozen
 * here to 0.0..1.0. When total queries = 0 the rate is mathematically
 * undefined: the sample is skipped entirely, never written as a fake 0
 * (mirrors this repo's own `ratioPercent()` convention of returning null
 * rather than 0 on a zero denominator).
 */
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

const SEARCH_WINDOW_SEC = 900;

export async function collectSearchMetrics(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const windowStart = new Date(ctx.now.getTime() - SEARCH_WINDOW_SEC * 1000);
  const where = { createdAt: { gte: windowStart, lt: ctx.now } };

  const [totalQueries, zeroResultQueries] = await Promise.all([
    ctx.prisma.searchQueryLog.count({ where }),
    ctx.prisma.searchQueryLog.count({ where: { ...where, resultsCount: 0 } }),
  ]);

  const samples: MetricSampleDraft[] = [{ metric: "search.queries_total", value: totalQueries }];

  if (totalQueries > 0) {
    samples.push({ metric: "search.zero_result_rate", value: zeroResultQueries / totalQueries });
  }
  // totalQueries === 0: zero_result_rate is undefined — no sample written.

  return samples;
}

export const searchMetricsCollector: MetricCollector = {
  name: "search_metrics",
  intervalSec: SEARCH_WINDOW_SEC,
  timeoutMs: 15_000,
  collect: collectSearchMetrics,
};
