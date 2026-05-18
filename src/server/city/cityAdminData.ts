import { ActivityType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  getPublicListingActivityWhere,
  getPublicPublishedPlaceWhere,
} from "@/server/public/publicContentVisibility";

export type AdminCityRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isVisibleInCityFilter: boolean;
  priority: number;
  eventsCount: number;
  placesCount: number;
};

/** Server-side memory cache for admin city rows (revalidated every 5 minutes) */
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedRows: AdminCityRow[] | null = null;
let cacheUpdatedAt = 0;

async function countPublicEventsForCity(cityId: string): Promise<number> {
  const pubActivity = getPublicListingActivityWhere();
  const pubActivityParts = (pubActivity.AND ?? []) as object[];

  return prisma.activity.count({
    where: {
      AND: [{ type: ActivityType.EVENT }, ...pubActivityParts],
      OR: [
        { cityId },
        { place: { cityId } },
        { venue: { cityId } },
        { venue: { place: { cityId } } },
      ],
    },
  });
}

async function countPublicPlacesForCity(cityId: string): Promise<number> {
  return prisma.place.count({
    where: {
      cityId,
      AND: getPublicPublishedPlaceWhere().AND,
    },
  });
}

export async function listAdminCityRows(): Promise<AdminCityRow[]> {
  // Return cached data if still fresh
  const now = Date.now();
  if (cachedRows && now - cacheUpdatedAt < CACHE_TTL) {
    return cachedRows;
  }

  const cities = await prisma.city.findMany({
    orderBy: [{ priority: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      isVisibleInCityFilter: true,
      priority: true,
    },
  });

  const rows = await Promise.all(
    cities.map(async (city) => {
      const [eventsCount, placesCount] = await Promise.all([
        countPublicEventsForCity(city.id),
        countPublicPlacesForCity(city.id),
      ]);

      return {
        ...city,
        eventsCount,
        placesCount,
      };
    }),
  );

  // Update cache
  cachedRows = rows;
  cacheUpdatedAt = now;

  return rows;
}
