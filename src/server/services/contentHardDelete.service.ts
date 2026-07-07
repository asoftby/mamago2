import {
  ContentStatus,
  OfferStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  buildContentDependencySummary,
  type ContentDependencySummary,
  hardDeleteBlockMessage,
  HARD_DELETE_BLOCK_MESSAGE,
} from "@/lib/admin/contentDependencySummary";
import {
  buildPlaceDependencyItems,
  loadPlaceRelationCounts,
} from "@/server/services/contentDependencySummary.service";

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

export type HardDeleteEvaluation = {
  allowed: boolean;
  code?: string;
  message?: string;
  reasons: string[];
  dependencySummary?: ContentDependencySummary;
};

export { HARD_DELETE_BLOCK_MESSAGE, hardDeleteBlockMessage };

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

export async function evaluateHardDeleteContent({
  contentType,
  contentId,
  status,
  prisma,
}: AssertCanHardDeleteContentParams): Promise<HardDeleteEvaluation> {
  switch (contentType) {
    case "PLACE":
      return evaluateHardDeletePlace({ contentId, status, prisma });
    case "OFFER":
      return evaluateHardDeleteOffer({ contentId, status, prisma });
    case "ACTIVITY":
      return evaluateHardDeleteActivity({ contentId, status, prisma });
    case "ARTICLE":
      return evaluateHardDeleteArticle({ contentId, status, prisma });
    default: {
      const unreachable: never = contentType;
      throw new Error(`Unsupported content type: ${unreachable}`);
    }
  }
}

