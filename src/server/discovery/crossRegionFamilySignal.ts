import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

/** Fifty DISTINCT families in the viewer's city/oblast; repeat plan items count once. */
export const CROSS_REGION_FAMILY_THRESHOLD = 50;

async function readQualifiedActivityIds(hubCityId: string, homeCityIds: string[]): Promise<string[]> {
  if (homeCityIds.length === 0) return [];
  const configured = await prisma.city.findUnique({
    where: { id: hubCityId },
    select: { region: { select: { crossRegionFamilyThreshold: true } } },
  });
  const threshold = configured?.region?.crossRegionFamilyThreshold ?? CROSS_REGION_FAMILY_THRESHOLD;
  const overrides = configured?.region ? await prisma.crossRegionEditorialOverride.findMany({
    where: { region: { cities: { some: { id: hubCityId } } }, expiresAt: { gt: new Date() } },
    select: { activityId: true },
    take: 300,
  }) : [];
  const rows = await prisma.$queryRaw<Array<{ activityId: string }>>(Prisma.sql`
    SELECT pi."activityId" AS "activityId"
    FROM "PlanItem" pi
    JOIN "Family" f ON f.id = pi."familyId"
    WHERE pi."activityId" IS NOT NULL
      AND pi."cancelledAt" IS NULL
      AND pi.status = 'CONFIRMED'::"PlanDecisionStatus"
      AND f."archivedAt" IS NULL
      AND f."homeCityId" IN (${Prisma.join(homeCityIds)})
    GROUP BY pi."activityId"
    HAVING COUNT(DISTINCT pi."familyId") >= ${threshold}
    LIMIT 300
  `);
  return [...new Set([...rows.map((row) => row.activityId), ...overrides.map((row) => row.activityId)])];
}

export async function getCrossRegionPopularActivityIds(hubCityId: string, homeCityIds: string[]): Promise<string[]> {
  return unstable_cache(
    () => readQualifiedActivityIds(hubCityId, homeCityIds),
    ["cross-region-plan-config-v2", hubCityId, ...homeCityIds.slice().sort()],
    { revalidate: 300 },
  )();
}
