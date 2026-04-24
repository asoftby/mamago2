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

  return rows;
}
