import type { ActivityFormat } from "@prisma/client";
import { normalizePricingMode } from "@/components/business/wizard/event/pricingMode";
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

/** «от» только для режима «цена от»; фикс — без префикса. */
function discoveryCardPriceUsesOtPrefix(a: {
  scheduleJson: unknown;
  priceText: string | null;
  priceFrom: number | null;
  priceTo: number | null;
}): boolean {
  const sj = a.scheduleJson as Record<string, unknown> | null | undefined;
  const mode = normalizePricingMode(sj?.pricingMode, {
    priceText: a.priceText,
    priceFrom: a.priceFrom,
    priceTo: a.priceTo,
  });
  return mode === "from";
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
  priceFrom: number | null;
  priceTo: number | null;
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
  eventCategory: { nameRu: string } | null;
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
  const { ageFrom, ageTo } = ageBoundsFromActivityFields(a);
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

  const sj = a.scheduleJson as Record<string, unknown> | null | undefined;
  const pricingMode = normalizePricingMode(sj?.pricingMode, {
    priceText: a.priceText,
    priceFrom: a.priceFrom,
    priceTo: a.priceTo,
  });
  const priceMinFromText = (() => {
    if (!a.priceText) return undefined;
    const m = a.priceText.replace(",", ".").match(/\d+(?:\.\d+)?/);
    const n = m ? parseFloat(m[0]) : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  })();
  const priceMin =
    a.priceFrom != null && !Number.isNaN(a.priceFrom)
      ? a.priceFrom
      : pricingMode === "free"
        ? 0
        : pricingMode === "from" || pricingMode === "fixed"
          ? priceMinFromText
          : undefined;

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
    priceMin,
    priceMax: a.priceTo != null ? a.priceTo : undefined,
    priceListUsesOt: discoveryCardPriceUsesOtPrefix({
      scheduleJson: a.scheduleJson,
      priceText: a.priceText,
      priceFrom: a.priceFrom,
      priceTo: a.priceTo,
    }),
    priceDetails: a.priceDetails ?? undefined,
    currency: "BYN",
    dateStart,
    dateEnd,
    district: undefined,
    tags: tagsFromSchedule(a.nextOccurrenceAt ?? a.sessions[0]?.startsAt ?? null),
    badge: a.eventCategory?.nameRu ?? (ownerFirst ? "Моё событие" : "Событие"),
    geoBadge,
    engagementScore,
    reviewsCount: 0,
  };
}
