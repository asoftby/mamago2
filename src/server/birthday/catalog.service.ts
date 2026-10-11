import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { extractPartyDetails, type BirthdayCatalogItem } from "@/features/birthday/builder/lib/realCatalog";

/** Real published offers with approved birthday placement only. No mock results. */
export async function getPublicBirthdayCatalog(citySlug: string): Promise<BirthdayCatalogItem[] | null> {
  const city = await findCityBySlug(citySlug, { select: { id: true }, isActive: true });
  if (!city) return null;
  const offers = await prisma.offer.findMany({
    where: { AND: [
      getPublicPublishedOfferWhere(),
      { place: { cityId: city.id } },
      { productType: { in: ["PARTY_SERVICE", "PARTY_PACKAGE"] } },
      { placements: { some: { key: "BIRTHDAY", status: "APPROVED" } } },
    ] },
    select: {
      id: true, title: true, productType: true, category: true,
      placeId: true, coverImage: true, priceFrom: true, priceMode: true, currency: true,
      ageMinMonths: true, ageMaxMonths: true, minChildren: true, maxChildren: true,
      partyLocationType: true, details: true,
      components: { select: { category: true, isOptional: true } },
      place: { select: { title: true, ownerBusiness: { select: { id: true, name: true } } } },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: 100,
  });
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
      priceFrom: offer.priceFrom !== null && Number.isFinite(offer.priceFrom) && offer.priceFrom >= 0 ? offer.priceFrom : null,
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
