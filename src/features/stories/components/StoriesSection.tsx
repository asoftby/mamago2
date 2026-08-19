import { StoryRings } from "./StoryRings";
import { listBreakingNewsArticles } from "../lib/listBreakingNews";
import prisma from "@/lib/prisma";
import type { StoryCollection, StoryIntent, StoryItem } from "../types/story";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
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
import {
  listPublicFreeHomeStoryItems,
  listPublicHomeStoryItems,
  MAX_HOME_STORY_ITEMS_PER_DATE,
} from "@/server/stories/homeStoryItems";
import { getPublicStoryIntentConfigs } from "@/server/stories/storyIntentConfig";

type StoriesSectionProps = {
  cityId: string;
  citySlug: string;
};

const MAX_ITEMS_PER_STORY = 5;
const NEW_PLACES_WINDOW_DAYS = 30;
/** Временно выключено: Place.createdAt пока не даёт честный freshness-сигнал. */
const ENABLE_STORY_NEW_PLACES = false;

function formatDayTime(date: Date | null | undefined, prefix: string): string {
  if (!date) return prefix;
  return `${prefix}, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
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
  const projectionEnd = weekendRangeValue?.end ?? tomorrowRangeValue.end;
  const freeRangeValue = zonedDayRange(todayKey, 7, timeZone);

  const newPlacesSince = new Date(now);
  newPlacesSince.setDate(newPlacesSince.getDate() - NEW_PLACES_WINDOW_DAYS);

  const breakingNewsPromise = listBreakingNewsArticles(citySlug).catch((error) => {
    console.error("[StoriesSection] Failed to load breaking news", error);
    return [];
  });

  const [breakingNews, projectedItems, freeProjectedItems, newPlaceItems, intentConfigs] =
    await Promise.all([
      breakingNewsPromise,
      listPublicHomeStoryItems({ cityId, from: todayRangeValue.start, until: projectionEnd, now }),
      listPublicFreeHomeStoryItems({ cityId, from: freeRangeValue.start, until: freeRangeValue.end, now }),
      ENABLE_STORY_NEW_PLACES
        ? loadNewPlaces({ cityId, citySlug, since: newPlacesSince })
        : Promise.resolve([]),
      getPublicStoryIntentConfigs(),
    ]);

  const mapProjected = (range: DateRange, eyebrow: string, prefix: string): StoryItem[] =>
    projectedItems
      .filter((item) => item.storyDate >= range.start && item.storyDate < range.end)
      .slice(0, MAX_HOME_STORY_ITEMS_PER_DATE)
      .map((item) => ({
        id: item.id,
        offerId: item.id,
        type: item.sourceType === "OFFER" ? "offer" : "event",
        title: item.titleSnapshot,
        description: normalizeStoryDescription(item.subtitleSnapshot),
        image: item.coverUrlSnapshot ?? "",
        eyebrow,
        datetime: formatDayTime(item.startsAt, prefix),
        href: item.hrefSnapshot,
      }));
  const todayItems = mapProjected(todayRangeValue, "сегодня", "Сегодня");
  const tomorrowItems = mapProjected(tomorrowRangeValue, "завтра", "Завтра");
  const weekendItems = weekendRangeValue
    ? mapProjected(weekendRangeValue, "выходные", "Выходные")
    : [];
  const freeItems: StoryItem[] = freeProjectedItems.map((item) => ({
    id: item.id,
    offerId: item.id,
    type: "event",
    title: item.titleSnapshot,
    description: normalizeStoryDescription(item.subtitleSnapshot),
    image: item.coverUrlSnapshot ?? "",
    eyebrow: "бесплатно",
    datetime: formatDayTime(item.startsAt, "Ближайшее"),
    href: item.hrefSnapshot,
  }));

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

  const intentConfigByKey = new Map(intentConfigs.map((config) => [config.intent, config]));
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
    collectionFromItems({
      id: "free",
      intent: "free",
      title: "бесплатно",
      emoji: "🎟️",
      items: freeItems,
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
  ]
    .filter((story): story is StoryCollection => story != null)
    .filter((story) => intentConfigByKey.get(story.intent)?.enabled !== false)
    .map((story) => ({ ...story, title: intentConfigByKey.get(story.intent)?.title || story.title }))
    .sort((a, b) => (intentConfigByKey.get(a.intent)?.order ?? 999) - (intentConfigByKey.get(b.intent)?.order ?? 999));
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
