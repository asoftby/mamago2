import type { ContentDependencySummary } from "@/lib/admin/contentDependencySummary";
import {
  buildContentLifecycleViewModel,
  type ContentLifecycleEntityType,
  type ContentLifecycleInput,
  type ContentLifecycleViewModel,
} from "@/lib/contentLifecycle/contentLifecycleViewModel";

export function buildAdminPlaceLifecycleInput(params: {
  status: string;
  archivedAt: Date | null;
  deletePreflight?: {
    allowed: boolean;
    message?: string;
    dependencySummary: ContentDependencySummary;
  };
  archivedDeletePreflight?: {
    allowed: boolean;
    message?: string;
    dependencySummary: ContentDependencySummary;
  };
}): ContentLifecycleInput {
  return {
    type: "place",
    surface: "admin",
    status: params.status,
    archivedAt: params.archivedAt,
    lifecyclePreflight: {
      canDeleteDraft: params.deletePreflight?.allowed,
      canDeleteArchived: params.archivedDeletePreflight?.allowed,
      canArchive: params.archivedAt == null,
      canRestore: params.archivedAt != null,
      deleteBlockedReason: params.deletePreflight?.message,
      deleteArchivedBlockedReason: params.archivedDeletePreflight?.message,
      dependencySummary:
        params.archivedDeletePreflight?.dependencySummary ??
        params.deletePreflight?.dependencySummary,
    },
  };
}

export function buildAdminOfferLifecycleInput(params: {
  status: string;
  archivedAt: Date | null;
  canDeleteArchived?: boolean;
}): ContentLifecycleInput {
  return {
    type: "offer",
    surface: "admin",
    status: params.status,
    archivedAt: params.archivedAt,
    lifecyclePreflight: {
      canArchive: params.archivedAt == null,
      canRestore: params.archivedAt != null,
      canDeleteArchived:
        params.canDeleteArchived ?? Boolean(params.archivedAt),
    },
  };
}

export function buildAdminEventLifecycleInput(params: {
  status: string;
}): ContentLifecycleInput {
  const isArchived = params.status === "ARCHIVED";
  return {
    type: "event",
    surface: "admin",
    status: params.status,
    lifecyclePreflight: {
      canArchive: params.status !== "DRAFT" && !isArchived,
      canRestore: isArchived,
      canDeleteDraft: params.status === "DRAFT",
      canDeleteArchived: isArchived,
    },
  };
}

export function buildAdminArticleLifecycleInput(params: {
  status: string;
}): ContentLifecycleInput {
  const isArchived = params.status === "ARCHIVED";
  return {
    type: "article",
    surface: "admin",
    status: params.status,
    lifecyclePreflight: {
      canArchive: params.status !== "DRAFT" && !isArchived,
      canRestore: isArchived,
      canDeleteDraft: params.status === "DRAFT",
      canDeleteArchived: isArchived,
    },
  };
}

export function buildAdminLifecycleViewModel(
  input: ContentLifecycleInput,
): ContentLifecycleViewModel {
  return buildContentLifecycleViewModel(input);
}

export function adminLifecycleTypeLabel(type: ContentLifecycleEntityType): string {
  switch (type) {
    case "place":
      return "Место";
    case "offer":
      return "Предложение";
    case "event":
      return "Событие";
    case "article":
      return "Публикация";
    case "route":
      return "Маршрут";
    default:
      return "Публикация";
  }
}
