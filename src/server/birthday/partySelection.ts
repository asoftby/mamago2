import type { OfferForConstructor } from "@/lib/birthday/constructorContract";
import type { AgePolicy } from "@prisma/client";
import { birthdayAgeCompatibility, birthdayParticipantsCompatibility, birthdayLocationCompatibility } from "@/lib/birthday/compatibility";
import { extractPartyDetails } from "@/features/birthday/builder/lib/realCatalog";
import { PartyCategory, type OfferProductType, type PartyLocationType, type Prisma } from "@prisma/client";
import { PartyApiError } from "./partyDraft.validation";

export type CatalogOffer = {
  id: string;
  productType: OfferProductType | null;
  category: PartyCategory | null;
  partyLocationType: PartyLocationType | null;
  constructorPrice?: OfferForConstructor["price"];
  priceFrom: number | null;
  priceMode: string;
  currency: string;
  details: Prisma.JsonValue | null;
  components: { category: PartyCategory; isOptional: boolean }[];
  place: { ownerBusinessId: string | null } | null;
  agePolicy?: AgePolicy;
  ageMinMonths?: number | null;
  ageMaxMonths?: number | null;
  minChildren?: number | null;
  maxChildren?: number | null;
};

export type PartyRequirementOffer = Pick<
  CatalogOffer, "agePolicy" | "ageMinMonths" | "ageMaxMonths" | "minChildren" | "maxChildren"
> & { title?: string | null };

/**
 * Server-side twin of the builder filters: guest count against the offer's capacity and,
 * when the parent gave it, the child's age. Age is stored in whole years, so a year
 * covers months 12Y..12Y+11 and only a range entirely outside the offer is rejected.
 */
export function partyRequirementsProblem(
  offer: PartyRequirementOffer, party: { childrenCount: number; childAge: number | null },
): string | null {
  const name = offer.title ? "«" + offer.title + "»" : "Выбранная услуга";
  if (birthdayParticipantsCompatibility({ minChildren: offer.minChildren ?? null, maxChildren: offer.maxChildren ?? null },
    { childrenMin: party.childrenCount, childrenMax: party.childrenCount }) === "MISMATCH") return name + (offer.minChildren != null && party.childrenCount < offer.minChildren ? " рассчитана минимум на " + offer.minChildren + " детей" : " рассчитана максимум на " + offer.maxChildren + " детей");
  const policy = offer.agePolicy ?? (offer.ageMinMonths != null || offer.ageMaxMonths != null ? "SPECIFIC" : "UNKNOWN");
  if (birthdayAgeCompatibility({ agePolicy: policy, ageMinMonths: offer.ageMinMonths ?? null, ageMaxMonths: offer.ageMaxMonths ?? null },
    party.childAge === null ? undefined : { min: party.childAge * 12, max: party.childAge * 12 + 11 },
    party.childAge === null ? "UNKNOWN" : party.childAge >= 18 ? "ADULT" : "CHILD") === "MISMATCH") return name + " не подходит по возрасту ребёнка";

  return null;
}

export function isVenueOffer(offer: CatalogOffer): boolean {
  return offer.productType === "PARTY_PACKAGE" || offer.category === "VENUE";
}

type PartyMode = "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";

export function isCompatiblePartyLocation(mode: PartyMode, offer: CatalogOffer): boolean {
  return birthdayLocationCompatibility({ ...offer, locationType: offer.partyLocationType },mode) !== "MISMATCH";
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
    if (offer.partyLocationType === "OFF_SITE") return "Основная услуга не подходит по месту проведения";
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
  return extractPartyDetails(offer.details, offer.components).includedCategories;
}

/** Offers declared "on request" may carry a stale number; only a real price is snapshotted. */
export function offerPriceSnapshot(offer: Pick<CatalogOffer, "priceFrom" | "priceMode" | "currency" | "constructorPrice">): number | null {
  const canonical = "constructorPrice" in offer ? offer.constructorPrice : undefined;
  if (canonical) return canonical.state === "RESOLVED" && canonical.price.kind === "EXACT" ? Number(canonical.price.amountByn) : null;
  if (offer.currency !== "BYN") return null;
  if (offer.priceMode === "FREE") return 0;
  if (offer.priceMode === "ON_REQUEST" || offer.priceMode === "NONE" || offer.priceMode === "UNKNOWN" || offer.priceMode === "FROM" || offer.priceMode === "RANGE") return null;
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
