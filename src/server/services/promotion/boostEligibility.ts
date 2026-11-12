import type { Prisma } from "@prisma/client";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";

/**
 * Boost may only be sold for an Offer that participates in the existing
 * discovery delivery path. classesDiscoveryFeed currently ranks SERVICE
 * offers; PACKAGE and EVENT kinds have no equivalent ranked Offer feed.
 * Do not sell visibility that the product cannot deliver.
 */
export function getBoostablePublishedOfferWhere(now = new Date()): Prisma.OfferWhereInput {
  return {
    AND: [
      getPublicPublishedOfferWhere(now),
      { kind: "SERVICE" },
    ],
  };
}
