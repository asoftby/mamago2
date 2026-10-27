import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

/** Fifty DISTINCT families in the viewer's city/oblast; repeat plan items count once. */
export const CROSS_REGION_FAMILY_THRESHOLD = 50;

async function readQualifiedActivityIds(homeCityIds: string[]): Promise<string[]> {
  if (homeCityIds.length === 0) return [];
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
    HAVING COUNT(DISTINCT pi."familyId") >= ${CROSS_REGION_FAMILY_THRESHOLD}
    LIMIT 300
  `);
  return rows.map((row) => row.activityId);
}

export async function getCrossRegionPopularActivityIds(hubCityId: string, homeCityIds: string[]): Promise<string[]> {
  return unstable_cache(
    () => readQualifiedActivityIds(homeCityIds),
    ["cross-region-plan-50-v1", hubCityId, ...homeCityIds.slice().sort()],
    { revalidate: 300 },
  )();
}
