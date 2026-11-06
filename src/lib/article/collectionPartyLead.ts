import type { OfferProductType, PartyCategory, PartyLocationType } from "@prisma/client";
import { partyAnchorProblem, type CatalogOffer } from "@/server/birthday/partySelection";

export type CollectionPartyMode = "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";

/** Данные оффера, по которым решается, можно ли оставить заявку на праздник прямо из подборки. */
export type CollectionPartyOffer = {
  id: string;
  productType: OfferProductType | null;
  category: PartyCategory | null;
  partyLocationType: PartyLocationType | null;
  hasApprovedBirthdayPlacement: boolean;
  ownerBusinessId: string | null;
};

export type CollectionPartyLead = {
  mode: CollectionPartyMode;
  citySlug: string;
  minChildren: number | null;
  maxChildren: number | null;
};

/**
 * Режим праздника для оффера или `null`, если оффер не может быть основной услугой Party-потока.
 * Правила не дублируются: допустимость проверяет та же `partyAnchorProblem`, что и сервер отправки.
 */
export function deriveCollectionPartyMode(offer: CollectionPartyOffer): CollectionPartyMode | null {
  if (!offer.hasApprovedBirthdayPlacement || !offer.ownerBusinessId) return null;
  if (offer.productType !== "PARTY_PACKAGE" && offer.productType !== "PARTY_SERVICE") return null;
  const candidate = {
    id: offer.id,
    productType: offer.productType,
    category: offer.category,
    partyLocationType: offer.partyLocationType,
  } as unknown as CatalogOffer;
  const order: CollectionPartyMode[] = offer.productType === "PARTY_PACKAGE" ? ["PACKAGE", "HOME"] : ["VENUE", "HOME"];
  return order.find((mode) => partyAnchorProblem(mode, candidate) === null) ?? null;
}
