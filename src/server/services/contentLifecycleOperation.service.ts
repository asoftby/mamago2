import {
  ContentStatus,
  OfferStatus,
  Prisma,
  PrismaClient,
  RouteStatus,
} from "@prisma/client";
import {
  ContentHardDeleteError,
  evaluateHardDeleteContent,
  evaluateHardDeleteArchivedContent,
  type HardDeleteContentType,
} from "@/server/services/contentHardDelete.service";
import type { ContentDependencySummary } from "@/lib/admin/contentDependencySummary";

export type ContentLifecycleOperation =
  | "deleteDraft"
  | "deleteArchived"
  | "archiveContent"
  | "restoreArchived";

export type ContentLifecycleDestructiveLevel = "hard" | "archive" | "soft";

export type ContentLifecycleContentType =
  | HardDeleteContentType
  | "EVENT"
  | "ROUTE";

type DbClient = Prisma.TransactionClient | PrismaClient;

export type ContentLifecycleOperationResult = {
  allowed: boolean;
  operation: ContentLifecycleOperation;
  destructiveLevel: ContentLifecycleDestructiveLevel;
  statusCode?: number;
  code?: string;
  message?: string;
  reasons?: string[];
  details?: Record<string, unknown>;
  dependencySummary?: ContentDependencySummary;
};

type AssertContentLifecycleOperationParams = {
  contentType: ContentLifecycleContentType;
  contentId: string;
  operation: ContentLifecycleOperation;
  status?: string | null;
  archivedAt?: Date | null;
  actorRole?: string | null;
  prisma: DbClient;
};

export const CONTENT_LIFECYCLE_OPERATION_BLOCKED =
  "Операция недоступна для текущего состояния публикации.";

export class ContentLifecycleOperationError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly reasons: string[];
  readonly details?: Record<string, unknown>;
  readonly operation: ContentLifecycleOperation;
  readonly destructiveLevel: ContentLifecycleDestructiveLevel;

  constructor(params: {
    message: string;
    statusCode: number;
    code: string;
    operation: ContentLifecycleOperation;
    destructiveLevel: ContentLifecycleDestructiveLevel;
    reasons?: string[];
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = "ContentLifecycleOperationError";
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.operation = params.operation;
    this.destructiveLevel = params.destructiveLevel;
    this.reasons = params.reasons ?? [];
    this.details = params.details;
  }
}

export function isContentLifecycleOperationError(
  error: unknown,
): error is ContentLifecycleOperationError {
  return error instanceof ContentLifecycleOperationError;
}

export function lifecycleErrorResponsePayload(
  error: ContentLifecycleOperationError,
) {
  return {
    code: error.code,
    message: error.message,
    reasons: error.reasons.length > 0 ? error.reasons : undefined,
    details: error.details,
    dependencySummary: error.details?.dependencySummary as
      | ContentDependencySummary
      | undefined,
  };
}

export function contentLifecycleResultToError(
  result: ContentLifecycleOperationResult,
  statusCode = 409,
): ContentLifecycleOperationError {
  return new ContentLifecycleOperationError({
    statusCode: result.statusCode ?? statusCode,
    code: result.code ?? "CONTENT_LIFECYCLE_OPERATION_BLOCKED",
    message: result.message ?? CONTENT_LIFECYCLE_OPERATION_BLOCKED,
    operation: result.operation,
    destructiveLevel: result.destructiveLevel,
    reasons: result.reasons,
    details: {
      ...result.details,
      ...(result.dependencySummary
        ? { dependencySummary: result.dependencySummary }
        : {}),
    },
  });
}

export async function canPerformContentLifecycleOperation(
  params: AssertContentLifecycleOperationParams,
): Promise<ContentLifecycleOperationResult> {
  switch (params.operation) {
    case "deleteDraft":
      return canDeleteDraft(params);
    case "deleteArchived":
      return canDeleteArchived(params);
    case "archiveContent":
      return canArchiveContent(params);
    case "restoreArchived":
      return canRestoreArchived(params);
    default: {
      const unreachable: never = params.operation;
      throw new Error(`Unsupported content lifecycle operation: ${unreachable}`);
    }
  }
}

