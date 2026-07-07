import {
  ContentStatus,
  MediaEntityType,
  OfferStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  buildContentDependencySummary,
  blockingDependencyItems,
  type ContentDependencyItem,
  type ContentDependencySummary,
} from "@/lib/admin/contentDependencySummary";
import { hardDeleteBlockMessage } from "@/lib/admin/contentDependencySummary";

type DbClient = Prisma.TransactionClient | PrismaClient;

export type PlaceRelationCounts = {
  activitiesTotal: number;
  activitiesNonDraft: number;
  offersTotal: number;
  offersNonDraft: number;
  bookingRequests: number;
  childrenTotal: number;
  childrenNonDraft: number;
  eventVenues: number;
  routeStops: number;
  reviews: number;
  articles: number;
  planItems: number;
  placeIdeas: number;
  claimRequests: number;
  revisions: number;
  images: number;
  mediaUsage: number;
  importedRecords: number;
};

const PLACE_COUNT_SELECT = {
  activities: true,
  offers: true,
  bookingRequests: true,
  children: true,
  eventVenues: true,
  routeStops: true,
  reviews: true,
  relatedArticles: true,
  planItems: true,
  placeIdeas: true,
  claimRequests: true,
  revisions: true,
  images: true,
  importedRecords: true,
} as const;

export async function loadPlaceRelationCounts(
  placeId: string,
  prisma: DbClient,
): Promise<PlaceRelationCounts> {
  const [
    placeCounts,
    activitiesNonDraft,
    offersNonDraft,
    childrenNonDraft,
    mediaUsage,
  ] = await Promise.all([
    prisma.place.findUnique({
      where: { id: placeId },
      select: { _count: { select: PLACE_COUNT_SELECT } },
    }),
    prisma.activity.count({
      where: { placeId, status: { not: ContentStatus.DRAFT } },
    }),
    prisma.offer.count({
      where: { placeId, status: { not: OfferStatus.DRAFT } },
    }),
    prisma.place.count({
      where: { parentPlaceId: placeId, status: { not: ContentStatus.DRAFT } },
    }),
    prisma.mediaUsage.count({
      where: { entityType: MediaEntityType.PLACE, entityId: placeId },
    }),
  ]);

  const counts = placeCounts?._count;

  return {
    activitiesTotal: counts?.activities ?? 0,
    activitiesNonDraft,
    offersTotal: counts?.offers ?? 0,
    offersNonDraft,
    bookingRequests: counts?.bookingRequests ?? 0,
    childrenTotal: counts?.children ?? 0,
    childrenNonDraft,
    eventVenues: counts?.eventVenues ?? 0,
    routeStops: counts?.routeStops ?? 0,
    reviews: counts?.reviews ?? 0,
    articles: counts?.relatedArticles ?? 0,
    planItems: counts?.planItems ?? 0,
    placeIdeas: counts?.placeIdeas ?? 0,
    claimRequests: counts?.claimRequests ?? 0,
    revisions: counts?.revisions ?? 0,
    images: counts?.images ?? 0,
    mediaUsage,
    importedRecords: counts?.importedRecords ?? 0,
  };
}

export function buildPlaceDependencyItems(
  counts: PlaceRelationCounts,
  options?: { placeId?: string },
): ContentDependencyItem[] {
  const placeId = options?.placeId;
  const offersHref = placeId
    ? `/admin/content/offers?placeId=${encodeURIComponent(placeId)}`
    : "/admin/content/offers";
  const eventsHref = placeId
    ? `/admin/content/events?placeId=${encodeURIComponent(placeId)}`
    : "/admin/content/events";

  return [
    {
      type: "activities",
      label: "События",
      count: Math.max(counts.activitiesTotal, counts.activitiesNonDraft),
      blocking: counts.activitiesNonDraft > 0,
      href: eventsHref,
    },
    {
      type: "offers",
      label: "Предложения",
      count: Math.max(counts.offersTotal, counts.offersNonDraft),
      blocking: counts.offersNonDraft > 0,
      href: offersHref,
    },
    {
      type: "routeStops",
      label: "Маршруты",
      count: counts.routeStops,
      blocking: counts.routeStops > 0,
    },
    {
      type: "reviews",
      label: "Отзывы",
      count: counts.reviews,
      blocking: counts.reviews > 0,
    },
    {
      type: "bookingRequests",
      label: "Заявки на бронирование",
      count: counts.bookingRequests,
      blocking: counts.bookingRequests > 0,
    },
    {
      type: "children",
      label: "Дочерние локации",
      count: Math.max(counts.childrenTotal, counts.childrenNonDraft),
      blocking: counts.childrenNonDraft > 0,
    },
    {
      type: "articles",
      label: "Статьи",
      count: counts.articles,
      blocking: counts.articles > 0,
      href: "/admin/content/publications",
    },
    {
      type: "planItems",
      label: "Планы",
      count: counts.planItems,
      blocking: counts.planItems > 0,
    },
    {
      type: "eventVenues",
      label: "Площадки событий",
      count: counts.eventVenues,
      blocking: counts.eventVenues > 0,
    },
    {
      type: "claimRequests",
      label: "Заявки на владение",
      count: counts.claimRequests,
      blocking: counts.claimRequests > 0,
    },
    {
      type: "placeIdeas",
      label: "Идеи",
      count: counts.placeIdeas,
      blocking: counts.placeIdeas > 0,
    },
    {
      type: "images",
      label: "Изображения",
      count: counts.images,
      blocking: false,
    },
    {
      type: "mediaUsage",
      label: "Медиа",
      count: counts.mediaUsage,
      blocking: false,
    },
    {
      type: "revisions",
      label: "Редакции",
      count: counts.revisions,
      blocking: false,
    },
    {
      type: "importedRecords",
      label: "Импорт",
      count: counts.importedRecords,
      blocking: false,
    },
  ];
}

