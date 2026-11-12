import type { Prisma } from "@prisma/client";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";

/**
 * Boost v1 is delivered through classesDiscoveryFeed, not the Birthday or
 * Camps catalog. Legacy SERVICE offers without productType remain discoverable.
 * PARTY_PACKAGE and other unsupported product types must not be sold a Boost
 * until their own ranked catalog delivery is implemented.
 */
export { isBoostableOfferProductType } from "@/lib/promotion/boostableOfferTypes";

export function getBoostablePublishedOfferWhere(now = new Date()): Prisma.OfferWhereInput {
  return {
    AND: [
      getPublicPublishedOfferWhere(now),
      { kind: "SERVICE" },
      {
        OR: [
          { productType: null },
          { productType: { in: ["ONE_TIME_ACTIVITY", "REGULAR_ACTIVITY"] } },
        ],
      },
    ],
  };
}
