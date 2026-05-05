"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { MyPlanWidget, MyPlanOverlay } from "@/features/my-plan";
import { MyPlanStateProvider } from "@/features/my-plan/hooks/useMyPlan";
import { appendMyPlanOpenToHref, MY_PLAN_OPEN_EVENT } from "@/lib/my-plan/myPlanOpenIntent";
import { isMyPlanShellExcludedPath, shouldHideMyPlanWidget } from "@/lib/intent";
import { PlanOverlayProvider, usePlanOverlay } from "@/lib/my-plan/usePlanOverlay";

function MyPlanProviderInner() {
  const pathname = usePathname();
  const hidePlanEntry = shouldHideMyPlanWidget(pathname);
  const router = useRouter();
  const { isLoading: authLoading } = useAuthMe();
  const { isOpen: planOpen, open: openPlan, close: closePlan } = usePlanOverlay();

  const isOnPlanPage = pathname === "/me/plan" || (pathname?.startsWith("/me/plan/") ?? false);
  const effectivePlanOpen = planOpen && !isOnPlanPage;

  // Открытие по URL param ?myPlan=open (гость или пользователь)
  useEffect(() => {
    if (authLoading) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("myPlan") !== "open") return;
    params.delete("myPlan");
    const qs = params.toString();
    const newUrl = `${pathname || "/"}${qs ? `?${qs}` : ""}`;
    router.replace(newUrl, { scroll: false });
    queueMicrotask(() => openPlan());
  }, [authLoading, router, pathname, openPlan]);

  const handleOpenMyPlan = useCallback(() => {
    openPlan();
  }, [openPlan]);

  useEffect(() => {
    window.addEventListener(MY_PLAN_OPEN_EVENT, handleOpenMyPlan);
    return () => window.removeEventListener(MY_PLAN_OPEN_EVENT, handleOpenMyPlan);
  }, [handleOpenMyPlan]);

  const handlePlanOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closePlan();
      } else {
        openPlan();
      }
    },
    [openPlan, closePlan],
  );

  return (
    <MyPlanStateProvider>
      {!hidePlanEntry ? <MyPlanWidget onOpen={handleOpenMyPlan} /> : null}

      <MyPlanOverlay open={effectivePlanOpen} onOpenChange={handlePlanOpenChange} />
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
