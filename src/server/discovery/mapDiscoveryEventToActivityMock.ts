import type { ActivityFormat, PublicationPriceMode } from "@prisma/client";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import { ageBoundsFromActivityFields } from "@/lib/event/activityAgeBounds";
import type { ActivityMock } from "@/types/activity";

/** Мин/макс по сессиям и nextOccurrence — для подписи «4–5 апр.» / «4 апр.–5 мар.». */
function discoveryCardDatesFromActivity(a: {
  nextOccurrenceAt: Date | null;
  sessions: { startsAt: Date }[];
}): { dateStart?: string; dateEnd?: string } {
  const times: number[] = [];
  for (const s of a.sessions) {
    times.push(s.startsAt.getTime());
  }
  if (a.nextOccurrenceAt) times.push(a.nextOccurrenceAt.getTime());
  if (times.length === 0) return {};
  const min = Math.min(...times);
  const max = Math.max(...times);
  const start = new Date(min);
  const end = new Date(max);
  const ds = start.toISOString();
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return { dateStart: ds };
  }
  return { dateStart: ds, dateEnd: end.toISOString() };
}

function tagsFromSchedule(next: Date | null): string[] {
  if (!next) return [];
  const d = new Date(next);
  const day = d.getDay();
  const tags: string[] = [];
  if (day === 0 || day === 6) tags.push("weekend");
  else tags.push("today");
  return tags;
}

function resolveListingCityIdForKudaBadge(a: {
  cityId: string | null;
  place: { cityId: string | null } | null;
  venue: { cityId: string | null } | null;
}): string | null {
  return a.venue?.cityId ?? a.place?.cityId ?? a.cityId ?? null;
}

export type DiscoveryEventCardRow = {
  id: string;
  slug: string | null;
  title: string;
  shortDesc: string;
  ageTags: string[];
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  agePolicy: import("@prisma/client").AgePolicy;
  priceFrom: number | null;
  priceTo: number | null;
  priceMode: PublicationPriceMode;
  priceText: string | null;
  currency: string | null;
  priceDetails: string | null;
  scheduleJson: unknown;
  coverImageId: string | null;
  coverImageUrl: string | null;
  nextOccurrenceAt: Date | null;
  ownerUserId: string;
  format: ActivityFormat;
  cityId: string | null;
  place: { cityId: string | null; city: { slug: string } | null } | null;
  venue: { cityId: string | null } | null;
  eventCategory: { nameRu: string; slug: string } | null;
  images: Array<{ id: string; url: string; mediaAssetId: string | null }>;
  sessions: Array<{ startsAt: Date }>;
};

export type MapDiscoveryEventToActivityMockOptions = {
  ownerFirst: boolean;
  hubPrimaryCityId: string;
  engagementScore: number;
  citySlugById: Map<string, string>;
};

/** Единый маппер карточки события для ленты «Куда» и афиши места. */
export function mapDiscoveryEventToActivityMock(
  a: DiscoveryEventCardRow,
  options: MapDiscoveryEventToActivityMockOptions,
): ActivityMock {
  const { ownerFirst, hubPrimaryCityId, engagementScore, citySlugById } = options;
  const derivedAgeBounds = ageBoundsFromActivityFields(a);
  const { ageFrom, ageTo } = a.agePolicy === "ADULT_ONLY"
    ? { ageFrom: 18, ageTo: 99 }
    : derivedAgeBounds;
  const cover =
    resolveActivityCoverUrl({
      coverImageId: a.coverImageId,
      coverImageUrl: a.coverImageUrl,
      images: a.images,
    }) ?? "";
  const { dateStart, dateEnd } = discoveryCardDatesFromActivity({
    nextOccurrenceAt: a.nextOccurrenceAt,
    sessions: a.sessions,
  });

  const listingCityId = resolveListingCityIdForKudaBadge(a);
  const geoBadge =
    listingCityId && listingCityId !== hubPrimaryCityId ? "За городом" : undefined;
  const citySlug =
    a.place?.city?.slug ??
    (listingCityId ? (citySlugById.get(listingCityId) ?? null) : null);

  return {
    id: a.id,
    slug: a.slug,
    citySlug,
    format: a.format,
    type: "EVENT_FIXED",
    discoveryIntent: "kuda",
    title: a.title,
    description: a.shortDesc,
    image: cover,
    coverMediaId: a.coverImageId,
    ageFrom,
    ageTo,
    agePolicy: a.agePolicy,
    priceMin: a.priceFrom ?? undefined,
    priceMax: a.priceTo != null ? a.priceTo : undefined,
    priceMode: a.priceMode,
    priceDetails: a.priceDetails ?? undefined,
    currency: "BYN",
    dateStart,
    dateEnd,
    district: undefined,
    tags: tagsFromSchedule(a.nextOccurrenceAt ?? a.sessions[0]?.startsAt ?? null),
    badge: a.eventCategory?.nameRu ?? (ownerFirst ? "Моё событие" : "Событие"),
    eventCategorySlug: a.eventCategory?.slug ?? null,
    geoBadge,
    engagementScore,
    reviewsCount: 0,
  };
}
