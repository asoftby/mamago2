import type { BirthdayCatalogItem, PartyCategoryKey } from "./realCatalog";
import type { PlaceType } from "../types/builder";

/** Published offers are the only permissible selections. Never revive prototype IDs. */
export function selectedCatalogOffers(
  offers: readonly BirthdayCatalogItem[],
  baseId: string | null,
  addonIds: readonly string[],
): BirthdayCatalogItem[] {
  const ids = new Set([baseId, ...addonIds].filter((id): id is string => Boolean(id)));
  return offers.filter((offer) => ids.has(offer.id));
}

export function isVenueOffer(offer: BirthdayCatalogItem): boolean {
  return offer.productType === "PARTY_PACKAGE" || offer.category === "VENUE";
}

/**
 * Match the party's location to where the business can deliver its offer.
 * Missing legacy location data stays discoverable; base eligibility handles
 * the stricter rule for unverified off-site packages.
 */
export function isLocationCompatible(
  offer: Pick<BirthdayCatalogItem, "locationType">,
  placeType: PlaceType | null,
): boolean {
  if (placeType == null || offer.locationType == null) return true;
  if (offer.locationType === "BOTH") return true;
  const onSite = placeType === "VENUE" || placeType === "PACKAGE";
  return offer.locationType === (onSite ? "ON_SITE" : "OFF_SITE");
}

export function isAllowedBase(offer: BirthdayCatalogItem, placeType: PlaceType | null): boolean {
  if (!isLocationCompatible(offer, placeType)) return false;
  if (placeType == null) return true;
  if (placeType === "VENUE" || placeType === "PACKAGE") return isVenueOffer(offer);
  // A mobile party package can anchor a home/outdoor celebration; an untyped
  // legacy package must not be assumed mobile.
  if (offer.productType === "PARTY_PACKAGE") {
    return offer.locationType === "OFF_SITE" || offer.locationType === "BOTH";
  }
  return !isVenueOffer(offer);
}

export function hasValidCatalogAnchor(
  offers: readonly BirthdayCatalogItem[],
  baseId: string | null,
  placeType: PlaceType | null,
): boolean {
  const base = offers.find((offer) => offer.id === baseId);
  return Boolean(base && isAllowedBase(base, placeType));
}

export function includedPackageCategories(
  offers: readonly BirthdayCatalogItem[],
  baseId: string | null,
): Set<PartyCategoryKey> {
  const base = offers.find((offer) => offer.id === baseId);
  return new Set(base?.productType === "PARTY_PACKAGE" ? base.includedCategories : []);
}

/** Included components cannot be charged a second time in the MVP. */
export function eligibleAddons(
  offers: readonly BirthdayCatalogItem[],
  baseId: string | null,
  placeType: PlaceType | null,
): BirthdayCatalogItem[] {
  const included = includedPackageCategories(offers, baseId);
  return offers.filter((offer) =>
    !isVenueOffer(offer) &&
    isLocationCompatible(offer, placeType) &&
    offer.id !== baseId &&
    (placeType === "VENUE" || placeType === "PACKAGE" || placeType === "HOME" || placeType === "OUTDOOR") &&
    (offer.category == null || !included.has(offer.category))
  );
}

/** Calculate a persisted selection after the party format or available offers change. */
export function compatibleCatalogSelection(
  offers: readonly BirthdayCatalogItem[],
  baseId: string | null,
  placeType: PlaceType | null,
  selectedAddonIds: readonly string[],
): { selectedBaseId: string | null; selectedAddonIds: string[] } {
  const selectedBaseId = hasValidCatalogAnchor(offers, baseId, placeType) ? baseId : null;
  return {
    selectedBaseId,
    selectedAddonIds: selectedBaseId
      ? compatibleAddonIds(offers, selectedBaseId, placeType, selectedAddonIds)
      : [],
  };
}

/** Lower bound only; an unknown price must never be displayed as zero. */
export function catalogPriceSummary(offers: readonly BirthdayCatalogItem[]) {
  return {
    minimumByn: offers.reduce((sum, offer) => sum + (offer.currency === "BYN" ? (offer.priceFrom ?? 0) : 0), 0),
    hasUnknownPrices: offers.some((offer) => offer.priceFrom == null || offer.currency !== "BYN"),
  };
}

/** Price text that respects how the business declared the price. Unknown never reads as zero. */
export function catalogPriceLabel(offer: Pick<BirthdayCatalogItem, "priceFrom" | "priceMode" | "currency">): string {
  if (offer.priceMode === "FREE") return "Бесплатно";
  if (offer.priceFrom == null) return "Цена по запросу";
  const amount = offer.priceFrom.toLocaleString("ru-RU") + " " + offer.currency;
  return offer.priceMode === "EXACT" ? amount : "От " + amount;
}

/** Selected add-ons that are still allowed for the current base; the rest must leave the saved selection. */
export function compatibleAddonIds(
  offers: readonly BirthdayCatalogItem[],
  baseId: string | null,
  placeType: PlaceType | null,
  selectedAddonIds: readonly string[],
): string[] {
  const allowed = new Set(eligibleAddons(offers, baseId, placeType).map((offer) => offer.id));
  return selectedAddonIds.filter((id) => allowed.has(id));
}
