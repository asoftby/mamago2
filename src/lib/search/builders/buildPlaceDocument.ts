import type { PrismaClient } from "@prisma/client";
import { SEARCH_BOOST } from "@/lib/search/constants";
import { placeMetaLine } from "@/lib/search/metaLines";
import { buildSearchText } from "@/lib/search/sanitizeSearchText";
import type { SearchDocUpsertFields } from "./buildActivityDocument";

export async function buildPlaceDocument(
  db: PrismaClient,
  placeId: string,
): Promise<SearchDocUpsertFields | null> {
  const place = await db.place.findUnique({
    where: { id: placeId },
    include: {
      city: { select: { name: true } },
      districtManual: { select: { name: true } },
      images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
  });

  if (!place) return null;

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
    districtName: place.districtManual?.name,
    shortAddress: place.shortAddress,
    formattedAddr: place.formattedAddr,
  });

  const slug = place.slug?.trim();
  const urlPath = slug ? `/places/${slug}` : `/places/${place.id}`;
  const isPublished = place.status === "PUBLISHED" && Boolean(slug);

  return {
    entityType: "place",
    entityId: place.id,
    title: place.title,
    searchText: searchText || place.title,
    metaLine,
    imageUrl: place.images[0]?.url ?? null,
    urlPath,
    isPublished,
    boost: SEARCH_BOOST.place,
  };
}
