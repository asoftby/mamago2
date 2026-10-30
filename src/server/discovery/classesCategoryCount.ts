import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { resolveTerritoryScope, placeInTerritoryScopeWhere } from "@/server/territory/territoryScope";
import { getDiscoveryRegionContext } from "@/server/geo/boostRegionTargeting";
import { buildClassesDiscoveryWhere } from "@/server/discovery/classesDiscoveryFeed";

/** Uses the same visibility, territory and category constraints as the public classes listing. */
export async function countPublicClassesCategory(cityId: string, citySlug: string, chipSlug: string): Promise<number> {
  const [scope, targetRegionId] = await Promise.all([
    resolveTerritoryScope(citySlug),
    getDiscoveryRegionContext(cityId, citySlug),
  ]);
  const publicWhere = getPublicPublishedOfferWhere();
  const publicWhereParts = (publicWhere.AND ?? []) as Prisma.OfferWhereInput[];
  const placeWhere = scope ? placeInTerritoryScopeWhere(scope.territoryIds) : { cityId };
  const where = buildClassesDiscoveryWhere({
    publicWhereParts, cityId, placeWhere, targetRegionId,
    chipSlug, now: new Date(), free: false, priceMax: null,
  });
  try {
    return await prisma.offer.count({ where });
  } catch (error) {
    // Without the classChipSlugs migration the feed may fall back to unfiltered
    // results. Do not claim an individual category is populated in that case.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("classChipSlugs") || message.includes("P2022")) return 0;
    throw error;
  }
}
