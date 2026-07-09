import type { ContentDependencySummary } from "@/lib/admin/contentDependencySummary";
import { LIFECYCLE_STATE_META } from "./lifecycleEffectiveState";
import { resolveLifecycleActions } from "./resolveLifecycleActions";
import type {
  LifecycleActionId,
  LifecycleContentType,
  LifecycleContext,
  LifecycleEffectiveState,
  LifecyclePreflight,
  LifecycleSurface,
  LifecycleVisualTone,
  ResolvedLifecycleAction,
} from "./lifecycleTypes";

/** @deprecated Use LifecycleContentType */
export type ContentLifecycleEntityType = LifecycleContentType;

/** @deprecated Use LifecycleEffectiveState */
export type ContentLifecycleEffectiveState = LifecycleEffectiveState;

/** @deprecated Use LifecycleVisualTone */
export type ContentLifecycleVisualTone = LifecycleVisualTone;

/** @deprecated Use LifecycleActionId */
export type ContentLifecycleActionId = LifecycleActionId;

export type ContentLifecycleCapabilities = {
  canEdit?: boolean;
  canPreview?: boolean;
  canPublish?: boolean;
  canSubmitForModeration?: boolean;
  canArchive?: boolean;
  canRestore?: boolean;
  canDeleteDraft?: boolean;
  canDeleteArchived?: boolean;
  canWithdrawFromModeration?: boolean;
};

export type ContentLifecycleInput = {
  type: LifecycleContentType;
  surface?: LifecycleSurface;
  status?: string | null;
  archivedAt?: string | Date | null;
  publishedAt?: string | Date | null;
  moderationStatus?: string | null;
  actorRoles?: string[];
  capabilities?: ContentLifecycleCapabilities;
  lifecyclePreflight?: LifecyclePreflight & {
    canDeleteDraft?: boolean;
    canDeleteArchived?: boolean;
    canArchive?: boolean;
    canRestore?: boolean;
    deleteBlockedReason?: string;
    deleteArchivedBlockedReason?: string;
    dependencySummary?: ContentDependencySummary;
  };
  navigationLinks?: {
    edit?: boolean;
    preview?: boolean;
    review?: boolean;
  };
};

export type ContentLifecycleBadge = {
  label: string;
  tone: LifecycleVisualTone;
  primary?: boolean;
};

export type ContentLifecycleActionView = {
  id: LifecycleActionId;
  label: string;
  description?: string;
  icon?: string;
  destructive?: boolean;
  disabled?: boolean;
  reason?: string;
};

export type ContentLifecycleViewModel = {
  effectiveState: LifecycleEffectiveState;
  label: string;
  description?: string;
  visualTone: LifecycleVisualTone;
  badges: ContentLifecycleBadge[];
  navigationActions: ContentLifecycleActionView[];
  transitionActions: ContentLifecycleActionView[];
  /** @deprecated Use navigationActions + transitionActions */
  statusTransitionActions: ContentLifecycleActionView[];
  /** @deprecated Use navigationActions + transitionActions */
  availableActions: ContentLifecycleActionView[];
  rawStatus?: string | null;
  isArchived: boolean;
};

export { LIFECYCLE_TRANSITION_ACTION_IDS as STATUS_TRANSITION_ACTION_IDS } from "./lifecycleActionRegistry";

export {
  isLifecycleArchived as isContentLifecycleArchived,
  resolveLifecycleEffectiveState as resolveContentLifecycleEffectiveState,
} from "./lifecycleEffectiveState";

function toActionView(action: ResolvedLifecycleAction): ContentLifecycleActionView {
  return {
    id: action.actionId,
    label: action.label,
    description: action.description,
    destructive: action.destructive,
    disabled: action.disabled,
    reason: action.reason,
  };
}

function buildLifecycleContext(input: ContentLifecycleInput): LifecycleContext {
  const preflight: LifecyclePreflight = {
    ...input.lifecyclePreflight,
    canDeleteDraft:
      input.lifecyclePreflight?.canDeleteDraft ??
      input.capabilities?.canDeleteDraft,
    canDeleteArchived:
      input.lifecyclePreflight?.canDeleteArchived ??
      input.capabilities?.canDeleteArchived,
    canArchive:
      input.lifecyclePreflight?.canArchive ?? input.capabilities?.canArchive,
    canRestore:
      input.lifecyclePreflight?.canRestore ?? input.capabilities?.canRestore,
    canPublish: input.capabilities?.canPublish,
    canSubmitForModeration: input.capabilities?.canSubmitForModeration,
    canWithdrawFromModeration: input.capabilities?.canWithdrawFromModeration,
  };

  return {
    contentType: input.type,
    surface: input.surface ?? "admin",
    status: input.status,
    archivedAt: input.archivedAt,
    actorRoles:
      input.actorRoles ??
      (input.surface === "admin" || input.surface === undefined
        ? ["ADMIN", "MODERATOR"]
        : undefined),
    preflight,
  };
}

export function buildContentLifecycleViewModel(
  input: ContentLifecycleInput,
): ContentLifecycleViewModel {
  const context = buildLifecycleContext(input);
  const resolved = resolveLifecycleActions({
    context,
    navigationLinks: input.navigationLinks,
  });
  const meta = LIFECYCLE_STATE_META[resolved.effectiveState];

  const navigationActions = resolved.navigationActions.map(toActionView);
  const transitionActions = resolved.transitionActions.map(toActionView);

  return {
    effectiveState: resolved.effectiveState,
    label: meta.label,
    description: meta.description,
    visualTone: meta.tone,
    badges: [{ label: meta.label, tone: meta.tone, primary: true }],
    navigationActions,
    transitionActions,
    statusTransitionActions: transitionActions,
    availableActions: [...navigationActions, ...transitionActions],
    rawStatus: input.status ?? null,
    isArchived: resolved.isArchived,
  };
}

export function contentLifecycleBadgeClassName(
  tone: LifecycleVisualTone,
): string {
  switch (tone) {
    case "success":
      return "bg-green-100 text-green-800 border-green-200";
    case "warning":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "danger":
      return "bg-red-100 text-red-800 border-red-200";
    case "muted":
      return "border-stone-300 bg-stone-100 text-stone-700";
    case "neutral":
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}
