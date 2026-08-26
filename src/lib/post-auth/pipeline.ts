"use client";

import { toast } from "@/lib/toast";
import { migrateGuestMyPlanAfterAuth } from "@/lib/my-plan/migrateGuestMyPlanAfterAuth";
import type { AuthEntryPoint } from "./types";
import { getPostAuthContext, clearPostAuthAction, clearPostAuthContext } from "./storage";
import { executePendingPostAuthAction } from "./executePendingAction";
import type { ProfileStatePayload } from "./types";
import { applyPostAuthCompletionOutcome, showAuthSuccessToast } from "./resolver";
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
}

/**
 * Единый post-auth pipeline после успешного login/register.
 * Не редиректит до completion: при incomplete возвращает kind "completion".
 */
export async function runPostAuthPipeline(
  options: RunPostAuthPipelineOptions,
): Promise<PostAuthPipelineResult> {
  const { defaultSource = "profile", isMobile, router, skipNavigation } = options;

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

  if (ctx?.pendingAction) {
    try {
      await executePendingPostAuthAction(ctx.pendingAction);
      trackPostAuthEvent("pending_action_executed", { source });
    } catch (e) {
      console.error("[post-auth] pending action failed", e);
    }
  }

  const res = await fetch("/api/me/profile-state", { credentials: "include" });
  if (!res.ok) {
    trackPostAuthEvent("completion_started", { source });
    return { kind: "completion", source, returnTo };
  }

  const profile = (await res.json()) as ProfileStatePayload;

  if (isPlainAuthFlow(source) && authAction) {
    showAuthSuccessToast(authAction, toast);
    clearPostAuthAction();
  }

  if (!profile.isProfileComplete) {
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
