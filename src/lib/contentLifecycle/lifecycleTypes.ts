import type { ContentDependencySummary } from "@/lib/admin/contentDependencySummary";

/** Catalog content kinds covered by the unified lifecycle. */
export type LifecycleContentType = "place" | "offer" | "event" | "article" | "route";

/** Where the lifecycle UI is rendered. */
export type LifecycleSurface = "admin" | "business" | "moderation";

/**
 * Normalized workflow state — independent of storage quirks
 * (`archivedAt` vs `status=ARCHIVED`, Offer `DRAFT` after needs-revision, etc.).
 */
export type LifecycleEffectiveState =
  | "draft"
  | "pending"
  | "published"
  | "archived"
  | "rejected"
  | "needsRevision"
  | "scheduled"
  | "deleted"
  | "unknown";

export type LifecycleVisualTone =
  | "neutral"
  | "warning"
  | "success"
  | "muted"
  | "danger";

/** User-facing verbs — UI is built around actions, not status enums. */
export type LifecycleActionId =
  | "edit"
  | "preview"
  | "review"
  | "publish"
  | "submitForModeration"
  | "withdrawFromModeration"
  | "archive"
  | "restore"
  | "deleteDraft"
  | "deleteArchived"
  | "unpublish"
  | "approve"
  | "reject"
  | "requestChanges";

export type LifecycleActionCategory = "navigation" | "transition" | "moderation";

export type LifecycleActorRole =
  | "ADMIN"
  | "MODERATOR"
  | "BUSINESS_OWNER"
  | "USER"
  | string;

export type LifecyclePreflight = {
  canDeleteDraft?: boolean;
  canDeleteArchived?: boolean;
  canArchive?: boolean;
  canRestore?: boolean;
  canSubmitForModeration?: boolean;
  canPublish?: boolean;
  canWithdrawFromModeration?: boolean;
  deleteBlockedReason?: string;
  deleteArchivedBlockedReason?: string;
  dependencySummary?: ContentDependencySummary;
};

export type LifecycleContext = {
  contentType: LifecycleContentType;
  surface: LifecycleSurface;
  status?: string | null;
  archivedAt?: string | Date | null;
  actorRoles?: LifecycleActorRole[];
  preflight?: LifecyclePreflight;
};

export type LifecycleActionAvailability = {
  actionId: LifecycleActionId;
  available: boolean;
  disabled?: boolean;
  reason?: string;
};

export type LifecycleHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type LifecycleActionRequest = {
  url: string;
  method: LifecycleHttpMethod;
  body?: unknown;
};

export type ResolvedLifecycleAction = {
  actionId: LifecycleActionId;
  label: string;
  description?: string;
  category: LifecycleActionCategory;
  destructive?: boolean;
  requiresConfirmation: boolean;
  disabled?: boolean;
  reason?: string;
  request?: LifecycleActionRequest;
  successMessage?: string;
  errorMessage?: string;
};
