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

/** R1: at home/outdoors the anchor is the main entertainment service, not a venue. */
export const PRIMARY_ENTERTAINMENT_CATEGORIES: readonly PartyCategory[] =
  ["ANIMATOR", "SHOW", "PROGRAM", "MASTER_CLASS"];

export function isValidPartyAnchor(mode: PartyMode, offer: CatalogOffer): boolean {
  return partyAnchorProblem(mode, offer) === null;
}

/** Human-readable (422) reason why the offer cannot anchor the format, or null. */
export function partyAnchorProblem(mode: PartyMode, offer: CatalogOffer): string | null {
  if (!isCompatiblePartyLocation(mode, offer)) {
    return "Основная услуга не подходит по месту проведения";
  }
  if (mode === "VENUE" || mode === "PACKAGE") {
    return isVenueOffer(offer) ? null : "Для праздника на площадке выберите площадку или пакет";
  }
  if (offer.productType === "PARTY_PACKAGE") {
    // Only explicitly mobile packages can anchor home/outdoor celebrations.
    return offer.partyLocationType === "OFF_SITE" || offer.partyLocationType === "BOTH"
      ? null : "Этот пакет проводится только на площадке";
  }
  if (isVenueOffer(offer)) return "Для праздника дома или на улице площадка не может быть основной услугой";
  return offer.category && PRIMARY_ENTERTAINMENT_CATEGORIES.includes(offer.category)
    ? null : "Основной услугой должны быть аниматор, шоу, программа или мастер-класс";
}

/** R2: only these formats have no exclusive inventory, so a fixed price may confirm instantly. */
export function isAutoConfirmMode(mode: PartyMode): boolean {
  return mode === "HOME" || mode === "OUTDOOR";
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
  const problem = partyAnchorProblem(mode, anchor);
  if (problem) throw new PartyApiError(422, problem);
  const included = new Set(includedCategories(anchor));
  if (addons.some((offer) => offer.id === anchor.id || isVenueOffer(offer) ||
      !isCompatiblePartyLocation(mode, offer) ||
      (offer.category && included.has(offer.category)))) {
    throw new PartyApiError(422, "Дополнительная услуга уже входит в пакет или является площадкой");
  }
}
