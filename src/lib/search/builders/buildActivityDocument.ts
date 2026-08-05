import type { PrismaClient, SearchEntityType } from "@prisma/client";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { SEARCH_BOOST } from "@/lib/search/constants";
import { activityAddressLine, activityMetaLine, resolveActivityAgeLabel } from "@/lib/search/metaLines";
import { buildSearchText } from "@/lib/search/sanitizeSearchText";
import { normalizeRichTextCurrency } from "@/lib/formatters/format-price";

export type SearchDocUpsertFields = {
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  searchText: string;
  summaryLine: string | null;
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
          shortAddress: true,
          formattedAddr: true,
          displayAddress: true,
          customAddress: true,
          city: { select: { name: true, slug: true } },
        },
      },
      venue: {
        select: {
          title: true,
          addressLine: true,
          place: {
            select: {
              title: true,
              shortAddress: true,
              formattedAddr: true,
              displayAddress: true,
              customAddress: true,
            },
          },
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
  const venuePlace = activity.venue?.place;

  const programNames = activity.programCategoryLinks.map((l) => l.category.nameRu);
  const filterLabels = activity.filterOptions.map((f) => f.filterOption.label);

  const addressLine = activityAddressLine({
    venueTitle: activity.venue?.title,
    venueAddressLine: activity.venue?.addressLine,
    placeTitle: venuePlace?.title ?? activity.place?.title,
    placeShortAddress: venuePlace?.shortAddress ?? activity.place?.shortAddress,
    placeFormattedAddr: venuePlace?.formattedAddr ?? activity.place?.formattedAddr,
    placeDisplayAddress: venuePlace?.displayAddress ?? activity.place?.displayAddress,
    placeCustomAddress: venuePlace?.customAddress ?? activity.place?.customAddress,
    cityName,
  });

  const searchText = buildSearchText([
    activity.title,
    activity.shortDesc,
    activity.description,
    activity.priceText,
    // plain-text канал (поисковый индекс/SEO-сниппет): валюта как текст "BYN",
    // иначе в индекс попадёт PUA-тофу из старых не пересохранённых записей.
    normalizeRichTextCurrency(activity.priceDetails),
    activity.ageLabel,
    ...activity.ageTags,
    activity.eventCategory?.nameRu,
    ...programNames,
    ...filterLabels,
    activity.place?.title,
    activity.venue?.title,
    activity.venue?.addressLine,
    addressLine,
    cityName,
    activity.metroStation?.name,
  ]);

  const metaLine = activityMetaLine({
    nextOccurrenceAt: activity.nextOccurrenceAt,
    ageLabel: resolveActivityAgeLabel({
      ageLabel: activity.ageLabel,
      ageTags: activity.ageTags,
      ageMinMonths: activity.ageMinMonths,
      ageMaxMonths: activity.ageMaxMonths,
    }),
    priceFrom: activity.priceFrom,
    currency: activity.currency,
    priceText: activity.priceText,
  });

  const urlPath = publicActivityPath(activity.id, citySlugForPath ?? activity.cityId, activity.slug);

  const isPublished = activity.status === "PUBLISHED";

  return {
    entityType: "activity",
    entityId: activity.id,
    title: activity.title,
    searchText: searchText || activity.title,
    summaryLine: addressLine,
    metaLine,
    imageUrl: activity.coverImageUrl,
    urlPath,
    isPublished,
    boost: SEARCH_BOOST.activity,
  };
}