export async function assertContentLifecycleOperationAllowed(
  params: AssertContentLifecycleOperationParams,
): Promise<ContentLifecycleOperationResult> {
  const result = await canPerformContentLifecycleOperation(params);
  if (!result.allowed) {
    throw contentLifecycleResultToError(result);
  }
  return result;
}

async function canDeleteDraft(
  params: AssertContentLifecycleOperationParams,
): Promise<ContentLifecycleOperationResult> {
  const base = allowedResult(params.operation, "hard");

  if (params.contentType === "ROUTE") {
    return canDeleteDraftRoute(params);
  }

  try {
    const evaluation = await evaluateHardDeleteContent({
      contentType: normalizeHardDeleteType(params.contentType),
      contentId: params.contentId,
      status: params.status,
      prisma: params.prisma,
    });

    if (!evaluation.allowed) {
      return blockedResult(params.operation, "hard", {
        code: evaluation.code ?? "CONTENT_HARD_DELETE_BLOCKED",
        message: evaluation.message ?? CONTENT_LIFECYCLE_OPERATION_BLOCKED,
        reasons: evaluation.reasons,
        dependencySummary: evaluation.dependencySummary,
      });
    }

    return {
      ...base,
      dependencySummary: evaluation.dependencySummary,
    };
  } catch (error) {
    if (error instanceof ContentHardDeleteError) {
      return blockedResult(params.operation, "hard", {
        code: error.code,
        message: error.message,
        reasons: error.reasons,
      });
    }
    throw error;
  }
}

async function canDeleteArchived(
  params: AssertContentLifecycleOperationParams,
): Promise<ContentLifecycleOperationResult> {
  if (params.contentType === "ROUTE") {
    return blockedResult(params.operation, "hard", {
      code: "CONTENT_DELETE_ARCHIVED_NOT_SUPPORTED",
      message: CONTENT_LIFECYCLE_OPERATION_BLOCKED,
      reasons: ["unsupportedContentType"],
    });
  }

  if (params.actorRole !== "ADMIN") {
    return blockedResult(params.operation, "hard", {
      code: "CONTENT_DELETE_ARCHIVED_ADMIN_ONLY",
      message: "Удаление из архива доступно только администратору",
      reasons: ["adminOnly"],
      statusCode: 403,
    });
  }

  const state = await loadContentArchiveState(params);
  if (!state.exists) {
    return blockedResult(params.operation, "hard", {
      code: `${params.contentType}_NOT_FOUND`,
      message: "Публикация не найдена",
      statusCode: 404,
    });
  }

  if (!state.archived) {
    return blockedResult(params.operation, "hard", {
      code: "CONTENT_NOT_ARCHIVED",
      message: "Удаление из архива доступно только для архивных публикаций",
      reasons: ["notArchived"],
    });
  }

  try {
    const evaluation = await evaluateHardDeleteArchivedContent({
      contentType: normalizeHardDeleteType(params.contentType),
      contentId: params.contentId,
      prisma: params.prisma,
    });

    if (!evaluation.allowed) {
      return blockedResult(params.operation, "hard", {
        code: evaluation.code ?? "CONTENT_HARD_DELETE_BLOCKED",
        message: evaluation.message ?? CONTENT_LIFECYCLE_OPERATION_BLOCKED,
        reasons: evaluation.reasons,
        dependencySummary: evaluation.dependencySummary,
      });
    }

    return {
      ...allowedResult(params.operation, "hard"),
      dependencySummary: evaluation.dependencySummary,
    };
  } catch (error) {
    if (error instanceof ContentHardDeleteError) {
      return blockedResult(params.operation, "hard", {
        code: error.code,
        message: error.message,
        reasons: error.reasons,
      });
    }
    throw error;
  }
}

