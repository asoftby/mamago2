import { PartyCategory, type OfferProductType, type Prisma } from "@prisma/client";
import { PartyApiError } from "./partyDraft.validation";

export type CatalogOffer = {
  id: string;
  productType: OfferProductType | null;
  category: PartyCategory | null;
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
  if ((mode === "VENUE" || mode === "PACKAGE") !== isVenueOffer(anchor)) {
    throw new PartyApiError(422, "Основное предложение не соответствует формату");
  }
  const included = new Set(includedCategories(anchor));
  if (addons.some((offer) => offer.id === anchor.id || isVenueOffer(offer) ||
      (offer.category && included.has(offer.category)))) {
    throw new PartyApiError(422, "Дополнительная услуга уже входит в пакет или является площадкой");
  }
}
