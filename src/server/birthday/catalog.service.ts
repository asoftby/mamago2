import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicBirthdayOfferWhere } from "./birthdayOfferVisibility";
import { extractPartyDetails, type BirthdayCatalogItem } from "@/features/birthday/builder/lib/realCatalog";
import { constructorOfferSelect, toConstructorOffer } from "./constructorOffer";
import { isEligibleForConstructor } from "./constructorEligibility";
import { assessConstructorGeography } from "./constructorMatching";

const BIRTHDAY_CATALOG_CAP = 500;
/** Public projection only: no balance, private resource IDs, profile or complete server DTO. */
export async function getPublicBirthdayCatalog(citySlug: string, limit = BIRTHDAY_CATALOG_CAP): Promise<BirthdayCatalogItem[] | null> {
  const city = await findCityBySlug(citySlug,{ select: { id: true }, isActive: true });
  if (!city) return null;
  const destination = await prisma.territoryLegacyMap.findUnique({ where: { legacyKind_legacyId: { legacyKind: "CITY", legacyId: city.id } }, select: { territoryId: true } });
  const result: BirthdayCatalogItem[] = [];
  const unknown: BirthdayCatalogItem[] = [];
  let cursor: string | undefined;
  const cap = Math.min(BIRTHDAY_CATALOG_CAP,Math.max(1,limit));
  while (true) {
    const rows = await prisma.offer.findMany({ where: getPublicBirthdayOfferWhere(null), select: constructorOfferSelect,
      orderBy: { id: "asc" }, take: 200, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!rows.length) break;
    for (const row of rows) {
      if (!isEligibleForConstructor(row.place?.ownerBusiness) || !row.placeId || !row.place?.ownerBusiness) continue;
      let contract;
      try { contract = toConstructorOffer(row); } catch { continue; }
      // Mobile geography remains unknown without structured zones, not the business's city.
      const geography = assessConstructorGeography(contract,destination ? { state: "KNOWN", value: { territoryId: destination.territoryId, placeId: null } } : { state: "UNKNOWN", reason: "NOT_PROVIDED" },"VENUE");
      if (geography === "MISMATCH") continue;
      const details = extractPartyDetails(row.details,row.productType === "PARTY_PACKAGE" ? row.components : []);
      const price = contract.price;
      const target = geography === "MATCH" ? result : unknown;
      if (target.length >= cap) continue;
      target.push({
        id: row.id, slug: row.slug, title: row.title, productType: contract.productType, category: row.category,
        placeId: row.placeId, placeTitle: row.place.title, businessId: row.place.ownerBusiness.id, businessName: row.place.ownerBusiness.name,
        coverImage: row.coverImage, priceMode: row.priceMode, currency: row.currency,
        geographyCompatibility: geography,
        priceResolution: price.state, priceFrom: price.state === "RESOLVED" && price.price.kind !== "ON_REQUEST" ? Number(price.price.kind === "EXACT" ? price.price.amountByn : price.price.minimumByn) : null,
        agePolicy: row.agePolicy, ageMinMonths: row.ageMinMonths, ageMaxMonths: row.ageMaxMonths,
        interestSlugs: row.interestSlugs, performerRole: contract.performerRole?.state === "KNOWN" ? contract.performerRole.value : null,
        durationMinutes: contract.durationMinutes.state === "KNOWN" ? contract.durationMinutes.value : null,
        components: row.components.map(c => ({ id: c.id, title: c.title, category: c.category, isOptional: c.isOptional })), minChildren: row.minChildren, maxChildren: row.maxChildren, locationType: row.partyLocationType,
        ...details,
      });

    }
    cursor = rows[rows.length-1].id;
    if (rows.length < 200) break;
  }
  return [...result,...unknown].slice(0,cap);
}