async function canDeleteDraftRoute(
  params: AssertContentLifecycleOperationParams,
): Promise<ContentLifecycleOperationResult> {
  const route = await params.prisma.route.findUnique({
    where: { id: params.contentId },
    select: {
      status: true,
      _count: {
        select: {
          planItems: true,
          ratings: true,
          routeIdeas: true,
        },
      },
    },
  });

  if (!route) {
    return blockedResult(params.operation, "hard", {
      code: "ROUTE_NOT_FOUND",
      message: "Route not found",
      statusCode: 404,
    });
  }

  const effectiveStatus = params.status ?? route.status;
  const reasons = [
    ...(effectiveStatus !== RouteStatus.DRAFT ? ["statusNotDraft"] : []),
    ...(route._count.planItems > 0 ? ["planItems"] : []),
    ...(route._count.ratings > 0 ? ["ratings"] : []),
    ...(route._count.routeIdeas > 0 ? ["routeIdeas"] : []),
  ];

  if (reasons.length > 0) {
    return blockedResult(params.operation, "hard", {
      code: "CONTENT_HARD_DELETE_BLOCKED",
      message:
        "Удаление невозможно. С маршрутом уже связаны другие данные или он не является черновиком.",
      reasons,
    });
  }

  return allowedResult(params.operation, "hard");
}

async function canArchiveContent(
  params: AssertContentLifecycleOperationParams,
): Promise<ContentLifecycleOperationResult> {
  const state = await loadContentArchiveState(params);
  if (!state.exists) {
    return blockedResult(params.operation, "archive", {
      code: `${params.contentType}_NOT_FOUND`,
      message: "Публикация не найдена",
      statusCode: 404,
    });
  }

  if (state.archived) {
    return blockedResult(params.operation, "archive", {
      code: "CONTENT_ALREADY_ARCHIVED",
      message: "Публикация уже в архиве",
      reasons: ["alreadyArchived"],
    });
  }

  if (isDraftStatus(params.contentType, state.status)) {
    return blockedResult(params.operation, "archive", {
      code: "CONTENT_ARCHIVE_NOT_ALLOWED_FOR_DRAFT",
      message: "Черновик нельзя архивировать. Для него доступно удаление.",
      reasons: ["statusDraft"],
    });
  }

  if (!isArchivableStatus(params.contentType, state.status)) {
    return blockedResult(params.operation, "archive", {
      code: "CONTENT_ARCHIVE_STATUS_NOT_ALLOWED",
      message: CONTENT_LIFECYCLE_OPERATION_BLOCKED,
      reasons: ["statusNotArchivable"],
      details: { status: state.status },
    });
  }

  return allowedResult(params.operation, "archive");
}

async function canRestoreArchived(
  params: AssertContentLifecycleOperationParams,
): Promise<ContentLifecycleOperationResult> {
  const state = await loadContentArchiveState(params);
  if (!state.exists) {
    return blockedResult(params.operation, "archive", {
      code: `${params.contentType}_NOT_FOUND`,
      message: "Публикация не найдена",
      statusCode: 404,
    });
  }

  if (!state.archived) {
    return blockedResult(params.operation, "archive", {
      code: "CONTENT_NOT_ARCHIVED",
      message: "Публикация не находится в архиве",
      reasons: ["notArchived"],
    });
  }

  return allowedResult(params.operation, "archive");
}

function normalizeHardDeleteType(
  contentType: ContentLifecycleContentType,
): HardDeleteContentType {
  if (contentType === "EVENT") return "ACTIVITY";
  if (
    contentType === "PLACE" ||
    contentType === "OFFER" ||
    contentType === "ACTIVITY" ||
    contentType === "ARTICLE"
  ) {
    return contentType;
  }
  throw new Error(`Hard delete is not supported for ${contentType}`);
}

