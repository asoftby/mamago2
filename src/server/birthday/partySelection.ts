import { PartyCategory, type OfferProductType, type PartyLocationType, type Prisma } from "@prisma/client";
import { PartyApiError } from "./partyDraft.validation";

export type CatalogOffer = {
  id: string;
  productType: OfferProductType | null;
  category: PartyCategory | null;
  partyLocationType: PartyLocationType | null;
  priceFrom: number | null;
  priceMode: string;
  currency: string;
  details: Prisma.JsonValue | null;
  components: { category: PartyCategory; isOptional: boolean }[];
  place: { ownerBusinessId: string | null } | null;
};

export function isVenueOffer(offer: CatalogOffer): boolean {
  return offer.productType === "PARTY_PACKAGE" || offer.category === "VENUE";
}

type PartyMode = "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";

export function isCompatiblePartyLocation(mode: PartyMode, offer: CatalogOffer): boolean {
  const location = offer.partyLocationType;
  if (!location || location === "BOTH") return true;
  const onsite = mode === "VENUE" || mode === "PACKAGE";
  return location === (onsite ? "ON_SITE" : "OFF_SITE");
}

export function isValidPartyAnchor(mode: PartyMode, offer: CatalogOffer): boolean {
  if (!isCompatiblePartyLocation(mode, offer)) return false;
  if (mode === "VENUE" || mode === "PACKAGE") return isVenueOffer(offer);
  if (offer.productType === "PARTY_PACKAGE") {
    // Only explicitly mobile packages can anchor home/outdoor celebrations.
    return offer.partyLocationType === "OFF_SITE" || offer.partyLocationType === "BOTH";
  }
  return !isVenueOffer(offer);
}

export function includedCategories(offer: CatalogOffer): PartyCategory[] {
  if (offer.productType !== "PARTY_PACKAGE") return [];
  const details = offer.details && typeof offer.details === "object" &&
    !Array.isArray(offer.details) ? offer.details as Record<string, unknown> : {};
  const included = Array.isArray(details.includedCategories) ? details.includedCategories : [];
  const validCategories = new Set(Object.values(PartyCategory));
  return [...new Set([
    ...included.filter((v): v is PartyCategory => typeof v === "string" &&
      validCategories.has(v as PartyCategory)),
    ...offer.components.filter((v) => !v.isOptional).map((v) => v.category),
  ])];
}

/** Offers declared "on request" may carry a stale number; only a real price is snapshotted. */
export function offerPriceSnapshot(offer: Pick<CatalogOffer, "priceFrom" | "priceMode" | "currency">): number | null {
  if (offer.currency !== "BYN") return null;
  if (offer.priceMode === "FREE") return 0;
  if (offer.priceMode === "ON_REQUEST" || offer.priceMode === "NONE" || offer.priceMode === "UNKNOWN") return null;
  return offer.priceFrom != null && Number.isFinite(offer.priceFrom) && offer.priceFrom >= 0 ? offer.priceFrom : null;
}

/** A venue-mode party needs a venue/package anchor; add-ons cannot be venues or repeat included services. */
export function assertCompatibleSelection(
  mode: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR", anchor: CatalogOffer, addons: CatalogOffer[],
): void {
  if (!isValidPartyAnchor(mode, anchor)) {
    throw new PartyApiError(422, "Основное предложение не соответствует формату");
  }
  const included = new Set(includedCategories(anchor));
  if (addons.some((offer) => offer.id === anchor.id || isVenueOffer(offer) ||
      !isCompatiblePartyLocation(mode, offer) ||
      (offer.category && included.has(offer.category)))) {
    throw new PartyApiError(422, "Дополнительная услуга уже входит в пакет или является площадкой");
  }
}
