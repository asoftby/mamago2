import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicBirthdayOfferWhere } from "./birthdayOfferVisibility";
import { extractPartyDetails, publicPriceFrom, type BirthdayCatalogItem } from "@/features/birthday/builder/lib/realCatalog";

// Bounded first page only: UI-specific age, guest, budget and location filters
// run later in the builder. A 100-row cap could hide relevant offers before that.
const BIRTHDAY_CATALOG_CAP = 500;

/** Real published offers with approved birthday placement only. No mock results. */
export async function getPublicBirthdayCatalog(citySlug: string): Promise<BirthdayCatalogItem[] | null> {
  const city = await findCityBySlug(citySlug, { select: { id: true }, isActive: true });
  if (!city) return null;
  const offers = await prisma.offer.findMany({
    where: getPublicBirthdayOfferWhere(city.id),
    select: {
      id: true, title: true, productType: true, category: true,
      placeId: true, coverImage: true, priceFrom: true, priceMode: true, currency: true,
      ageMinMonths: true, ageMaxMonths: true, minChildren: true, maxChildren: true,
      partyLocationType: true, details: true,
      components: { select: { category: true, isOptional: true } },
      place: { select: { title: true, ownerBusiness: { select: { id: true, name: true } } } },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: BIRTHDAY_CATALOG_CAP,
  });
  if (offers.length === BIRTHDAY_CATALOG_CAP) {
    // A bounded result may have omitted later offers, even after stable DB filtering.
    console.warn("[birthday/catalog] Offer cap reached; results may be truncated", {
      citySlug, cap: BIRTHDAY_CATALOG_CAP,
    });
  }
  return offers.flatMap((offer): BirthdayCatalogItem[] => {
    if ((offer.productType !== "PARTY_SERVICE" && offer.productType !== "PARTY_PACKAGE") ||
        !offer.placeId || !offer.place?.ownerBusiness) return [];
    if (offer.productType === "PARTY_SERVICE" && !offer.category) return [];
    const details = offer.productType === "PARTY_PACKAGE"
      ? extractPartyDetails(offer.details, offer.components)
      : { includedCategories: [], prepaymentTerms: null, cancellationTerms: null };
    const commonDetails = extractPartyDetails(offer.details, []);
    return [{
      id: offer.id,
      title: offer.title,
      productType: offer.productType,
      category: offer.category,
      placeId: offer.placeId,
      placeTitle: offer.place.title,
      businessId: offer.place.ownerBusiness.id,
      businessName: offer.place.ownerBusiness.name,
      coverImage: offer.coverImage,
      priceFrom: publicPriceFrom(offer.priceMode, offer.priceFrom),
      priceMode: offer.priceMode, currency: offer.currency,
      ageMinMonths: offer.ageMinMonths, ageMaxMonths: offer.ageMaxMonths,
      minChildren: offer.minChildren, maxChildren: offer.maxChildren,
      locationType: offer.partyLocationType,
      includedCategories: details.includedCategories,
      prepaymentTerms: commonDetails.prepaymentTerms,
      cancellationTerms: commonDetails.cancellationTerms,
    }];
  });
}