async function loadContentArchiveState(params: AssertContentLifecycleOperationParams) {
  switch (params.contentType) {
    case "PLACE": {
      const place = await params.prisma.place.findUnique({
        where: { id: params.contentId },
        select: { status: true, archivedAt: true },
      });
      return {
        exists: Boolean(place),
        status: params.status ?? place?.status ?? null,
        archived: Boolean(params.archivedAt ?? place?.archivedAt),
      };
    }
    case "OFFER": {
      const offer = await params.prisma.offer.findUnique({
        where: { id: params.contentId },
        select: { status: true, archivedAt: true },
      });
      return {
        exists: Boolean(offer),
        status: params.status ?? offer?.status ?? null,
        archived: Boolean(params.archivedAt ?? offer?.archivedAt),
      };
    }
    case "EVENT":
    case "ACTIVITY": {
      const activity = await params.prisma.activity.findUnique({
        where: { id: params.contentId },
        select: { status: true },
      });
      const status = params.status ?? activity?.status ?? null;
      return {
        exists: Boolean(activity),
        status,
        archived: status === ContentStatus.ARCHIVED,
      };
    }
    case "ARTICLE": {
      const article = await params.prisma.article.findUnique({
        where: { id: params.contentId },
        select: { status: true },
      });
      const status = params.status ?? article?.status ?? null;
      return {
        exists: Boolean(article),
        status,
        archived: status === ContentStatus.ARCHIVED,
      };
    }
    case "ROUTE": {
      const route = await params.prisma.route.findUnique({
        where: { id: params.contentId },
        select: { status: true },
      });
      const status = params.status ?? route?.status ?? null;
      return {
        exists: Boolean(route),
        status,
        archived: status === RouteStatus.ARCHIVED,
      };
    }
    default: {
      const unreachable: never = params.contentType;
      throw new Error(`Unsupported content type: ${unreachable}`);
    }
  }
}

function isDraftStatus(
  contentType: ContentLifecycleContentType,
  status: string | null,
) {
  if (contentType === "OFFER") return status === OfferStatus.DRAFT;
  if (contentType === "ROUTE") return status === RouteStatus.DRAFT;
  return status === ContentStatus.DRAFT;
}

function isArchivableStatus(
  contentType: ContentLifecycleContentType,
  status: string | null,
) {
  if (contentType === "OFFER") {
    const archivableStatuses: OfferStatus[] = [
      OfferStatus.PENDING,
      OfferStatus.PUBLISHED,
      OfferStatus.REJECTED,
    ];
    return archivableStatuses.includes(status as OfferStatus);
  }

  if (contentType === "ROUTE") {
    return status === RouteStatus.PUBLISHED;
  }

  const archivableStatuses: ContentStatus[] = [
    ContentStatus.PENDING,
    ContentStatus.PUBLISHED,
    ContentStatus.NEEDS_REVISION,
    ContentStatus.REJECTED,
    ContentStatus.PENDING_UPDATE,
    ContentStatus.SCHEDULED,
  ];
  return archivableStatuses.includes(status as ContentStatus);
}

function allowedResult(
  operation: ContentLifecycleOperation,
  destructiveLevel: ContentLifecycleDestructiveLevel,
): ContentLifecycleOperationResult {
  return {
    allowed: true,
    operation,
    destructiveLevel,
  };
}

function blockedResult(
  operation: ContentLifecycleOperation,
  destructiveLevel: ContentLifecycleDestructiveLevel,
  params: {
    code: string;
    message: string;
    statusCode?: number;
    reasons?: string[];
    details?: Record<string, unknown>;
    dependencySummary?: ContentDependencySummary;
  },
): ContentLifecycleOperationResult {
  return {
    allowed: false,
    operation,
    destructiveLevel,
    statusCode: params.statusCode,
    code: params.code,
    message: params.message,
    reasons: params.reasons,
    details: {
      ...params.details,
      ...(params.dependencySummary
        ? { dependencySummary: params.dependencySummary }
        : {}),
    },
    dependencySummary: params.dependencySummary,
  };
}
