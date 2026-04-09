import type { AuthEntryPoint } from "./types";
import { trackPostAuthEvent } from "./analytics";

type RouterLike = { push: (href: string) => void; replace: (href: string) => void };

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
    /** Не вызывать router.push/replace (например overlay «Мой план» уже переключается на план) */
    skipNavigation?: boolean;
  },
): void {
  const { isMobile, router, returnTo, toast, skipNavigation } = options;

  switch (source) {
    case "profile":
      if (!skipNavigation) {
        toast.success("Профиль заполнен");
        router.push("/me");
      }
      return;
    case "save_idea":
      toast.success("Сохранено в Идеи");
      return;
    case "save_plan":
      if (isMobile) {
        if (!skipNavigation) router.push("/me/plan");
      } else {
        toast.success("Добавлено в план", {
          action: {
            label: "Открыть мой план",
            onClick: () => router.push("/me/plan"),
          },
        });
      }
      return;
    case "my_plan":
      if (!skipNavigation) {
        router.push("/me/plan");
      }
      return;
    case "birthday_constructor": {
      if (!skipNavigation) {
        const target = returnTo?.trim() || "/";
        router.replace(target);
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
