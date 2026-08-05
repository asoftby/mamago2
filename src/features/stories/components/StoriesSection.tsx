import { StoryRings } from "./StoryRings";
import { listBreakingNewsArticles } from "../lib/listBreakingNews";
import prisma from "@/lib/prisma";
import { ActivityType, ActivityFormat } from "@prisma/client";
import type { StoryCollection, StoryIntent, StoryItem } from "../types/story";
import {
  getPublicListingActivityWhere,
  getPublicPublishedPlaceWhere,
} from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";
import { stripHtml } from "@/lib/search/sanitizeSearchText";
import { getCityTimeZone } from "@/lib/stories/getCityTimeZone";
import {
  tomorrowRange,
  weekendLabel,
  weekendRange,
  zonedDateKey,
  zonedDayRange,
} from "@/lib/stories/ranges";
import { resolvePlaceLogoUrl } from "@/lib/place/resolvePlaceLogoImage";
import type { DateRange, ResolveContext } from "@/lib/stories/types";

type StoriesSectionProps = {
  cityId: string;
  citySlug: string;
};

const MAX_ITEMS_PER_STORY = 5;
const NEW_PLACES_WINDOW_DAYS = 30;
/** Временно выключено: Place.createdAt пока не даёт честный freshness-сигнал. */
const ENABLE_STORY_NEW_PLACES = false;

function mapFormatToAge(format: ActivityFormat): string | undefined {
  if (format === ActivityFormat.OFFLINE) return "Офлайн";
  if (format === ActivityFormat.ONLINE) return "Онлайн";
  if (format === ActivityFormat.HYBRID) return "Гибрид";
  return undefined;
}

