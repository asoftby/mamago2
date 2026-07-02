import type { PrismaClient } from "@prisma/client";
import { SEARCH_BOOST } from "@/lib/search/constants";
import { offerMetaLine } from "@/lib/search/metaLines";
import { buildSearchText, summarizeForSearchCard } from "@/lib/search/sanitizeSearchText";
import type { SearchDocUpsertFields } from "./buildActivityDocument";

export async function buildOfferDocument(
  db: PrismaClient,
  offerId: string,
): Promise<SearchDocUpsertFields | null> {
  const offer = await db.offer.findUnique({
    where: { id: offerId },
    include: {
      place: {
        select: {
          title: true,
          archivedAt: true,
          city: { select: { name: true } },
        },
      },
    },
  });

  if (!offer || offer.archivedAt || offer.place.archivedAt) return null;

  const searchText = buildSearchText([
    offer.title,
    offer.description,
    offer.promoTitle,
    offer.promoDescription,
    offer.place.title,
    offer.place.city?.name,
  ]);

  const metaLine = offerMetaLine({
    priceText: offer.priceText,
    priceFrom: offer.priceFrom,
    placeCity: offer.place.city?.name,
    placeTitle: offer.place.title,
  });

  const summaryLine = summarizeForSearchCard(
    offer.promoTitle ?? offer.promoDescription ?? offer.description,
  );

  const slug = offer.slug?.trim();
  const urlPath = slug ? `/offers/${slug}` : `/offers/${offer.id}`;
  const isPublished = offer.status === "PUBLISHED" && Boolean(slug);

  return {
    entityType: "offer",
    entityId: offer.id,
    title: offer.title,
    searchText: searchText || offer.title,
    summaryLine,
    metaLine,
    imageUrl: offer.coverImage,
    urlPath,
    isPublished,
    boost: SEARCH_BOOST.offer,
  };
}
