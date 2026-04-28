"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { MyPlanWidget, MyPlanOverlay, type MyPlanUnauthSurface } from "@/features/my-plan";
import { MyPlanStateProvider } from "@/features/my-plan/hooks/useMyPlan";
import { appendMyPlanOpenToHref, MY_PLAN_OPEN_EVENT } from "@/lib/my-plan/myPlanOpenIntent";
import { isMyPlanShellExcludedPath, shouldHideMyPlanWidget } from "@/lib/intent";
import { trackPostAuthEvent } from "@/lib/post-auth/analytics";
import { PlanOverlayProvider, usePlanOverlay } from "@/lib/my-plan/usePlanOverlay";

function MyPlanProviderInner() {
  const pathname = usePathname();
  const hidePlanEntry = shouldHideMyPlanWidget(pathname);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthMe();
  const { isOpen: planOpen, open: openPlan, close: closePlan } = usePlanOverlay();
  const [embeddedAuthCompleting, setEmbeddedAuthCompleting] = useState(false);
  const [postAuthCompletionActive, setPostAuthCompletionActive] = useState(false);
  const unauthSurfaceRef = useRef<MyPlanUnauthSurface>("auth");
  const prevIsAuthenticatedRef = useRef(isAuthenticated);

  // Закрываем оверлей когда пользователь на странице плана
  const isOnPlanPage = pathname === "/me/plan" || (pathname?.startsWith("/me/plan/") ?? false);
  const effectivePlanOpen = planOpen && !isOnPlanPage;

  const nextHref = appendMyPlanOpenToHref(pathname || "/");

  // Открытие по URL param ?myPlan=open
  useEffect(() => {
    if (authLoading) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("myPlan") !== "open" || !isAuthenticated) return;
    params.delete("myPlan");
    const qs = params.toString();
    const newUrl = `${pathname || "/"}${qs ? `?${qs}` : ""}`;
    router.replace(newUrl, { scroll: false });
    queueMicrotask(() => openPlan());
  }, [authLoading, isAuthenticated, router, pathname, openPlan]);

  // Сброс embeddedAuthCompleting при переходе unauth → auth
  useEffect(() => {
    const wasAuthenticated = prevIsAuthenticatedRef.current;
    prevIsAuthenticatedRef.current = isAuthenticated;
    if (!wasAuthenticated && isAuthenticated) {
      queueMicrotask(() => setEmbeddedAuthCompleting(false));
    }
  }, [isAuthenticated]);

  const handleOpenMyPlan = useCallback(() => {
    if (!isAuthenticated) {
      trackPostAuthEvent("my_plan_entry_opened", { source: "my_plan" });
      unauthSurfaceRef.current = "auth";
    }
    openPlan();
  }, [isAuthenticated, openPlan]);

  // Слушаем глобальный window event (для обратной совместимости)
  useEffect(() => {
    window.addEventListener(MY_PLAN_OPEN_EVENT, handleOpenMyPlan);
    return () => window.removeEventListener(MY_PLAN_OPEN_EVENT, handleOpenMyPlan);
  }, [handleOpenMyPlan]);

  const handlePlanOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setEmbeddedAuthCompleting(false);
        setPostAuthCompletionActive(false);
        if (!isAuthenticated && unauthSurfaceRef.current === "auth") {
          trackPostAuthEvent("completion_abandoned", { source: "my_plan" });
        }
        closePlan();
      } else {
        openPlan();
      }
    },
    [isAuthenticated, openPlan, closePlan],
  );

  const handleUnauthBeforeClose = useCallback((ctx: { surface: MyPlanUnauthSurface }) => {
    unauthSurfaceRef.current = ctx.surface;
  }, []);

  return (
    <MyPlanStateProvider>
      {!hidePlanEntry ? <MyPlanWidget onOpen={handleOpenMyPlan} /> : null}

      <MyPlanOverlay
        open={effectivePlanOpen}
        onOpenChange={handlePlanOpenChange}
        isAuthenticated={
          (isAuthenticated || embeddedAuthCompleting) && !postAuthCompletionActive
        }
        authNextHref={nextHref}
        onUnauthBeforeClose={handleUnauthBeforeClose}
        onPostAuthCompletionPhase={setPostAuthCompletionActive}
        onGuestAuthSuccess={() => {
          setEmbeddedAuthCompleting(true);
          openPlan();
        }}
      />
    </MyPlanStateProvider>
  );
}

export function MyPlanProvider() {
  const pathname = usePathname();
  if (isMyPlanShellExcludedPath(pathname)) {
    return null;
  }
  return (
    <PlanOverlayProvider>
      <MyPlanProviderInner />
    </PlanOverlayProvider>
  );
}
