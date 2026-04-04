import type { Prisma } from "@prisma/client";

/** Событие относится к городу: прямой cityId, место или venue. */
export function activityInCityWhere(cityId: string): Prisma.ActivityWhereInput {
  return {
    OR: [{ cityId }, { place: { cityId } }, { venue: { cityId } }],
  };
}

/** Листинг сразу по нескольким городам (хаб + пригород/область). */
export function activityInAnyOfCitiesWhere(cityIds: string[]): Prisma.ActivityWhereInput {
  if (cityIds.length === 0) {
    return { id: { in: [] } };
  }
  if (cityIds.length === 1) {
    return activityInCityWhere(cityIds[0]!);
  }
  return { OR: cityIds.map((id) => activityInCityWhere(id)) };
}
