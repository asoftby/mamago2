import type { BusinessOperationalStatus, ContentStatus, OfferStatus } from "@prisma/client";

type OfferVisibilityPlace = {
  /**
   * Required (not optional) on purpose: every public Offer query must select
   * `place.status`, otherwise TypeScript flags it. A missing value is treated
   * as not published (fail closed).
   */
  status: ContentStatus | string;
  archivedAt?: Date | null;
  ownerBusiness?: {
    operationalStatus: BusinessOperationalStatus;
  } | null;
} | null;

type OfferPublicVisibilityInput = {
  status: OfferStatus | string;
  archivedAt?: Date | null;
  place?: OfferVisibilityPlace;
};

export type OfferHiddenReason =
  | "OFFER_MISSING"
  | "OFFER_NOT_PUBLISHED"
  | "OFFER_ARCHIVED"
  | "PLACE_MISSING"
  | "PLACE_NOT_PUBLISHED"
  | "PLACE_ARCHIVED"
  | "BUSINESS_NOT_ACTIVE";

/**
 * Why an Offer is hidden from the public site, or `null` when it is visible.
 *
 * Must stay in lockstep with `getPublicPublishedOfferWhere()`
 * (`src/server/public/publicContentVisibility.ts`), which the detail data
 * loader (`getOfferPageData`) applies in SQL. When the two disagree the page
 * passes its own check and then the loader returns null — a dead public URL
 * for an Offer that moderation reports as PUBLISHED.
 */
export function getOfferHiddenReason(
  offer: OfferPublicVisibilityInput | null | undefined,
): OfferHiddenReason | null {
  if (!offer) return "OFFER_MISSING";
  if (offer.status !== "PUBLISHED") return "OFFER_NOT_PUBLISHED";
  // A PUBLISHED Offer without a Place should never exist (write-side gates
  // enforce this), but visibility must not silently pass a corrupted row —
  // defense in depth, not a state this function ever expects to see.
  if (!offer.place) return "PLACE_MISSING";
  if (offer.archivedAt) return "OFFER_ARCHIVED";
  if (offer.place.status !== "PUBLISHED") return "PLACE_NOT_PUBLISHED";
  if (offer.place.archivedAt) return "PLACE_ARCHIVED";

  const operationalStatus = offer.place.ownerBusiness?.operationalStatus;
  if (operationalStatus && operationalStatus !== "ACTIVE") {
    return "BUSINESS_NOT_ACTIVE";
  }

  return null;
}

export function isOfferPubliclyVisible(
  offer: OfferPublicVisibilityInput | null | undefined,
): boolean {
  return getOfferHiddenReason(offer) === null;
}
