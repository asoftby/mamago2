import {
  AnalyticsEntityType,
  ContentStatus,
  MediaEntityType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

export type HardDeleteContentType = "PLACE" | "OFFER" | "ACTIVITY" | "ARTICLE";

type DbClient = Prisma.TransactionClient | PrismaClient;

type AssertCanHardDeleteContentParams = {
  contentType: HardDeleteContentType;
  contentId: string;
  status?: string | null;
  prisma: DbClient;
};

type RelationCount = {
  key: string;
  count: number;
};

export const HARD_DELETE_BLOCK_MESSAGE =
  "Удаление невозможно. С этой публикацией уже связаны другие данные или публикации. Используйте архивирование.";

export class ContentHardDeleteError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly reasons: string[];

  constructor(params: {
    message: string;
    statusCode: number;
    code: string;
    reasons?: string[];
  }) {
    super(params.message);
    this.name = "ContentHardDeleteError";
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.reasons = params.reasons ?? [];
  }
}

export function isContentHardDeleteError(
  error: unknown,
): error is ContentHardDeleteError {
  return error instanceof ContentHardDeleteError;
}

export async function assertCanHardDeleteContent({
  contentType,
  contentId,
  status,
  prisma,
}: AssertCanHardDeleteContentParams): Promise<void> {
  switch (contentType) {
    case "PLACE":
      await assertCanHardDeletePlace({ contentId, status, prisma });
      return;
    case "OFFER":
      await assertCanHardDeleteOffer({ contentId, status, prisma });
      return;
    case "ACTIVITY":
      await assertCanHardDeleteActivity({ contentId, status, prisma });
      return;
    case "ARTICLE":
      await assertCanHardDeleteArticle({ contentId, status, prisma });
      return;
    default: {
      const unreachable: never = contentType;
      throw new Error(`Unsupported content type: ${unreachable}`);
    }
  }
}

