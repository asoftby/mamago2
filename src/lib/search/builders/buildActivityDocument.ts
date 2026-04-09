import type { PrismaClient, SearchEntityType } from "@prisma/client";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { SEARCH_BOOST } from "@/lib/search/constants";
import { activityMetaLine } from "@/lib/search/metaLines";
import { buildSearchText } from "@/lib/search/sanitizeSearchText";

export type SearchDocUpsertFields = {
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  searchText: string;
  metaLine: string;
  imageUrl: string | null;
  urlPath: string;
  isPublished: boolean;
  boost: number;
};

export async function buildActivityDocument(
  db: PrismaClient,
  activityId: string,
): Promise<SearchDocUpsertFields | null> {
  const activity = await db.activity.findUnique({
    where: { id: activityId },
    include: {
      place: {
        select: {
          title: true,
          city: { select: { name: true, slug: true } },
        },
      },
      eventCategory: { select: { nameRu: true } },
      programCategoryLinks: {
        include: { category: { select: { nameRu: true } } },
      },
      filterOptions: {
        include: { filterOption: { select: { label: true } } },
      },
      metroStation: { select: { name: true } },
    },
  });

  if (!activity) return null;

  const cityRow = activity.cityId
    ? await db.city.findUnique({
        where: { id: activity.cityId },
        select: { name: true, slug: true },
      })
    : null;

  const cityName = cityRow?.name ?? activity.place?.city?.name ?? null;
  const citySlugForPath = cityRow?.slug ?? activity.place?.city?.slug ?? null;

  const programNames = activity.programCategoryLinks.map((l) => l.category.nameRu);
  const filterLabels = activity.filterOptions.map((f) => f.filterOption.label);

  const searchText = buildSearchText([
    activity.title,
    activity.shortDesc,
    activity.description,
    activity.priceText,
    activity.priceDetails,
    activity.ageLabel,
    ...activity.ageTags,
    activity.eventCategory?.nameRu,
    ...programNames,
    ...filterLabels,
    activity.place?.title,
    cityName,
    activity.metroStation?.name,
  ]);

  const metaLine = activityMetaLine({
    nextOccurrenceAt: activity.nextOccurrenceAt,
    ageLabel: activity.ageLabel,
    priceFrom: activity.priceFrom,
    currency: activity.currency,
  });

  const urlPath = publicActivityPath(activity.id, citySlugForPath ?? activity.cityId, activity.slug);

  const isPublished = activity.status === "PUBLISHED";

  return {
    entityType: "activity",
    entityId: activity.id,
    title: activity.title,
    searchText: searchText || activity.title,
    metaLine,
    imageUrl: activity.coverImageUrl,
    urlPath,
    isPublished,
    boost: SEARCH_BOOST.activity,
  };
}
