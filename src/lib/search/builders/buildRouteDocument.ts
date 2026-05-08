import type { PrismaClient } from "@prisma/client";
import { SEARCH_BOOST } from "@/lib/search/constants";
import { routeMetaLine } from "@/lib/search/metaLines";
import { buildSearchText, summarizeForSearchCard } from "@/lib/search/sanitizeSearchText";
import type { SearchDocUpsertFields } from "./buildActivityDocument";

export async function buildRouteDocument(
  db: PrismaClient,
  routeId: string,
): Promise<SearchDocUpsertFields | null> {
  const route = await db.route.findUnique({
    where: { id: routeId },
    include: {
      city: { select: { name: true } },
    },
  });

  if (!route) return null;

  const searchText = buildSearchText([
    route.title,
    ...route.ageTags,
    route.city?.name,
  ]);

  const metaLine = routeMetaLine(route.city?.name);
  const summaryLine = summarizeForSearchCard(route.seoDescription);
  const urlPath = `/routes/${route.slug}`;
  const isPublished = route.status === "PUBLISHED" && route.visibility === "PUBLIC";

  return {
    entityType: "route",
    entityId: route.id,
    title: route.title,
    searchText: searchText || route.title,
    summaryLine,
    metaLine,
    imageUrl: route.coverImageUrl,
    urlPath,
    isPublished,
    boost: SEARCH_BOOST.route,
  };
}
