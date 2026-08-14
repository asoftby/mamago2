import type { OfferStatus } from "@prisma/client";

/**
 * Owner rule: a DRAFT Offer may temporarily exist without a Place, but
 * PENDING/PUBLISHED never can. Every status-transition path (business PATCH,
 * submitOfferForModeration, approveOffer) must check this before writing.
 */
export function offerStatusRequiresPlace(status: OfferStatus): boolean {
  return status === "PENDING" || status === "PUBLISHED";
}
