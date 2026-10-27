import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

/**
 * An event listing covers the selected city AND every real city in its oblast.
 * Minsk is a separate administrative city; its listing additionally covers
 * Minsk oblast. This is a geographic candidate pool, not a paid targeting rule.
 */
export const DISCOVERY_HUB_CITY_IDS_REVALIDATE_SECONDS = 60 * 60;

type DiscoveryHubCityIds = {
  primaryCityId: string;
  expandedCityIds: string[];
};

function fallbackHubCityIds(hubCityId: string): DiscoveryHubCityIds {
  return { primaryCityId: hubCityId, expandedCityIds: [hubCityId] };
}

async function readKudaDiscoveryCityIds(
  hubCitySlug: string,
  hubCityId: string,
): Promise<DiscoveryHubCityIds> {
  const city = await prisma.city.findFirst({
    where: { id: hubCityId, isLegacyNonCity: false },
    select: { id: true, countryId: true, regionId: true },
  });
  if (!city) return fallbackHubCityIds(hubCityId);

  // Minsk has no regionId in some installations; link it to Minsk oblast
  // without changing the City's administrative region in the database.
  let regionId = city.regionId;
  if (hubCitySlug === "minsk") {
    const minskOblast = await prisma.region.findFirst({
      where: { countryId: city.countryId, slug: "minskaya-oblast", isActive: true },
      select: { id: true },
    });
    regionId = minskOblast?.id ?? regionId;
  }
  if (!regionId) return fallbackHubCityIds(hubCityId);

  const cities = await prisma.city.findMany({
    where: {
      countryId: city.countryId,
      regionId,
      isLegacyNonCity: false,
      isActive: true,
    },
    select: { id: true },
  });
  return {
    primaryCityId: hubCityId,
    expandedCityIds: Array.from(new Set([hubCityId, ...cities.map((row) => row.id)])),
  };
}

export async function resolveKudaDiscoveryCityIds(
  hubCitySlug: string,
  hubCityId: string,
): Promise<DiscoveryHubCityIds> {
  return unstable_cache(
    () => readKudaDiscoveryCityIds(hubCitySlug, hubCityId),
    ["discovery-oblast-city-ids-v2", hubCitySlug, hubCityId],
    { revalidate: DISCOVERY_HUB_CITY_IDS_REVALIDATE_SECONDS },
  )();
}
