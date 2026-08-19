import { blockingDependencyItems } from "@/lib/admin/contentDependencySummary";
import { getLifecycleActionDefinition } from "./lifecycleActionRegistry";
import {
  isLifecycleArchived,
  resolveLifecycleEffectiveState,
} from "./lifecycleEffectiveState";
import { getLifecycleTransitionsForState } from "./lifecycleStateMachine";
import type {
  LifecycleActionId,
  LifecycleContext,
  LifecycleEffectiveState,
  ResolvedLifecycleAction,
} from "./lifecycleTypes";

export type LifecycleNavigationLinks = {
  edit?: boolean;
  preview?: boolean;
  review?: boolean;
};

function buildDeleteBlockedReason(
  context: LifecycleContext,
): string | undefined {
  if (context.preflight?.deleteBlockedReason) {
    return context.preflight.deleteBlockedReason;
  }
  const summary = context.preflight?.dependencySummary;
  if (!summary) return undefined;
  const blocking = blockingDependencyItems(summary);
  if (blocking.length === 0) {
    return "Удаление заблокировано связанными данными";
  }
  return blocking.map((item) => `${item.label}: ${item.count}`).join(" · ");
}

function isPreflightAllowed(
  actionId: LifecycleActionId,
  context: LifecycleContext,
): { allowed: boolean; reason?: string } {
  const preflight = context.preflight;
  if (!preflight) {
    return { allowed: true };
  }

  switch (actionId) {
    case "deleteDraft":
      if (preflight.canDeleteDraft === false) {
        return {
          allowed: false,
          reason: buildDeleteBlockedReason(context),
        };
      }
      return { allowed: true };
    case "deleteArchived":
      if (preflight.canDeleteArchived === false) {
        return {
          allowed: false,
          reason:
            preflight.deleteArchivedBlockedReason ??
            buildDeleteBlockedReason(context) ??
            "Удаление из архива заблокировано",
        };
      }
      return { allowed: true };
    case "archive":
      if (preflight.canArchive === false) {
        return { allowed: false, reason: "Архивация недоступна" };
      }
      return { allowed: true };
    case "restore":
      if (preflight.canRestore === false) {
        return { allowed: false, reason: "Восстановление недоступно" };
      }
      return { allowed: true };
    case "submitForModeration":
      if (preflight.canSubmitForModeration === false) {
        return { allowed: false, reason: "Отправка на модерацию недоступна" };
      }
      return { allowed: true };
    case "publish":
      if (preflight.canPublish === false) {
        return { allowed: false, reason: "Публикация недоступна" };
      }
      return { allowed: true };
    case "withdrawFromModeration":
      if (preflight.canWithdrawFromModeration === false) {
        return { allowed: false, reason: "Отзыв с модерации недоступен" };
      }
      return { allowed: true };
    default:
      return { allowed: true };
  }
}

function buildNavigationActions(
  effectiveState: LifecycleEffectiveState,
  links: LifecycleNavigationLinks,
): ResolvedLifecycleAction[] {
  const actions: ResolvedLifecycleAction[] = [];

  if (links.edit && effectiveState !== "deleted") {
    const def = getLifecycleActionDefinition("edit");
    actions.push({
      actionId: "edit",
      label: def.label,
      description: def.description,
      category: def.category,
      requiresConfirmation: def.requiresConfirmation,
    });
  }

  if (links.preview && effectiveState !== "deleted") {
    const def = getLifecycleActionDefinition("preview");
    actions.push({
      actionId: "preview",
      label: def.label,
      description: def.description,
      category: def.category,
      requiresConfirmation: def.requiresConfirmation,
    });
  }

  if (links.review) {
    const def = getLifecycleActionDefinition("review");
    actions.push({
      actionId: "review",
      label: def.label,
      description: def.description,
      category: def.category,
      requiresConfirmation: def.requiresConfirmation,
    });
  }

  return actions;
}

function buildTransitionActions(
  context: LifecycleContext,
  /** Must not share the property name `effectiveState` — SWC/webpack minify
   * can leave a bare shorthand identifier after inlining and crash admin
   * content list pages with `ReferenceError: effectiveState is not defined`. */
  state: LifecycleEffectiveState,
): ResolvedLifecycleAction[] {
  const transitions = getLifecycleTransitionsForState({
    contentType: context.contentType,
    effectiveState: state,
    surface: context.surface,
    actorRoles: context.actorRoles,
  });

  return transitions.flatMap((transition) => {
    const def = getLifecycleActionDefinition(transition.actionId);
    const preflight = isPreflightAllowed(transition.actionId, context);

    const alwaysShowDisabled =
      (transition.actionId === "deleteDraft" && state === "draft") ||
      (transition.actionId === "deleteArchived" && state === "archived");

    if (!preflight.allowed && !alwaysShowDisabled) {
      return [];
    }

    const action: ResolvedLifecycleAction = {
      actionId: transition.actionId,
      label: def.label,
      description: def.description,
      category: def.category,
      destructive: def.destructive,
      requiresConfirmation: def.requiresConfirmation,
      disabled: !preflight.allowed,
      reason: preflight.reason,
      successMessage: def.successMessage,
      errorMessage: def.errorMessage,
    };
    return [action];
  });
}

export function resolveLifecycleActions(params: {
  context: LifecycleContext;
  navigationLinks?: LifecycleNavigationLinks;
}): {
  effectiveState: LifecycleEffectiveState;
  isArchived: boolean;
  navigationActions: ResolvedLifecycleAction[];
  transitionActions: ResolvedLifecycleAction[];
  allActions: ResolvedLifecycleAction[];
} {
  const effectiveState = resolveLifecycleEffectiveState({
    contentType: params.context.contentType,
    status: params.context.status,
    archivedAt: params.context.archivedAt,
  });

  const navigationLinks = params.navigationLinks ?? {
    edit: effectiveState !== "deleted" && effectiveState !== "archived",
    preview: effectiveState !== "deleted",
    review:
      params.context.surface === "admin" &&
      effectiveState === "pending",
  };

  const navigationActions = buildNavigationActions(effectiveState, navigationLinks);
  const transitionActions = buildTransitionActions(params.context, effectiveState);

  return {
    effectiveState,
    isArchived: isLifecycleArchived({
      status: params.context.status,
      archivedAt: params.context.archivedAt,
    }),
    navigationActions,
    transitionActions,
    allActions: [...navigationActions, ...transitionActions],
  };
}
