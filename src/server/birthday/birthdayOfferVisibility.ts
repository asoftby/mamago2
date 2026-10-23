import type { Prisma } from "@prisma/client";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";

/** Birthday cards and the builder share the same published, approved offer pool. */
export function getPublicBirthdayOfferWhere(cityId: string): Prisma.OfferWhereInput {
  return {
    AND: [
      getPublicPublishedOfferWhere(),
      { place: { cityId, ownerBusiness: { isNot: null } } },
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
