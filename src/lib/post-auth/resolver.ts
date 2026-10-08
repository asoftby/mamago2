import type {
  AuthAction,
  AuthEntryPoint,
  ProfileMandatoryStepId,
  ProfileStatePayload,
} from "./types";
import { trackPostAuthEvent } from "./analytics";
import { clearPostAuthContext } from "./storage";
import {
  navigateToCompatibleHref,
  navigateToSurface,
} from "@/lib/routing/clientNavigation";
import { getSafeRedirectPath } from "@/lib/auth/redirectTo";
import { getRandomLoginSuccessMessage } from "@/lib/notifications/authMessages";

type RouterLike = { push: (href: string) => void; replace: (href: string) => void };

export type PostAuthFlowResolution =
  | {
      kind: "completion";
      source: AuthEntryPoint;
      returnTo: string | null;
      resumeStep: ProfileMandatoryStepId;
    }
  | {
      kind: "done";
      source: AuthEntryPoint;
      returnTo: string | null;
    };

/**
 * Canonical post-auth/onboarding decision. Every auth surface feeds the same
 * profile snapshot into this resolver instead of interpreting completion
 * flags independently.
 */
export function resolvePostAuthFlow(input: {
  source: AuthEntryPoint;
  returnTo: string | null;
  profile: ProfileStatePayload;
}): PostAuthFlowResolution {
  const { source, returnTo, profile } = input;
  if (!profile.isProfileComplete) {
    return {
      kind: "completion",
      source,
      returnTo,
      resumeStep: profile.resumeStep ?? "adult",
    };
  }
  return { kind: "done", source, returnTo };
}

export function getAuthSuccessToastMessage(authAction: AuthAction): string {
  switch (authAction) {
    case "signup":
      return "Добро пожаловать в mamaGo!";
    case "login":
      return "Вход выполнен — всё готово.";
    default: {
      const exhaustiveCheck: never = authAction;
      return exhaustiveCheck;
    }
  }
}

export function showAuthSuccessToast(
  authAction: AuthAction,
  toast: typeof import("sonner").toast,
): void {
  toast.success(getAuthSuccessToastMessage(authAction));
}

/**
 * Действия после полного завершения completion flow (usable-профиль достигнут).
 */
export function applyPostAuthCompletionOutcome(
  source: AuthEntryPoint,
  options: {
    isMobile: boolean;
    router: RouterLike;
    returnTo: string | null;
    toast: typeof import("sonner").toast;
    showProfileCompletionToast?: boolean;
    /** Не вызывать router.push/replace (например overlay «Мой план» уже переключается на план) */
    skipNavigation?: boolean;
    /**
     * true — пользователь только что завершил заполнение профиля
     * (показываем «Профиль заполнен»); false/undefined — обычный успешный
     * вход с уже готовым профилем.
     */
    profileJustCompleted?: boolean;
  },
): void {
  const {
    isMobile,
    router,
    returnTo,
    toast,
    showProfileCompletionToast = true,
    skipNavigation,
    profileJustCompleted,
  } = options;

  switch (source) {
    case "profile":
      if (!skipNavigation) {
        if (profileJustCompleted) {
          toast.success("Профиль заполнен");
        } else if (showProfileCompletionToast) {
          toast.success(getRandomLoginSuccessMessage());
        }
        const target = getSafeRedirectPath(returnTo, "");
        if (target) {
          navigateToCompatibleHref(router, target, { replace: true });
        } else {
          navigateToSurface(router, {
            targetSurface: "public",
            targetPath: "/me",
          });
        }
      }
      return;
    case "save_idea":
      toast.success("Сохранено в Идеи");
      return;
    case "save_plan":
      if (isMobile) {
        if (!skipNavigation) {
          navigateToSurface(router, {
            targetSurface: "public",
            targetPath: "/me/plan",
          });
        }
      } else {
        toast.success("Добавлено в план", {
          action: {
            label: "Открыть мой план",
            onClick: () =>
              navigateToSurface(router, {
                targetSurface: "public",
                targetPath: "/me/plan",
              }),
          },
        });
      }
      return;
    case "my_plan":
      if (!skipNavigation) {
        navigateToSurface(router, {
          targetSurface: "public",
          targetPath: "/me/plan",
        });
      }
      return;
    case "birthday_constructor": {
      if (!skipNavigation) {
        const target = returnTo?.trim() || "/";
        navigateToCompatibleHref(router, target, { replace: true });
      }
      return;
    }
    default:
      return;
  }
}

/**
 * Single finalizer for every ProfileCompletionFlow host. It owns analytics,
 * outcome application and context cleanup, including the already-complete
 * race where the flow must not emit a second success outcome.
 */
export function finishPostAuthOnboarding(
  source: AuthEntryPoint,
  options: {
    alreadyComplete?: boolean;
    isMobile: boolean;
    router: RouterLike;
    returnTo: string | null;
    toast: typeof import("sonner").toast;
    skipNavigation?: boolean;
  },
): void {
  trackPostAuthEvent("completion_finished", { source });
  if (options.alreadyComplete !== true) {
    applyPostAuthCompletionOutcome(source, {
      isMobile: options.isMobile,
      router: options.router,
      returnTo: options.returnTo,
      toast: options.toast,
      skipNavigation: options.skipNavigation,
      profileJustCompleted: true,
    });
  }
  clearPostAuthContext();
}

export function trackAuthCompleted(entryPoint: AuthEntryPoint): void {
  trackPostAuthEvent("auth_completed", { entryPoint });
}
