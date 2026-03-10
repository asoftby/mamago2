/**
 * Server-side helpers for Place data enrichment
 */

import { PrismaClient } from "@prisma/client";
import { getPlaceDisplayTitle } from "./placeDisplayTitle";

/**
 * Enrich Place data with displayTitle
 * Use this on the server before passing data to client components
 */
export async function enrichPlaceWithDisplayTitle<T extends {
  id: string;
  title: string;
  formattedAddr: string | null;
  customAddress: string | null;
  shortAddress: string | null;
  cityId: string | null;
}>(
  prisma: PrismaClient,
  place: T
): Promise<T & { displayTitle: string }> {
  const displayTitle = await getPlaceDisplayTitle(prisma, {
    id: place.id,
    title: place.title,
    formattedAddr: place.formattedAddr,
    customAddress: place.customAddress,
    shortAddress: place.shortAddress,
    cityId: place.cityId,
  });

  return {
    ...place,
    displayTitle,
  };
}

/**
 * Enrich multiple Places with displayTitle
 */
export async function enrichPlacesWithDisplayTitle<T extends {
  id: string;
  title: string;
  formattedAddr: string | null;
  customAddress: string | null;
  shortAddress: string | null;
  cityId: string | null;
}>(
  prisma: PrismaClient,
  places: T[]
): Promise<Array<T & { displayTitle: string }>> {
  return Promise.all(
    places.map((place) => enrichPlaceWithDisplayTitle(prisma, place))
  );
}
