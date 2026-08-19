import type { PrismaClient } from "@prisma/client";
import { SEARCH_BOOST } from "@/lib/search/constants";
import { placeMetaLine } from "@/lib/search/metaLines";
import { buildSearchText, summarizeForSearchCard } from "@/lib/search/sanitizeSearchText";
import { buildCityPublicPath } from "@/lib/routing/cityPaths";
import type { SearchDocUpsertFields } from "./buildActivityDocument";

export async function buildPlaceDocument(
  db: PrismaClient,
  placeId: string,
): Promise<SearchDocUpsertFields | null> {
  const place = await db.place.findUnique({
    where: { id: placeId },
    include: {
      city: { select: { name: true, slug: true } },
      districtManual: { select: { name: true } },
      images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
  });

  if (!place || place.archivedAt) return null;

  const searchText = buildSearchText([
    place.title,
    place.shortDesc,
    place.description,
    place.category,
    place.customAddress,
    place.shortAddress,
    place.formattedAddr,
    ...place.activityTypes,
    ...place.ageTags,
    ...place.visitFormats,
    place.city?.name,
    place.districtManual?.name,
  ]);

  const metaLine = placeMetaLine({
    cityName: place.city?.name,
    shortAddress: place.shortAddress,
    formattedAddr: place.formattedAddr,
    customAddress: place.customAddress,
    floor: place.floor,
    unit: place.unit,
    unitLabel: place.unitLabel,
  });

  const slug = place.slug?.trim();
  const urlPath = place.city?.slug
    ? buildCityPublicPath({ citySlug: place.city.slug, type: "place", slug: slug || place.id })
    : `/places/${slug || place.id}`;
  const isPublished = place.status === "PUBLISHED" && Boolean(slug);

  return {
    entityType: "place",
    entityId: place.id,
    title: place.title,
    searchText: searchText || place.title,
    summaryLine: summarizeForSearchCard(place.shortDesc),
    metaLine,
    imageUrl: place.images[0]?.url ?? null,
    urlPath,
    isPublished,
    boost: SEARCH_BOOST.place,
  };
}
