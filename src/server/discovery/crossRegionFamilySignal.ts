import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";
import { getCrossRegionFamilyThreshold } from "./crossRegionThreshold";


async function readQualifiedActivityIds(hubCityId: string, homeCityIds: string[]): Promise<string[]> {
  if (homeCityIds.length === 0) return [];
  const city = await prisma.city.findUnique({ where: { id: hubCityId }, select: { regionId: true, countryId: true, slug: true } });
  let discoveryRegionId = city?.regionId ?? null;
  if (city?.slug === "minsk") {
    const minskOblast = await prisma.region.findFirst({ where: { countryId: city.countryId, slug: "minskaya-oblast", isActive: true }, select: { id: true } });
    discoveryRegionId = minskOblast?.id ?? discoveryRegionId;
  }
  const region = discoveryRegionId ? await prisma.region.findUnique({ where: { id: discoveryRegionId }, select: { slug: true } }) : null;
  const threshold = getCrossRegionFamilyThreshold(region?.slug);
  const overrides = discoveryRegionId ? await prisma.crossRegionEditorialOverride.findMany({
    where: { regionId: discoveryRegionId, expiresAt: { gt: new Date() } },
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
    ["cross-region-plan-threshold-v4", process.env.CROSS_REGION_FAMILY_THRESHOLDS ?? "", hubCityId, ...homeCityIds.slice().sort()],
    { revalidate: 300 },
  )();
}
