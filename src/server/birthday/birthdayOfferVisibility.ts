import type { Prisma } from "@prisma/client";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";

/** Birthday cards and the builder share the same published, approved offer pool. */
/** `territoryIds` (a territory scope) takes precedence over the legacy `cityId` filter. */
export function getPublicBirthdayOfferWhere(
  cityId: string,
  territoryIds?: readonly string[] | null,
): Prisma.OfferWhereInput {
  return {
    AND: [
      getPublicPublishedOfferWhere(),
      {
        place: {
          ...(territoryIds ? { territoryId: { in: [...territoryIds] } } : { cityId }),
          ownerBusiness: { isNot: null },
        },
      },
      {
        OR: [
          { productType: "PARTY_PACKAGE" },
          { productType: "PARTY_SERVICE", category: { not: null } },
        ],
      },
      { placements: { some: { key: "BIRTHDAY", status: "APPROVED" } } },
    ],
  };
}