/** Hard-delete archived catalog content (admin only at API layer). */
export async function evaluateHardDeleteArchivedContent({
  contentType,
  contentId,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "status">): Promise<HardDeleteEvaluation> {
  switch (contentType) {
    case "PLACE":
      return evaluateArchivedDeletePlace({ contentId, prisma });
    case "OFFER":
      return evaluateArchivedDeleteOffer({ contentId, prisma });
    case "ACTIVITY":
      return evaluateArchivedDeleteActivity({ contentId, prisma });
    case "ARTICLE":
      return evaluateArchivedDeleteArticle({ contentId, prisma });
    default: {
      const unreachable: never = contentType;
      throw new Error(`Unsupported content type: ${unreachable}`);
    }
  }
}

export async function assertCanHardDeleteContent({
  contentType,
  contentId,
  status,
  prisma,
}: AssertCanHardDeleteContentParams): Promise<void> {
  const evaluation = await evaluateHardDeleteContent({
    contentType,
    contentId,
    status,
    prisma,
  });
  if (!evaluation.allowed) {
    const statusCode =
      evaluation.code === "PLACE_NOT_FOUND" ||
      evaluation.code === "OFFER_NOT_FOUND" ||
      evaluation.code === "ACTIVITY_NOT_FOUND" ||
      evaluation.code === "ARTICLE_NOT_FOUND"
        ? 404
        : 409;
    throw new ContentHardDeleteError({
      statusCode,
      code: evaluation.code ?? "CONTENT_HARD_DELETE_BLOCKED",
      message: evaluation.message ?? HARD_DELETE_BLOCK_MESSAGE,
      reasons: evaluation.reasons,
    });
  }
}

async function evaluateHardDeletePlace({
  contentId,
  status,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType">): Promise<HardDeleteEvaluation> {
  const place = await prisma.place.findUnique({
    where: { id: contentId },
    select: {
      status: true,
      archivedAt: true,
    },
  });

  if (!place) {
    return {
      allowed: false,
      code: "PLACE_NOT_FOUND",
      message: "Place not found",
      reasons: [],
    };
  }

  const counts = await loadPlaceRelationCounts(contentId, prisma);
  const dependencySummary = buildContentDependencySummary(
    buildPlaceDependencyItems(counts, { placeId: contentId }),
  );

  const relationCounts: RelationCount[] = dependencySummary.items
    .filter((item) => item.blocking)
    .map((item) => ({ key: item.type, count: item.count }));

  const reasons = [
    ...buildDraftLifecycleReasons({
      currentStatus: place.status,
      explicitStatus: status,
      archivedAt: place.archivedAt,
    }),
    ...collectRelationReasons(relationCounts),
  ];

  if (reasons.length > 0) {
    return {
      allowed: false,
      code: "CONTENT_HARD_DELETE_BLOCKED",
      message: hardDeleteBlockMessage(reasons),
      reasons,
      dependencySummary,
    };
  }

  return {
    allowed: true,
    reasons: [],
    dependencySummary,
  };
}

async function evaluateHardDeleteOffer({
  contentId,
  status,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType">): Promise<HardDeleteEvaluation> {
  const offer = await prisma.offer.findUnique({
    where: { id: contentId },
    select: {
      status: true,
      publishedAt: true,
      archivedAt: true,
    },
  });

  if (!offer) {
    return {
      allowed: false,
      code: "OFFER_NOT_FOUND",
      message: "Offer not found",
      reasons: [],
    };
  }

  const relationCounts = await Promise.all([
    countRelation(
      prisma.bookingRequest.count({ where: { offerId: contentId } }),
      "bookingRequests",
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
  ]);

  const reasons = [
    ...buildDraftLifecycleReasons({
      currentStatus: offer.status,
      explicitStatus: status,
      archivedAt: offer.archivedAt,
      publishedAt: offer.publishedAt,
    }),
    ...collectRelationReasons(relationCounts),
  ];

  if (reasons.length > 0) {
    return {
      allowed: false,
      code: "CONTENT_HARD_DELETE_BLOCKED",
      message: hardDeleteBlockMessage(reasons),
      reasons,
    };
  }

  return { allowed: true, reasons: [] };
}

async function evaluateHardDeleteActivity({
  contentId,
  status,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType">): Promise<HardDeleteEvaluation> {
  const activity = await prisma.activity.findUnique({
    where: { id: contentId },
    select: {
      status: true,
    },
  });

  if (!activity) {
    return {
      allowed: false,
      code: "ACTIVITY_NOT_FOUND",
      message: "Activity not found",
      reasons: [],
    };
  }

  const relationCounts = await Promise.all([
    countRelation(
      prisma.bookingRequest.count({ where: { activityId: contentId } }),
      "bookingRequests",
    ),
    countRelation(
      prisma.planItem.count({ where: { activityId: contentId } }),
      "planItems",
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
    return {
      allowed: false,
      code: "CONTENT_HARD_DELETE_BLOCKED",
      message: hardDeleteBlockMessage(reasons),
      reasons,
    };
  }

  return { allowed: true, reasons: [] };
}

async function evaluateHardDeleteArticle({
  contentId,
  status,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType">): Promise<HardDeleteEvaluation> {
  const article = await prisma.article.findUnique({
    where: { id: contentId },
    select: {
      status: true,
      publishedAt: true,
    },
  });

  if (!article) {
    return {
      allowed: false,
      code: "ARTICLE_NOT_FOUND",
      message: "Not found",
      reasons: [],
    };
  }

  const reasons = [
    ...buildDraftLifecycleReasons({
      currentStatus: article.status,
      explicitStatus: status,
      publishedAt: article.publishedAt,
    }),
  ];

  if (reasons.length > 0) {
    return {
      allowed: false,
      code: "CONTENT_HARD_DELETE_BLOCKED",
      message: hardDeleteBlockMessage(reasons),
      reasons,
    };
  }

  return { allowed: true, reasons: [] };
}

async function evaluateArchivedDeletePlace({
  contentId,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType" | "status">): Promise<HardDeleteEvaluation> {
  const place = await prisma.place.findUnique({
    where: { id: contentId },
    select: {
      status: true,
      archivedAt: true,
    },
  });

  if (!place) {
    return {
      allowed: false,
      code: "PLACE_NOT_FOUND",
      message: "Place not found",
      reasons: [],
    };
  }

  const counts = await loadPlaceRelationCounts(contentId, prisma);
  const dependencySummary = buildContentDependencySummary(
    buildPlaceDependencyItems(counts, { placeId: contentId }),
  );

  const relationCounts: RelationCount[] = dependencySummary.items
    .filter((item) => item.blocking)
    .map((item) => ({ key: item.type, count: item.count }));

  const reasons = [
    ...buildArchivedDeleteReasons({ archivedAt: place.archivedAt, status: place.status }),
    ...collectRelationReasons(relationCounts),
  ];

  if (reasons.length > 0) {
    return {
      allowed: false,
      code: "CONTENT_HARD_DELETE_BLOCKED",
      message: hardDeleteBlockMessage(reasons),
      reasons,
      dependencySummary,
    };
  }

  return {
    allowed: true,
    reasons: [],
    dependencySummary,
  };
}

async function evaluateArchivedDeleteOffer({
  contentId,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType" | "status">): Promise<HardDeleteEvaluation> {
  const offer = await prisma.offer.findUnique({
    where: { id: contentId },
    select: {
      status: true,
      archivedAt: true,
    },
  });

  if (!offer) {
    return {
      allowed: false,
      code: "OFFER_NOT_FOUND",
      message: "Offer not found",
      reasons: [],
    };
  }

  const relationCounts = await Promise.all([
    countRelation(
      prisma.bookingRequest.count({ where: { offerId: contentId } }),
      "bookingRequests",
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
  ]);

  const reasons = [
    ...buildArchivedDeleteReasons({ archivedAt: offer.archivedAt, status: offer.status }),
    ...collectRelationReasons(relationCounts),
  ];

  if (reasons.length > 0) {
    return {
      allowed: false,
      code: "CONTENT_HARD_DELETE_BLOCKED",
      message: hardDeleteBlockMessage(reasons),
      reasons,
    };
  }

  return { allowed: true, reasons: [] };
}

async function evaluateArchivedDeleteActivity({
  contentId,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType" | "status">): Promise<HardDeleteEvaluation> {
  const activity = await prisma.activity.findUnique({
    where: { id: contentId },
    select: {
      status: true,
    },
  });

  if (!activity) {
    return {
      allowed: false,
      code: "ACTIVITY_NOT_FOUND",
      message: "Activity not found",
      reasons: [],
    };
  }

  const relationCounts = await Promise.all([
    countRelation(
      prisma.bookingRequest.count({ where: { activityId: contentId } }),
      "bookingRequests",
    ),
    countRelation(
      prisma.planItem.count({ where: { activityId: contentId } }),
      "planItems",
    ),
  ]);

  const reasons = [
    ...buildArchivedDeleteReasons({ status: activity.status }),
    ...collectRelationReasons(relationCounts),
  ];

  if (reasons.length > 0) {
    return {
      allowed: false,
      code: "CONTENT_HARD_DELETE_BLOCKED",
      message: hardDeleteBlockMessage(reasons),
      reasons,
    };
  }

  return { allowed: true, reasons: [] };
}

async function evaluateArchivedDeleteArticle({
  contentId,
  prisma,
}: Omit<AssertCanHardDeleteContentParams, "contentType" | "status">): Promise<HardDeleteEvaluation> {
  const article = await prisma.article.findUnique({
    where: { id: contentId },
    select: {
      status: true,
    },
  });

  if (!article) {
    return {
      allowed: false,
      code: "ARTICLE_NOT_FOUND",
      message: "Not found",
      reasons: [],
    };
  }

  const reasons = buildArchivedDeleteReasons({ status: article.status });

  if (reasons.length > 0) {
    return {
      allowed: false,
      code: "CONTENT_HARD_DELETE_BLOCKED",
      message: hardDeleteBlockMessage(reasons),
      reasons,
    };
  }

  return { allowed: true, reasons: [] };
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
    if (params.publishedAt) {
      reasons.push("publishedHistory");
    }
  }
  if (params.archivedAt) {
    reasons.push("archived");
  }

  return reasons;
}

function buildArchivedDeleteReasons(params: {
  archivedAt?: Date | null;
  status?: string | null;
}): string[] {
  if (params.archivedAt) {
    return [];
  }
  if (params.status === ContentStatus.ARCHIVED) {
    return [];
  }
  return ["notArchived"];
}

function collectRelationReasons(relationCounts: RelationCount[]): string[] {
  return relationCounts.filter((entry) => entry.count > 0).map((entry) => entry.key);
}

function countRelation(promise: Promise<number>, key: string): Promise<RelationCount> {
  return promise.then((count) => ({ key, count }));
}
