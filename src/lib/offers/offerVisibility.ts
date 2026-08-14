import type { BusinessOperationalStatus, OfferStatus } from "@prisma/client";

type OfferVisibilityPlace = {
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

export function isOfferPubliclyVisible(
  offer: OfferPublicVisibilityInput | null | undefined,
): boolean {
  if (!offer) return false;
  if (offer.status !== "PUBLISHED") return false;
  // A PUBLISHED Offer without a Place should never exist (write-side gates
  // enforce this), but visibility must not silently pass a corrupted row —
  // defense in depth, not a state this function ever expects to see.
  if (!offer.place) return false;
  if (offer.archivedAt) return false;
  if (offer.place.archivedAt) return false;

  const operationalStatus = offer.place?.ownerBusiness?.operationalStatus;
  if (operationalStatus && operationalStatus !== "ACTIVE") {
    return false;
  }

  return true;
}
