import type { AuthAction, AuthEntryPoint } from "./types";
import { trackPostAuthEvent } from "./analytics";
import {
  navigateToCompatibleHref,
  navigateToSurface,
} from "@/lib/routing/clientNavigation";
import { getSafeRedirectPath } from "@/lib/auth/redirectTo";
import { getRandomLoginSuccessMessage } from "@/lib/notifications/authMessages";

type RouterLike = { push: (href: string) => void; replace: (href: string) => void };

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

export function trackAuthCompleted(entryPoint: AuthEntryPoint): void {
  trackPostAuthEvent("auth_completed", { entryPoint });
}
