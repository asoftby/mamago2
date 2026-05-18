import { StoryRings } from "./StoryRings";
import prisma from "@/lib/prisma";
import { ActivityType, ActivityFormat } from "@prisma/client";
import type { StoryCollection } from "../types/story";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";

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

export async function StoriesSection({ cityId, citySlug }: StoriesSectionProps) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

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

  if (todayRows.length === 0) return null;

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
    title: row.title,
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

  const stories: StoryCollection[] = [
    {
      id: "today",
      intent: "today",
      title: "Сегодня",
      emoji: "☀️",
      items: todayItems,
      // Передаём до 4 обложек для коллажа в кружке
      coverImageUrls: todayItems
        .map((i) => i.image)
        .filter((u): u is string => Boolean(u?.trim()))
        .slice(0, 4),
    },
  ];

  return (
    <section aria-label="Stories">
      <StoryRings stories={stories} />
    </section>
  );
}
