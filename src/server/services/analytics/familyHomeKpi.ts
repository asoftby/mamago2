import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type FamilyHomeKpiFilter = {
  from: Date; to: Date; cityId?: string; eventId?: string; userId?: string;
};
/** Read-only aggregation over the existing raw truth and recommendation trace. No IDs leave this function. */
export async function readFamilyHomeKpi(filter: FamilyHomeKpiFilter) {
  if (!Number.isFinite(+filter.from) || !Number.isFinite(+filter.to) || filter.from >= filter.to) {
    throw new Error("invalid_kpi_period");
  }
  const rows = await prisma.$queryRaw<Array<{
    planAdds: bigint; qualifiedImpressions: bigint; exposedUsers: bigint;
    detailOpens: bigint; dismissals: bigint; chipChanges: bigint; catalogClicks: bigint;
  }>>(Prisma.sql`
    WITH events AS (
      SELECT e.*, r.id AS "verifiedRunId", r.surface, x.id AS "exposureId",
        (o."eventType" = e."eventType" AND x."entityType" = e."entityType"
          AND x."entityId" = e."entityId" AND r."userId" = e."userId"
          AND e."decisionId" = r.id) AS traced
      FROM "UserEvent" e
      LEFT JOIN "RecommendationOutcome" o ON o."userEventId" = e.id
      LEFT JOIN "RecommendationExposure" x ON x.id = o."exposureId"
      LEFT JOIN "RecommendationRun" r ON r.id = x."runId"
      WHERE e."createdAt" >= ${filter.from} AND e."createdAt" < ${filter.to}
        AND e.meta->>'section' = 'home' AND e.meta->>'placement' = 'HOME_FOR_FAMILY'
        ${filter.cityId ? Prisma.sql`AND e."cityId" = ${filter.cityId}` : Prisma.empty}
        ${filter.userId ? Prisma.sql`AND e."userId" = ${filter.userId}` : Prisma.empty}
        ${filter.eventId ? Prisma.sql`AND e."entityType" = 'EVENT' AND e."entityId" = ${filter.eventId}` : Prisma.empty}
    )
    SELECT
      COUNT(DISTINCT meta->>'planItemId') FILTER (WHERE "eventType" = 'PLAN_ADD'
        AND "entityType" = 'EVENT' AND traced AND surface = 'HOME'
        AND meta->>'source' = 'recommendation' AND meta->>'recommendationSurface' = 'home'
        AND meta->>'homePlanAddVerified' = 'true' AND "clientClass" IS NULL
        AND "idempotencyKey" = 'home-plan-add:' || (meta->>'planItemId')
        AND meta->>'recommendationExposureId' = "exposureId"
        AND meta->>'recommendationRunId' = "verifiedRunId") AS "planAdds",
      COUNT(*) FILTER (WHERE "eventType" = 'CARD_VIEW' AND meta->>'impression' = 'true'
        AND traced AND surface = 'HOME') AS "qualifiedImpressions",
      COUNT(DISTINCT "userId") FILTER (WHERE "eventType" = 'CARD_VIEW'
        AND meta->>'impression' = 'true' AND traced AND surface = 'HOME') AS "exposedUsers",
      COUNT(*) FILTER (WHERE "eventType" = 'DETAIL_OPEN' AND traced AND surface = 'HOME') AS "detailOpens",
      COUNT(*) FILTER (WHERE "eventType" = 'DISMISS' AND traced AND surface = 'HOME') AS dismissals,
      COUNT(*) FILTER (WHERE "eventType" = 'FILTER_APPLY' AND meta->>'action' = 'home_chip_select'
        AND meta->>'selectionMode' IN ('ALL_FAMILY', 'CHILD')) AS "chipChanges",
      COUNT(*) FILTER (WHERE "eventType" = 'CTA_CLICK' AND meta->>'targetAction' = 'catalog') AS "catalogClicks"
    FROM events
  `);
  const row = rows[0];
  const counts = {
    planAdds: Number(row.planAdds), qualifiedImpressions: Number(row.qualifiedImpressions),
    exposedUsers: Number(row.exposedUsers), detailOpens: Number(row.detailOpens),
    dismissals: Number(row.dismissals),
    // Block actions have no entity: they cannot be assigned to an individual event.
    chipChanges: filter.eventId ? null : Number(row.chipChanges),
    catalogClicks: filter.eventId ? null : Number(row.catalogClicks),
  };
  return { ...counts, planAddsPerQualifiedImpression: counts.qualifiedImpressions
    ? counts.planAdds / counts.qualifiedImpressions : null };
}