function formatDayTime(date: Date | null | undefined, prefix: string): string {
  if (!date) return prefix;
  return `${prefix}, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

function mapPriceLabel(input: {
  priceFrom: number | null;
  priceTo: number | null;
  priceText: string | null;
}): string | undefined {
  if (input.priceText?.trim()) return input.priceText.trim();
  if (input.priceFrom == null) return undefined;
  if (input.priceTo != null && input.priceTo === input.priceFrom) {
    return formatPrice(input.priceFrom);
  }
  return formatPriceFrom(input.priceFrom);
}

function normalizeStoryDescription(
  ...parts: Array<string | null | undefined>
): string | undefined {
  for (const part of parts) {
    if (!part?.trim()) continue;
    const plain = stripHtml(part)
      .replace(/\s*\n+\s*/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (plain) return plain;
  }
  return undefined;
}

function collectionFromItems(input: {
  id: string;
  intent: StoryIntent;
  title: string;
  emoji?: string;
  items: StoryItem[];
}): StoryCollection | null {
  if (input.items.length === 0) return null;
  return {
    id: input.id,
    intent: input.intent,
    title: input.title,
    emoji: input.emoji,
    items: input.items,
  };
}

async function loadEventsInRange(input: {
  cityId: string;
  citySlug: string;
  range: DateRange;
  eyebrow: string;
  datetimePrefix: string;
}): Promise<StoryItem[]> {
  const now = new Date();
  const pub = getPublicListingActivityWhere(now);
  const pubParts = Array.isArray(pub.AND) ? pub.AND : pub.AND ? [pub.AND] : [];
  const { start, end } = input.range;

  const rows = await prisma.activity.findMany({
    where: {
      AND: [
        { type: ActivityType.EVENT },
        activityInAnyOfCitiesWhere([input.cityId]),
        ...pubParts,
        {
          OR: [
            {
              sessions: {
                some: {
                  startsAt: { gte: start, lt: end },
                },
              },
            },
            {
              nextOccurrenceAt: { gte: start, lt: end },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      format: true,
      shortDesc: true,
      priceFrom: true,
      priceTo: true,
      priceText: true,
      coverImageId: true,
      coverImageUrl: true,
      images: {
        select: { id: true, url: true, mediaAssetId: true },
        orderBy: { sortOrder: "asc" },
      },
      nextOccurrenceAt: true,
      sessions: {
        where: { startsAt: { gte: start, lt: end } },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true },
      },
      place: { select: { title: true, formattedAddr: true } },
      venue: { select: { title: true, addressLine: true } },
    },
    take: 20,
  });

  const withStartTime = rows.map((row) => {
    const sessionStart = row.sessions[0]?.startsAt ?? null;
    const effectiveStart: Date | null = sessionStart ?? row.nextOccurrenceAt;
    return { row, effectiveStart };
  });

  withStartTime.sort((a, b) => {
    if (!a.effectiveStart && !b.effectiveStart) return 0;
    if (!a.effectiveStart) return 1;
    if (!b.effectiveStart) return -1;
    return a.effectiveStart.getTime() - b.effectiveStart.getTime();
  });

  return withStartTime.slice(0, MAX_ITEMS_PER_STORY).map(({ row, effectiveStart }) => ({
    id: row.id,
    offerId: row.id,
    type: "event" as const,
    title: row.title,
    eyebrow: input.eyebrow,
    description: normalizeStoryDescription(row.shortDesc),
    image:
      resolveActivityCoverUrl({
        coverImageId: row.coverImageId,
        coverImageUrl: row.coverImageUrl,
        images: row.images,
      }) ?? "",
    age: mapFormatToAge(row.format),
    location:
      row.venue?.title ??
      row.place?.title ??
      row.venue?.addressLine ??
      row.place?.formattedAddr ??
      undefined,
    datetime: formatDayTime(effectiveStart, input.datetimePrefix),
    price: mapPriceLabel({
      priceFrom: row.priceFrom,
      priceTo: row.priceTo,
      priceText: row.priceText,
    }),
    href: `/${input.citySlug}/events/${row.slug ?? row.id}`,
  }));
}

async function loadNewPlaces(input: {
  cityId: string;
  citySlug: string;
  since: Date;
}): Promise<StoryItem[]> {
  const placeWhere = getPublicPublishedPlaceWhere();
  const places = await prisma.place.findMany({
    where: {
      AND: [
        { cityId: input.cityId },
        { createdAt: { gte: input.since } },
        placeWhere,
      ],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS_PER_STORY,
    select: {
      id: true,
      slug: true,
      title: true,
      shortDesc: true,
      formattedAddr: true,
      displayAddress: true,
      logoImageId: true,
      createdAt: true,
      images: {
        select: { id: true, url: true, kind: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return places.map((place) => {
    const gallery =
      place.images.find((img) => img.kind === "GALLERY")?.url ??
      place.images[0]?.url ??
      "";
    const image =
      resolvePlaceLogoUrl(place.images, place.logoImageId) ?? gallery ?? "";

    return {
      id: place.id,
      offerId: place.id,
      type: "place" as const,
      title: place.title,
      eyebrow: "новое место",
      description: normalizeStoryDescription(place.shortDesc),
      image,
      location: place.displayAddress ?? place.formattedAddr ?? undefined,
      datetime: place.createdAt.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
      }),
      href: `/${input.citySlug}/places/${place.slug ?? place.id}`,
    };
  });
}

export async function StoriesSection({ cityId, citySlug }: StoriesSectionProps) {
  const now = new Date();
  const timeZone = getCityTimeZone(cityId);
  const ctx: ResolveContext = {
    now,
    timeZone,
    cityId,
    hasBreakingNews: false,
  };

  const todayKey = zonedDateKey(now, timeZone);
  const todayRangeValue = zonedDayRange(todayKey, 1, timeZone);
  const tomorrowRangeValue = tomorrowRange(ctx);
  const weekendRangeValue = weekendRange(ctx);

  const newPlacesSince = new Date(now);
  newPlacesSince.setDate(newPlacesSince.getDate() - NEW_PLACES_WINDOW_DAYS);

  const breakingNewsPromise = listBreakingNewsArticles(citySlug).catch((error) => {
    console.error("[StoriesSection] Failed to load breaking news", error);
    return [];
  });

  const [breakingNews, todayItems, tomorrowItems, weekendItems, newPlaceItems] =
    await Promise.all([
      breakingNewsPromise,
      loadEventsInRange({
        cityId,
        citySlug,
        range: todayRangeValue,
        eyebrow: "сегодня",
        datetimePrefix: "Сегодня",
      }),
      loadEventsInRange({
        cityId,
        citySlug,
        range: tomorrowRangeValue,
        eyebrow: "завтра",
        datetimePrefix: "Завтра",
      }),
      weekendRangeValue
        ? loadEventsInRange({
            cityId,
            citySlug,
            range: weekendRangeValue,
            eyebrow: "выходные",
            datetimePrefix: "Выходные",
          })
        : Promise.resolve([]),
      ENABLE_STORY_NEW_PLACES
        ? loadNewPlaces({ cityId, citySlug, since: newPlacesSince })
        : Promise.resolve([]),
    ]);

  const breakingNewsStory: StoryCollection | null =
    breakingNews.length > 0
      ? {
          id: "breaking-news",
          intent: "breaking_news",
          title: "breaking news",
          items: breakingNews.slice(0, 6).map((item) => ({
            id: item.id,
            offerId: item.id,
            type: "breaking-news" as const,
            eyebrow: "BREAKING NEWS",
            title: item.title,
            description: normalizeStoryDescription(item.description, item.excerpt),
            image: item.imageUrl ?? "",
            href: item.href,
            datetime: item.publishedAt
              ? new Date(item.publishedAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : undefined,
          })),
        }
      : null;

  const weekendTitle =
    weekendRangeValue != null
      ? weekendLabel(ctx).toLowerCase() === "следующие выходные"
        ? "след. выходные"
        : "на выходных"
      : "на выходных";

  const stories: StoryCollection[] = [
    breakingNewsStory,
    collectionFromItems({
      id: "today",
      intent: "today",
      title: "сегодня",
      emoji: "☀️",
      items: todayItems,
    }),
    collectionFromItems({
      id: "tomorrow",
      intent: "tomorrow",
      title: "завтра",
      emoji: "🌤️",
      items: tomorrowItems,
    }),
    collectionFromItems({
      id: "weekend",
      intent: "weekend",
      title: weekendTitle,
      emoji: "🎉",
      items: weekendItems,
    }),
    ENABLE_STORY_NEW_PLACES
      ? collectionFromItems({
          id: "new-places",
          intent: "new",
          title: "новые места",
          emoji: "✨",
          items: newPlaceItems,
        })
      : null,
  ].filter((story): story is StoryCollection => story != null);
  if (stories.length === 0) {
    return null;
  }

  return (
    <section aria-label="Stories">
      <div
        className="flex gap-3 overflow-x-auto no-scrollbar px-1 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        <StoryRings stories={stories} />
      </div>
    </section>
  );
}
