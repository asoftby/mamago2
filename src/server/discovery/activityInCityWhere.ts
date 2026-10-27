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
  // Three IN predicates instead of 3 × N OR predicates for an entire oblast.
  return {
    OR: [
      { cityId: { in: cityIds } },
      { place: { cityId: { in: cityIds } } },
      { venue: { cityId: { in: cityIds } } },
    ],
  };
}

/**
 * Strict geographic scope follows the card's displayed city precedence:
 * venue > place > activity. A mismatched fallback city must never leak
 * an event into a different explicitly selected territory.
 */
export function activityInExactCitiesWhere(cityIds: string[]): Prisma.ActivityWhereInput {
  if (cityIds.length === 0) return { id: { in: [] } };
  return {
    OR: [
      { venue: { cityId: { in: cityIds } } },
      {
        AND: [
          { OR: [{ venueId: null }, { venue: { cityId: null } }] },
          { place: { cityId: { in: cityIds } } },
        ],
      },
      {
        AND: [
          { OR: [{ venueId: null }, { venue: { cityId: null } }] },
          { OR: [{ placeId: null }, { place: { cityId: null } }] },
          { cityId: { in: cityIds } },
        ],
      },
    ],
  };
}
