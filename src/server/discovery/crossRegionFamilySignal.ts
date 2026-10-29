import { getLocalDateKey } from "@/lib/date/localDateKey";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCrossRegionFamilyThreshold } from "./crossRegionThreshold";
import { AUDIENCE_EXCLUDED_ROLES } from "@/server/services/analytics/canonicalAudience";

export type CrossRegionEligibility = {
  activityId: string;
  reason: "FAMILY_SIGNAL" | "EDITORIAL_OVERRIDE";
  familyCount?: number;
  overrideId?: string;
};

/** Live projection of existing plan/membership/moderation truth; never cache revocations. */
export async function readCrossRegionEligibility(hubCityId: string, homeCityIds: string[], now = new Date()): Promise<CrossRegionEligibility[]> {
  if (homeCityIds.length === 0) return [];
  const city = await prisma.city.findUnique({ where: { id: hubCityId }, select: { regionId: true, countryId: true, slug: true } });
  let discoveryRegionId = city?.regionId ?? null;
  if (city?.slug === "minsk") {
    const oblast = await prisma.region.findFirst({ where: { countryId: city.countryId, slug: "minskaya-oblast", isActive: true }, select: { id: true } });
    discoveryRegionId = oblast?.id ?? discoveryRegionId;
  }
  const region = discoveryRegionId ? await prisma.region.findUnique({ where: { id: discoveryRegionId }, select: { slug: true } }) : null;
  const threshold = getCrossRegionFamilyThreshold(region?.slug);
  const overrides = discoveryRegionId ? await prisma.crossRegionEditorialOverride.findMany({
    where: { regionId: discoveryRegionId, expiresAt: { gt: now }, reason: { not: "" }, createdById: { not: "" } },
    select: { id: true, activityId: true },
  }) : [];
  const rows = await prisma.$queryRaw<Array<{ activityId: string; familyCount: bigint }>>(Prisma.sql`
    SELECT pi."activityId" AS "activityId", COUNT(DISTINCT pi."familyId") AS "familyCount"
    FROM "PlanItem" pi
    JOIN "Family" f ON f.id = pi."familyId"
    JOIN "Activity" a ON a.id = pi."activityId"
    JOIN "User" u ON u.id = pi."userId"
    JOIN "FamilyMembership" fm ON fm."familyId" = f.id AND fm."userId" = u.id AND fm."leftAt" IS NULL
    WHERE pi."activityId" IS NOT NULL
      AND pi."cancelledAt" IS NULL
      AND (pi."startsAt" >= ${now} OR (pi."startsAt" IS NULL AND (pi.date IS NULL OR pi.date >= ${getLocalDateKey(now)})))
      AND pi.status = 'CONFIRMED'::"PlanDecisionStatus"
      AND f."archivedAt" IS NULL
      AND f."homeCityId" IN (${Prisma.join(homeCityIds)})
      -- Maturation blocks instant family churn; unique verified phone limits account farms.
      AND f."createdAt" <= ${new Date(now.getTime() - 7 * 86400000)}
      AND fm."joinedAt" <= pi."createdAt"
      AND u."deletedAt" IS NULL AND u.status = 'ACTIVE'::"UserStatus"
      AND u.role::text NOT IN (${Prisma.join([...AUDIENCE_EXCLUDED_ROLES])})
      AND u."phoneVerifiedAt" IS NOT NULL AND u."phoneE164" IS NOT NULL
      AND u."phoneVerifiedAt" <= pi."createdAt"
      -- Exclude organiser-controlled families, not only the parent who clicked.
      AND NOT EXISTS (
        SELECT 1 FROM "FamilyMembership" own
        WHERE own."familyId" = f.id AND own."leftAt" IS NULL AND (
          own."userId" = a."ownerUserId" OR EXISTS (
            SELECT 1 FROM "BusinessMember" bm WHERE bm."businessId" = a."businessId" AND bm."userId" = own."userId" AND bm."isActive" = true
          ) OR EXISTS (SELECT 1 FROM "Business" b WHERE b.id = a."businessId" AND b."ownerUserId" = own."userId")
        )
      )
      AND u.id <> a."ownerUserId"
      AND NOT EXISTS (SELECT 1 FROM "BusinessMember" bm WHERE bm."businessId" = a."businessId" AND bm."userId" = u.id AND bm."isActive" = true)
      AND NOT EXISTS (SELECT 1 FROM "Business" b WHERE b.id = a."businessId" AND b."ownerUserId" = u.id)
      AND (a."nextOccurrenceAt" >= ${now} OR EXISTS (
        SELECT 1 FROM "ActivitySession" s WHERE s."activityId" = a.id AND s."withdrawnAt" IS NULL AND s."startsAt" >= ${now}
      ))
    GROUP BY pi."activityId"
    HAVING COUNT(DISTINCT pi."familyId") >= ${threshold}
  `);
  const result = new Map<string, CrossRegionEligibility>();
  for (const row of overrides) result.set(row.activityId, { activityId: row.activityId, reason: "EDITORIAL_OVERRIDE", overrideId: row.id });
  // Organic evidence takes precedence over an editorial exception.
  for (const row of rows) result.set(row.activityId, { activityId: row.activityId, reason: "FAMILY_SIGNAL", familyCount: Number(row.familyCount) });
  return [...result.values()];
}

export async function getCrossRegionPopularActivityIds(hubCityId: string, homeCityIds: string[]): Promise<string[]> {
  return (await readCrossRegionEligibility(hubCityId, homeCityIds)).map(row => row.activityId);
}
