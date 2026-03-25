import type { Prisma } from "@prisma/client";

/** Событие относится к городу: прямой cityId, место или venue. */
export function activityInCityWhere(cityId: string): Prisma.ActivityWhereInput {
  return {
    OR: [{ cityId }, { place: { cityId } }, { venue: { cityId } }],
  };
}
