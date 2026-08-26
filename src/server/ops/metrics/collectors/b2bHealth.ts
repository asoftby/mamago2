/**
 * b2b.active_businesses / b2b.new_businesses_30d /
 * b2b.meaningful_action_rate — every 60 min.
 *
 *   active_businesses      -> Business WHERE operationalStatus='ACTIVE'
 *                             AND >=1 published Place/Activity/Offer
 *                             (businesses with zero published inventory are
 *                             not "active" in any product sense).
 *   new_businesses_30d     -> Business WHERE createdAt >= now - 30d.
 *   meaningful_action_rate -> of active_businesses (the inventory-bearing
 *                             set above), the fraction whose OWN published
 *                             inventory received >=1 SAVE/PLAN_ADD/
 *                             CTA_CLICK in the trailing 30 DAYS. Businesses
 *                             without published inventory are excluded from
 *                             both numerator and denominator — they cannot
 *                             structurally receive an action, so including
 *                             them would silently deflate the rate.
 *
 * Ownership resolution: Place.ownerBusinessId directly; Activity.businessId
 * directly; Offer has no direct businessId, resolved via Offer.placeId ->
 * Place.ownerBusinessId. Repeat-promotion / revenue are deliberately absent
 * here — paid Promotion is disabled in prod (see backlog), no honest signal
 * exists yet.
 */
import { Prisma } from "@prisma/client";
import { resolvePerformanceWindow } from "@/lib/performance/performanceMetrics";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

interface B2BRow {
  active_with_inventory: bigint;
  acted_count: bigint;
}

export async function collectB2BHealth(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const { prisma, now } = ctx;
  const window = resolvePerformanceWindow("30d", now);

  const [row, newBusinesses30d] = await Promise.all([
    prisma.$queryRaw<B2BRow[]>(Prisma.sql`
      WITH published_places AS (
        SELECT id, "ownerBusinessId" AS "businessId" FROM "Place"
          WHERE status = 'PUBLISHED' AND "ownerBusinessId" IS NOT NULL
      ),
      published_activities AS (
        SELECT id, "businessId" FROM "Activity"
          WHERE status = 'PUBLISHED' AND "businessId" IS NOT NULL
      ),
      published_offers AS (
        SELECT o.id, p."ownerBusinessId" AS "businessId"
        FROM "Offer" o JOIN "Place" p ON p.id = o."placeId"
        WHERE o.status = 'PUBLISHED' AND p."ownerBusinessId" IS NOT NULL
      ),
      businesses_with_inventory AS (
        SELECT "businessId" FROM published_places
        UNION SELECT "businessId" FROM published_activities
        UNION SELECT "businessId" FROM published_offers
      ),
      active_with_inventory AS (
        SELECT DISTINCT bwi."businessId"
        FROM businesses_with_inventory bwi
        JOIN "Business" b ON b.id = bwi."businessId" AND b."operationalStatus" = 'ACTIVE'
      ),
      acted_place_biz AS (
        SELECT DISTINCT pp."businessId"
        FROM "UserEvent" e
        JOIN published_places pp ON pp.id = e."entityId" AND e."entityType" = 'PLACE'
        WHERE e."eventType" IN ('SAVE', 'PLAN_ADD', 'CTA_CLICK')
          AND e."createdAt" >= ${window.start} AND e."createdAt" < ${window.end}
      ),
      acted_activity_biz AS (
        SELECT DISTINCT pa."businessId"
        FROM "UserEvent" e
        JOIN published_activities pa ON pa.id = e."entityId" AND e."entityType" = 'EVENT'
        WHERE e."eventType" IN ('SAVE', 'PLAN_ADD', 'CTA_CLICK')
          AND e."createdAt" >= ${window.start} AND e."createdAt" < ${window.end}
      ),
      acted_offer_biz AS (
        SELECT DISTINCT po."businessId"
        FROM "UserEvent" e
        JOIN published_offers po ON po.id = e."entityId" AND e."entityType" = 'OFFER'
        WHERE e."eventType" IN ('SAVE', 'PLAN_ADD', 'CTA_CLICK')
          AND e."createdAt" >= ${window.start} AND e."createdAt" < ${window.end}
      ),
      acted_businesses AS (
        SELECT "businessId" FROM acted_place_biz
        UNION SELECT "businessId" FROM acted_activity_biz
        UNION SELECT "businessId" FROM acted_offer_biz
      )
      SELECT
        (SELECT count(*) FROM active_with_inventory)::bigint AS active_with_inventory,
        (SELECT count(*) FROM active_with_inventory awi
          WHERE awi."businessId" IN (SELECT "businessId" FROM acted_businesses))::bigint AS acted_count
    `),
    prisma.business.count({ where: { createdAt: { gte: window.start } } }),
  ]);

  const activeWithInventory = Number(row[0]?.active_with_inventory ?? 0);
  const actedCount = Number(row[0]?.acted_count ?? 0);

  const samples: MetricSampleDraft[] = [
    { metric: "b2b.active_businesses", value: activeWithInventory },
    { metric: "b2b.new_businesses_30d", value: newBusinesses30d },
  ];
  if (activeWithInventory > 0) {
    samples.push({ metric: "b2b.meaningful_action_rate", value: actedCount / activeWithInventory });
  }
  // activeWithInventory === 0: rate is undefined — no sample written.

  return samples;
}

export const b2bHealthCollector: MetricCollector = {
  name: "b2b_health",
  intervalSec: 3_600,
  timeoutMs: 20_000,
  collect: collectB2BHealth,
};
