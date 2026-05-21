import { StoryRings } from "./StoryRings";
import { listBreakingNewsArticles } from "../lib/listBreakingNews";
import prisma from "@/lib/prisma";
import { ActivityType, ActivityFormat } from "@prisma/client";
import type { StoryCollection } from "../types/story";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";
import { stripHtml } from "@/lib/search/sanitizeSearchText";

type StoriesSectionProps = {
  cityId: string;
  citySlug: string;
};

function mapFormatToAge(format: ActivityFormat): string | undefined {
  if (format === ActivityFormat.OFFLINE) return "Офлайн";
  if (format === ActivityFormat.ONLINE) return "Онлайн";
  if (format === ActivityFormat.HYBRID) return "Гибрид";
  return undefined;
}

function formatTodayTime(date: Date | null | undefined): string {
  if (!date) return "Сегодня";
  return `Сегодня, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

function mapPriceLabel(input: { priceFrom: number | null; priceTo: number | null; priceText: string | null }): string | undefined {
  if (input.priceText?.trim()) return input.priceText.trim();
  if (input.priceFrom == null) return undefined;
  if (input.priceTo != null && input.priceTo === input.priceFrom) return formatPrice(input.priceFrom);
  return formatPriceFrom(input.priceFrom);
}

function normalizeStoryDescription(...parts: Array<string | null | undefined>): string | undefined {
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

export async function StoriesSection({ cityId, citySlug }: StoriesSectionProps) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  // ── Breaking news (параллельно с обычными сторис) ──────────
  const breakingNewsPromise = listBreakingNewsArticles(citySlug).catch((error) => {
    console.error("[StoriesSection] Failed to load breaking news", error);
    return [];
  });

  const pub = getPublicListingActivityWhere(now);
  const pubParts = Array.isArray(pub.AND) ? pub.AND : (pub.AND ? [pub.AND] : []);
  const todayRows = await prisma.activity.findMany({
    where: {
      AND: [
        { type: ActivityType.EVENT },
        activityInAnyOfCitiesWhere([cityId]),
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
      images: { select: { id: true, url: true, mediaAssetId: true }, orderBy: { sortOrder: "asc" } },
      nextOccurrenceAt: true,
      sessions: {
        where: { startsAt: { gte: start, lt: end } },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true },
      },
      place: { select: { title: true, formattedAddr: true } },
      venue: { select: { title: true, addressLine: true } },
    },
    take: 20, // берём больше, потом сортируем и режем
  });

  const breakingNews = await breakingNewsPromise;

  // Определяем время начала для каждого события: сессия сегодня или nextOccurrenceAt
  const withStartTime = todayRows.map((row) => {
    const sessionStart = row.sessions[0]?.startsAt ?? null;
    const effectiveStart: Date | null = sessionStart ?? row.nextOccurrenceAt;
    return { row, effectiveStart };
  });

  // Сортируем по времени начала (ближайшие первыми, null — в конец)
  withStartTime.sort((a, b) => {
    if (!a.effectiveStart && !b.effectiveStart) return 0;
    if (!a.effectiveStart) return 1;
    if (!b.effectiveStart) return -1;
    return a.effectiveStart.getTime() - b.effectiveStart.getTime();
  });

  // Все события сегодня → одна коллекция "Сегодня" с несколькими items (max 5)
  const todayItems = withStartTime.slice(0, 5).map(({ row, effectiveStart }) => ({
    id: row.id,
    type: "event" as const,
    title: row.title,
    eyebrow: "сегодня",
    description: normalizeStoryDescription(row.shortDesc),
    image:
      resolveActivityCoverUrl({
        coverImageId: row.coverImageId,
        coverImageUrl: row.coverImageUrl,
        images: row.images,
      }) ?? "",
    age: mapFormatToAge(row.format),
    location: row.venue?.title ?? row.place?.title ?? row.venue?.addressLine ?? row.place?.formattedAddr ?? undefined,
    datetime: formatTodayTime(effectiveStart),
    price: mapPriceLabel({ priceFrom: row.priceFrom, priceTo: row.priceTo, priceText: row.priceText }),
    href: `/${citySlug}/events/${row.slug ?? row.id}`,
  }));

  const breakingNewsStory: StoryCollection | null = breakingNews.length > 0
    ? {
        id: "breaking-news",
        intent: "breaking_news",
        title: "breaking news",
        items: breakingNews.slice(0, 6).map((item) => ({
          id: item.id,
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
        coverImageUrls: breakingNews
          .map((item) => item.imageUrl)
          .filter((url): url is string => Boolean(url?.trim()))
          .slice(0, 4),
      }
    : null;

  const stories: StoryCollection[] = [
    ...(breakingNewsStory ? [breakingNewsStory] : []),
    ...(todayItems.length > 0
      ? [{
          id: "today",
          intent: "today" as const,
          title: "сегодня",
          emoji: "☀️",
          items: todayItems,
          coverImageUrls: todayItems
            .map((i) => i.image)
            .filter((u): u is string => Boolean(u?.trim()))
            .slice(0, 4),
        }]
      : []),
  ];

  return (
    <section aria-label="Stories">
      <div className="flex gap-3 overflow-x-auto no-scrollbar px-1 pb-1" style={{ scrollbarWidth: "none" }}>
        {stories.length > 0 && <StoryRings stories={stories} />}
      </div>
    </section>
  );
}
