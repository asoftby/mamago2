"use client";

import { toast } from "@/lib/toast";
import { migrateGuestMyPlanAfterAuth } from "@/lib/my-plan/migrateGuestMyPlanAfterAuth";
import type { AuthEntryPoint, PendingPostAuthAction } from "./types";
import { getPostAuthContext, clearPostAuthAction, clearPostAuthContext } from "./storage";
import { executePendingPostAuthAction } from "./executePendingAction";
import type { ProfileStatePayload } from "./types";
import {
  applyPostAuthCompletionOutcome,
  resolvePostAuthFlow,
  showAuthSuccessToast,
} from "./resolver";
import { trackPostAuthEvent } from "./analytics";

function isPlainAuthFlow(source: AuthEntryPoint): boolean {
  // `profile` source currently represents plain auth flow without a pending intent.
  return source === "profile";
}

export type PostAuthPipelineResult =
  | { kind: "completion"; source: AuthEntryPoint; returnTo: string | null }
  | { kind: "done" };

export interface RunPostAuthPipelineOptions {
  /** Точка входа по умолчанию, если в sessionStorage нет контекста */
  defaultSource?: AuthEntryPoint;
  isMobile: boolean;
  router: {
    push: (href: string) => void;
    replace: (href: string) => void;
    refresh: () => void;
  };
  /** Для My Plan overlay: не делать router.push после готового профиля */
  skipNavigation?: boolean;
  /**
   * Surface-aware pending action. Save overlays use their existing persistence
   * callback so local UI/cache updates stay intact while resolution remains
   * centralized. When omitted, the serialized context action is executed.
   */
  pendingActionExecutor?: () => Promise<void>;
}

export async function executePipelinePendingAction(input: {
  storedAction: PendingPostAuthAction;
  executor?: () => Promise<void>;
}): Promise<boolean> {
  if (input.executor) {
    // Surface persistence is fail-closed: callers must never continue to
    // onboarding/outcome after a failed callback-backed save.
    await input.executor();
    return true;
  }
  if (!input.storedAction) return false;
  try {
    await executePendingPostAuthAction(input.storedAction);
    return true;
  } catch (error) {
    console.error("[post-auth] pending action failed", error);
    return false;
  }
}

/**
 * Единый post-auth pipeline после успешного login/register.
 * Не редиректит до completion: при incomplete возвращает kind "completion".
 */
export async function runPostAuthPipeline(
  options: RunPostAuthPipelineOptions,
): Promise<PostAuthPipelineResult> {
  const {
    defaultSource = "profile",
    isMobile,
    router,
    skipNavigation,
    pendingActionExecutor,
  } = options;

  const ctx = getPostAuthContext();
  const source: AuthEntryPoint = ctx?.source ?? defaultSource;
  const authAction = ctx?.authAction ?? null;
  const returnTo = ctx?.returnTo ?? null;

  // Guest "Подбери за меня" keeps explicitly added cards in localStorage.
  // Materialize them before profile completion/navigation can replace the UI.
  // On failure the draft remains intact; MyPlanPanelContent performs a recovery retry.
  try {
    const guestPlanMigration = await migrateGuestMyPlanAfterAuth();
    if (guestPlanMigration.migratedCount > 0) {
      trackPostAuthEvent("pending_action_executed", { source });
    }
  } catch (e) {
    console.error("[post-auth] guest my-plan migration failed", e);
  }

  if (pendingActionExecutor || ctx?.pendingAction) {
    const executed = await executePipelinePendingAction({
      storedAction: ctx?.pendingAction ?? null,
      executor: pendingActionExecutor,
    });
    if (executed) {
      trackPostAuthEvent("pending_action_executed", { source });
    }
  }

  const res = await fetch("/api/me/profile-state", { credentials: "include" });
  if (!res.ok) {
    trackPostAuthEvent("completion_started", { source });
    return { kind: "completion", source, returnTo };
  }

  const profile = (await res.json()) as ProfileStatePayload;
  const resolution = resolvePostAuthFlow({ source, returnTo, profile });

  if (isPlainAuthFlow(source) && authAction) {
    showAuthSuccessToast(authAction, toast);
    clearPostAuthAction();
  }

  if (resolution.kind === "completion") {
    trackPostAuthEvent("completion_started", { source });
    return { kind: "completion", source, returnTo };
  }

  applyPostAuthCompletionOutcome(source, {
    isMobile,
    router,
    returnTo,
    toast,
    showProfileCompletionToast: !(isPlainAuthFlow(source) && authAction),
    skipNavigation: skipNavigation ?? false,
  });
  clearPostAuthContext();
  return { kind: "done" };
}
