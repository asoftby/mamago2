"use client";

import { toast } from "@/lib/toast";
import type { AuthEntryPoint } from "./types";
import { getPostAuthContext, clearPostAuthContext } from "./storage";
import { executePendingPostAuthAction } from "./executePendingAction";
import type { ProfileStatePayload } from "./types";
import { applyPostAuthCompletionOutcome } from "./resolver";
import { trackPostAuthEvent } from "./analytics";

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
  const returnTo = ctx?.returnTo ?? null;

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

  if (!profile.isProfileComplete) {
    trackPostAuthEvent("completion_started", { source });
    return { kind: "completion", source, returnTo };
  }

  applyPostAuthCompletionOutcome(source, {
    isMobile,
    router,
    returnTo,
    toast,
    skipNavigation: skipNavigation ?? false,
  });
  clearPostAuthContext();
  return { kind: "done" };
}