export async function getPlaceDependencySummary(
  placeId: string,
  prisma: DbClient,
): Promise<ContentDependencySummary> {
  const counts = await loadPlaceRelationCounts(placeId, prisma);
  return buildContentDependencySummary(
    buildPlaceDependencyItems(counts, { placeId }),
  );
}

export async function loadPlacesRelationCountsBatch(
  placeIds: string[],
  prisma: DbClient,
): Promise<Map<string, PlaceRelationCounts>> {
  const result = new Map<string, PlaceRelationCounts>();
  if (placeIds.length === 0) {
    return result;
  }

  const [places, nonDraftOffers, nonDraftActivities, nonDraftChildren, mediaUsage] =
    await Promise.all([
      prisma.place.findMany({
        where: { id: { in: placeIds } },
        select: {
          id: true,
          _count: { select: PLACE_COUNT_SELECT },
        },
      }),
      prisma.offer.groupBy({
        by: ["placeId"],
        where: {
          placeId: { in: placeIds },
          status: { not: OfferStatus.DRAFT },
        },
        _count: { _all: true },
      }),
      prisma.activity.groupBy({
        by: ["placeId"],
        where: {
          placeId: { in: placeIds },
          status: { not: ContentStatus.DRAFT },
        },
        _count: { _all: true },
      }),
      prisma.place.groupBy({
        by: ["parentPlaceId"],
        where: {
          parentPlaceId: { in: placeIds },
          status: { not: ContentStatus.DRAFT },
        },
        _count: { _all: true },
      }),
      prisma.mediaUsage.groupBy({
        by: ["entityId"],
        where: {
          entityType: MediaEntityType.PLACE,
          entityId: { in: placeIds },
        },
        _count: { _all: true },
      }),
    ]);

  const nonDraftOffersByPlace = new Map(
    nonDraftOffers.map((row) => [row.placeId, row._count._all]),
  );
  const nonDraftActivitiesByPlace = new Map(
    nonDraftActivities
      .filter((row): row is typeof row & { placeId: string } => row.placeId != null)
      .map((row) => [row.placeId, row._count._all]),
  );
  const nonDraftChildrenByPlace = new Map(
    nonDraftChildren
      .filter(
        (row): row is typeof row & { parentPlaceId: string } =>
          row.parentPlaceId != null,
      )
      .map((row) => [row.parentPlaceId, row._count._all]),
  );
  const mediaUsageByPlace = new Map(
    mediaUsage.map((row) => [row.entityId, row._count._all]),
  );

  for (const place of places) {
    const counts = place._count;
    result.set(place.id, {
      activitiesTotal: counts.activities,
      activitiesNonDraft: nonDraftActivitiesByPlace.get(place.id) ?? 0,
      offersTotal: counts.offers,
      offersNonDraft: nonDraftOffersByPlace.get(place.id) ?? 0,
      bookingRequests: counts.bookingRequests,
      childrenTotal: counts.children,
      childrenNonDraft: nonDraftChildrenByPlace.get(place.id) ?? 0,
      eventVenues: counts.eventVenues,
      routeStops: counts.routeStops,
      reviews: counts.reviews,
      articles: counts.relatedArticles,
      planItems: counts.planItems,
      placeIdeas: counts.placeIdeas,
      claimRequests: counts.claimRequests,
      revisions: counts.revisions,
      images: counts.images,
      mediaUsage: mediaUsageByPlace.get(place.id) ?? 0,
      importedRecords: counts.importedRecords,
    });
  }

  return result;
}

export async function getPlacesDependencySummariesBatch(
  placeIds: string[],
  prisma: DbClient,
): Promise<Map<string, ContentDependencySummary>> {
  const countsByPlace = await loadPlacesRelationCountsBatch(placeIds, prisma);
  const summaries = new Map<string, ContentDependencySummary>();

  for (const [placeId, counts] of countsByPlace) {
    summaries.set(
      placeId,
      buildContentDependencySummary(
        buildPlaceDependencyItems(counts, { placeId }),
      ),
    );
  }

  return summaries;
}

export function derivePlaceDeletePreflight(params: {
  status: ContentStatus;
  archivedAt: Date | null;
  dependencySummary: ContentDependencySummary;
}): {
  allowed: boolean;
  reasons: string[];
  message?: string;
  dependencySummary: ContentDependencySummary;
} {
  const reasons: string[] = [];

  if (params.status !== ContentStatus.DRAFT) {
    reasons.push("statusNotDraft");
  }
  if (params.archivedAt) {
    reasons.push("archived");
  }
  for (const item of blockingDependencyItems(params.dependencySummary)) {
    reasons.push(item.type);
  }

  const allowed = reasons.length === 0;

  return {
    allowed,
    reasons,
    message: allowed ? undefined : hardDeleteBlockMessage(reasons),
    dependencySummary: params.dependencySummary,
  };
}

export function derivePlaceArchivedDeletePreflight(params: {
  archivedAt: Date | null;
  dependencySummary: ContentDependencySummary;
}): {
  allowed: boolean;
  reasons: string[];
  message?: string;
  dependencySummary: ContentDependencySummary;
} {
  const reasons: string[] = [];

  if (!params.archivedAt) {
    reasons.push("notArchived");
  }
  for (const item of blockingDependencyItems(params.dependencySummary)) {
    reasons.push(item.type);
  }

  const allowed = reasons.length === 0;

  return {
    allowed,
    reasons,
    message: allowed ? undefined : hardDeleteBlockMessage(reasons),
    dependencySummary: params.dependencySummary,
  };
}
