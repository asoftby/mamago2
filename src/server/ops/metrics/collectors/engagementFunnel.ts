/**
 * funnel.engaged_users / funnel.save_rate / funnel.plan_rate /
 * funnel.cta_rate — every 60 min.
 *
 * A distinct-user, 30-day value funnel — separate from funnel.ts's raw
 * 15-min-rolling event counters (which stay as-is for Operations). Rates
 * are TRUE ORDERED INTERSECTIONS from the engaged set, not independent
 * "all users who ever SAVE'd" rates: a user counts toward saveRate only if
 * their SAVE happened at or after their OWN first DETAIL_OPEN in this same
 * window. Without that ordering constraint, a SAVE/PLAN_ADD/CTA_CLICK from
 * a surface with no prior DETAIL_OPEN could make a rate exceed 100% and
 * would misrepresent "engaged users who converted" — this is user-level
 * "at/after first engagement" ordering, not full session/entity
 * attribution (a finer same-entity open->save link is a possible future
 * refinement, tracked in the backlog, not required for this to be
 * directionally correct).
 *
 * No role exclusion — matches funnel.ts's own stated convention (no
 * ADMIN/MODERATOR exclusion exists in the canonical UserEvent writers).
 */
import { Prisma } from "@prisma/client";
import { resolvePerformanceWindow } from "@/lib/performance/performanceMetrics";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

interface FunnelRow {
  engaged: bigint;
  saved: bigint;
  planned: bigint;
  clicked: bigint;
}

export async function collectEngagementFunnel(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const window = resolvePerformanceWindow("30d", ctx.now);

  const rows = await ctx.prisma.$queryRaw<FunnelRow[]>(Prisma.sql`
    WITH opens AS (
      SELECT "userId", MIN("createdAt") AS first_open
      FROM "UserEvent"
      WHERE "eventType" = 'DETAIL_OPEN' AND "userId" IS NOT NULL
        AND "createdAt" >= ${window.start} AND "createdAt" < ${window.end}
      GROUP BY "userId"
    ),
    saved AS (
      SELECT DISTINCT o."userId" FROM opens o
      JOIN "UserEvent" e ON e."userId" = o."userId" AND e."eventType" = 'SAVE'
        AND e."createdAt" >= o.first_open AND e."createdAt" < ${window.end}
    ),
    planned AS (
      SELECT DISTINCT o."userId" FROM opens o
      JOIN "UserEvent" e ON e."userId" = o."userId" AND e."eventType" = 'PLAN_ADD'
        AND e."createdAt" >= o.first_open AND e."createdAt" < ${window.end}
    ),
    clicked AS (
      SELECT DISTINCT o."userId" FROM opens o
      JOIN "UserEvent" e ON e."userId" = o."userId" AND e."eventType" = 'CTA_CLICK'
        AND e."createdAt" >= o.first_open AND e."createdAt" < ${window.end}
    )
    SELECT
      (SELECT count(*) FROM opens)::bigint AS engaged,
      (SELECT count(*) FROM saved)::bigint AS saved,
      (SELECT count(*) FROM planned)::bigint AS planned,
      (SELECT count(*) FROM clicked)::bigint AS clicked
  `);

  const row = rows[0];
  const engaged = Number(row?.engaged ?? 0);
  const saved = Number(row?.saved ?? 0);
  const planned = Number(row?.planned ?? 0);
  const clicked = Number(row?.clicked ?? 0);

  const samples: MetricSampleDraft[] = [{ metric: "funnel.engaged_users", value: engaged }];
  if (engaged > 0) {
    samples.push(
      { metric: "funnel.save_rate", value: saved / engaged },
      { metric: "funnel.plan_rate", value: planned / engaged },
      { metric: "funnel.cta_rate", value: clicked / engaged },
    );
  }
  // engaged === 0: rates are undefined — no samples written for them.

  return samples;
}

export const engagementFunnelCollector: MetricCollector = {
  name: "engagement_funnel",
  intervalSec: 3_600,
  timeoutMs: 20_000,
  collect: collectEngagementFunnel,
};