async function assertCanHardDeletePlace({
  contentId,
  status,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType">) {
  const place = await prisma.place.findUnique({
    where: { id: contentId },
    select: {
      status: true,
      archivedAt: true,
      moderatedByUserId: true,
      moderationReviewedAt: true,
      moderatorComment: true,
      revisionRequestedAt: true,
      revisionResubmittedAt: true,
    },
  });

  if (!place) {
    throw new ContentHardDeleteError({
      statusCode: 404,
      code: "PLACE_NOT_FOUND",
      message: "Place not found",
    });
  }

  const relationCounts = await Promise.all([
    countRelation(prisma.activity.count({ where: { placeId: contentId } }), "activities"),
    countRelation(prisma.offer.count({ where: { placeId: contentId } }), "offers"),
    countRelation(
      prisma.bookingRequest.count({ where: { placeId: contentId } }),
      "bookingRequests",
    ),
    countRelation(prisma.place.count({ where: { parentPlaceId: contentId } }), "children"),
    countRelation(
      prisma.eventVenue.count({ where: { placeId: contentId } }),
      "eventVenues",
    ),
    countRelation(prisma.routeStop.count({ where: { placeId: contentId } }), "routeStops"),
    countRelation(prisma.placeReview.count({ where: { placeId: contentId } }), "reviews"),
    countRelation(
      prisma.article.count({ where: { relatedPlaceId: contentId } }),
      "articles",
    ),
    countRelation(prisma.planItem.count({ where: { placeId: contentId } }), "planItems"),
    countRelation(prisma.placeIdea.count({ where: { placeId: contentId } }), "placeIdeas"),
    countRelation(
      prisma.placeClaimRequest.count({ where: { placeId: contentId } }),
      "claimRequests",
    ),
    countRelation(
      prisma.placeRevision.count({ where: { placeId: contentId } }),
      "revisions",
    ),
    countRelation(prisma.placeImage.count({ where: { placeId: contentId } }), "images"),
    countRelation(
      prisma.placeSlugHistory.count({ where: { placeId: contentId } }),
      "slugHistory",
    ),
    countRelation(
      prisma.importedRecord.count({ where: { publishedPlaceId: contentId } }),
      "importedRecords",
    ),
    countRelation(
      prisma.importFieldOverride.count({
        where: { entityType: "PLACE", entityId: contentId },
      }),
      "importFieldOverrides",
    ),
    countRelation(
      prisma.mediaUsage.count({
        where: { entityType: MediaEntityType.PLACE, entityId: contentId },
      }),
      "mediaUsage",
    ),
    countRelation(
      prisma.userEvent.count({
        where: { entityType: AnalyticsEntityType.PLACE, entityId: contentId },
      }),
      "userEvents",
    ),
    countRelation(
      prisma.moderationLog.count({
        where: { entityType: "PLACE", entityId: contentId },
      }),
      "moderationLogs",
    ),
    countRelation(
      prisma.contentEditLog.count({
        where: { entityType: "PLACE", entityId: contentId },
      }),
      "contentEditLogs",
    ),
    countRelation(
      prisma.improvementRequest.count({
        where: { entityType: "PLACE", entityId: contentId },
      }),
      "improvementRequests",
    ),
  ]);

  const reasons = [
    ...buildDraftLifecycleReasons({
      currentStatus: place.status,
      explicitStatus: status,
      archivedAt: place.archivedAt,
    }),
    ...(place.moderatedByUserId ||
    place.moderationReviewedAt ||
    place.moderatorComment ||
    place.revisionRequestedAt ||
    place.revisionResubmittedAt
      ? ["moderationLifecycle"]
      : []),
    ...collectRelationReasons(relationCounts),
  ];

  if (reasons.length > 0) {
    throwBlocked(reasons);
  }
}

async function assertCanHardDeleteOffer({
  contentId,
  status,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType">) {
  const offer = await prisma.offer.findUnique({
    where: { id: contentId },
    select: {
      status: true,
      publishedAt: true,
      archivedAt: true,
      rejectionReason: true,
    },
  });

  if (!offer) {
    throw new ContentHardDeleteError({
      statusCode: 404,
      code: "OFFER_NOT_FOUND",
      message: "Offer not found",
    });
  }

  const relationCounts = await Promise.all([
    countRelation(
      prisma.bookingRequest.count({ where: { offerId: contentId } }),
      "bookingRequests",
    ),
    countRelation(
      prisma.offerPlacement.count({ where: { offerId: contentId } }),
      "placements",
    ),
    countRelation(
      prisma.offerSession.count({ where: { offerId: contentId } }),
      "sessions",
    ),
    countRelation(prisma.offerIdea.count({ where: { offerId: contentId } }), "offerIdeas"),
    countRelation(
      prisma.offerSlugHistory.count({ where: { offerId: contentId } }),
      "slugHistory",
    ),
    countRelation(prisma.boost.count({ where: { offerId: contentId } }), "boosts"),
    countRelation(
      prisma.packageComponent.count({
        where: {
          OR: [{ packageId: contentId }, { refOfferId: contentId }],
        },
      }),
      "packageComponents",
    ),
    countRelation(
      prisma.mediaUsage.count({
        where: { entityType: MediaEntityType.OFFER, entityId: contentId },
      }),
      "mediaUsage",
    ),
    countRelation(
      prisma.userEvent.count({
        where: { entityType: AnalyticsEntityType.OFFER, entityId: contentId },
      }),
      "userEvents",
    ),
    countRelation(
      prisma.contentEditLog.count({
        where: { entityType: "OFFER", entityId: contentId },
      }),
      "contentEditLogs",
    ),
    countRelation(
      prisma.improvementRequest.count({
        where: { entityType: "OFFER", entityId: contentId },
      }),
      "improvementRequests",
    ),
  ]);

  const reasons = [
    ...buildDraftLifecycleReasons({
      currentStatus: offer.status,
      explicitStatus: status,
      archivedAt: offer.archivedAt,
      publishedAt: offer.publishedAt,
    }),
    ...(offer.rejectionReason ? ["rejectionHistory"] : []),
    ...collectRelationReasons(relationCounts),
  ];

  if (reasons.length > 0) {
    throwBlocked(reasons);
  }
}

async function assertCanHardDeleteActivity({
  contentId,
  status,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType">) {
  const activity = await prisma.activity.findUnique({
    where: { id: contentId },
    select: {
      status: true,
    },
  });

  if (!activity) {
    throw new ContentHardDeleteError({
      statusCode: 404,
      code: "ACTIVITY_NOT_FOUND",
      message: "Activity not found",
    });
  }

  const relationCounts = await Promise.all([
    countRelation(
      prisma.activitySession.count({ where: { activityId: contentId } }),
      "sessions",
    ),
    countRelation(
      prisma.bookingRequest.count({ where: { activityId: contentId } }),
      "bookingRequests",
    ),
    countRelation(
      prisma.activityImage.count({ where: { activityId: contentId } }),
      "images",
    ),
    countRelation(
      prisma.activitySlugHistory.count({ where: { activityId: contentId } }),
      "slugHistory",
    ),
    countRelation(
      prisma.activityFilterOption.count({ where: { activityId: contentId } }),
      "filterOptions",
    ),
    countRelation(
      prisma.activityProgramCategory.count({ where: { activityId: contentId } }),
      "programCategories",
    ),
    countRelation(
      prisma.activityOccasion.count({ where: { activityId: contentId } }),
      "occasions",
    ),
    countRelation(
      prisma.planItem.count({ where: { activityId: contentId } }),
      "planItems",
    ),
    countRelation(
      prisma.eventVenue.count({ where: { activityId: contentId } }),
      "eventVenue",
    ),
    countRelation(
      prisma.importedRecord.count({ where: { publishedActivityId: contentId } }),
      "importedRecords",
    ),
    countRelation(
      prisma.importFieldOverride.count({
        where: { entityType: "EVENT", entityId: contentId },
      }),
      "importFieldOverrides",
    ),
    countRelation(
      prisma.mediaUsage.count({
        where: { entityType: MediaEntityType.EVENT, entityId: contentId },
      }),
      "mediaUsage",
    ),
    countRelation(
      prisma.userEvent.count({
        where: { entityType: AnalyticsEntityType.EVENT, entityId: contentId },
      }),
      "userEvents",
    ),
    countRelation(
      prisma.moderationLog.count({
        where: { entityType: "ACTIVITY", entityId: contentId },
      }),
      "moderationLogs",
    ),
    countRelation(
      prisma.contentEditLog.count({
        where: { entityType: "ACTIVITY", entityId: contentId },
      }),
      "contentEditLogs",
    ),
    countRelation(
      prisma.improvementRequest.count({
        where: { entityType: "ACTIVITY", entityId: contentId },
      }),
      "improvementRequests",
    ),
  ]);

  const reasons = [
    ...buildDraftLifecycleReasons({
      currentStatus: activity.status,
      explicitStatus: status,
    }),
    ...collectRelationReasons(relationCounts),
  ];

  if (reasons.length > 0) {
    throwBlocked(reasons);
  }
}

async function assertCanHardDeleteArticle({
  contentId,
  status,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType">) {
  const article = await prisma.article.findUnique({
    where: { id: contentId },
    select: {
      status: true,
      publishedAt: true,
    },
  });

  if (!article) {
    throw new ContentHardDeleteError({
      statusCode: 404,
      code: "ARTICLE_NOT_FOUND",
      message: "Not found",
    });
  }

  const relationCounts = await Promise.all([
    countRelation(
      prisma.articleSlugHistory.count({ where: { articleId: contentId } }),
      "slugHistory",
    ),
    countRelation(
      prisma.mediaUsage.count({
        where: { entityType: MediaEntityType.ARTICLE, entityId: contentId },
      }),
      "mediaUsage",
    ),
    countRelation(
      prisma.userEvent.count({
        where: { entityType: AnalyticsEntityType.ARTICLE, entityId: contentId },
      }),
      "userEvents",
    ),
    countRelation(
      prisma.contentEditLog.count({
        where: { entityType: "ARTICLE", entityId: contentId },
      }),
      "contentEditLogs",
    ),
    countRelation(
      prisma.improvementRequest.count({
        where: { entityType: "ARTICLE", entityId: contentId },
      }),
      "improvementRequests",
    ),
  ]);

  const reasons = [
    ...buildDraftLifecycleReasons({
      currentStatus: article.status,
      explicitStatus: status,
      publishedAt: article.publishedAt,
    }),
    ...collectRelationReasons(relationCounts),
  ];

  if (reasons.length > 0) {
    throwBlocked(reasons);
  }
}

function buildDraftLifecycleReasons(params: {
  currentStatus: string | null;
  explicitStatus?: string | null;
  archivedAt?: Date | null;
  publishedAt?: Date | null;
}): string[] {
  const effectiveStatus = params.explicitStatus ?? params.currentStatus;
  const reasons: string[] = [];

  if (effectiveStatus !== ContentStatus.DRAFT) {
    reasons.push("statusNotDraft");
  }
  if (params.archivedAt) {
    reasons.push("archived");
  }
  if (params.publishedAt) {
    reasons.push("publishedHistory");
  }

  return reasons;
}

function collectRelationReasons(relationCounts: RelationCount[]): string[] {
  return relationCounts.filter((entry) => entry.count > 0).map((entry) => entry.key);
}

function countRelation(promise: Promise<number>, key: string): Promise<RelationCount> {
  return promise.then((count) => ({ key, count }));
}

function throwBlocked(reasons: string[]): never {
  throw new ContentHardDeleteError({
    statusCode: 409,
    code: "CONTENT_HARD_DELETE_BLOCKED",
    message: HARD_DELETE_BLOCK_MESSAGE,
    reasons,
  });
}
