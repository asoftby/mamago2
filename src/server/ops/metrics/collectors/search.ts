/**
 * search.queries_total / search.zero_result_rate / search.action_rate —
 * every 15 min (§21 Step 5, Phase D; action_rate added for the dashboard
 * rework).
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
 *
 * action_rate = fraction of search rows whose session (or, absent a
 * sessionId, the same userId) produced a DETAIL_OPEN/SAVE/PLAN_ADD at or
 * after that search, within this same collection window — i.e. "did this
 * search lead to a meaningful action", not just "how many searches ran".
 */
import { Prisma } from "@prisma/client";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

const SEARCH_WINDOW_SEC = 900;

interface SearchActionRow {
  total_searches: bigint;
  actioned_searches: bigint;
}

export async function collectSearchMetrics(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const windowStart = new Date(ctx.now.getTime() - SEARCH_WINDOW_SEC * 1000);
  const where = { createdAt: { gte: windowStart, lt: ctx.now } };

  const [totalQueries, zeroResultQueries, actionRow] = await Promise.all([
    ctx.prisma.searchQueryLog.count({ where }),
    ctx.prisma.searchQueryLog.count({ where: { ...where, resultsCount: 0 } }),
    ctx.prisma.$queryRaw<SearchActionRow[]>(Prisma.sql`
      WITH searches AS (
        SELECT id, "sessionId", "userId", "createdAt" FROM "SearchQueryLog"
        WHERE "createdAt" >= ${windowStart} AND "createdAt" < ${ctx.now}
          AND ("sessionId" IS NOT NULL OR "userId" IS NOT NULL)
      ),
      actioned AS (
        SELECT DISTINCT s.id
        FROM searches s
        JOIN "UserEvent" e ON (
          (s."sessionId" IS NOT NULL AND e."sessionId" = s."sessionId")
          OR (s."sessionId" IS NULL AND e."userId" = s."userId")
        )
        WHERE e."eventType" IN ('DETAIL_OPEN', 'SAVE', 'PLAN_ADD')
          AND e."createdAt" >= s."createdAt" AND e."createdAt" < ${ctx.now}
      )
      SELECT
        (SELECT count(*) FROM searches)::bigint AS total_searches,
        (SELECT count(*) FROM actioned)::bigint AS actioned_searches
    `),
  ]);

  const samples: MetricSampleDraft[] = [{ metric: "search.queries_total", value: totalQueries }];

  if (totalQueries > 0) {
    samples.push({ metric: "search.zero_result_rate", value: zeroResultQueries / totalQueries });
  }
  // totalQueries === 0: zero_result_rate is undefined — no sample written.

  const totalSearchesWithIdentity = Number(actionRow[0]?.total_searches ?? 0);
  if (totalSearchesWithIdentity > 0) {
    const actioned = Number(actionRow[0]?.actioned_searches ?? 0);
    samples.push({ metric: "search.action_rate", value: actioned / totalSearchesWithIdentity });
  }

  return samples;
}

export const searchMetricsCollector: MetricCollector = {
  name: "search_metrics",
  intervalSec: SEARCH_WINDOW_SEC,
  timeoutMs: 15_000,
  collect: collectSearchMetrics,
};
