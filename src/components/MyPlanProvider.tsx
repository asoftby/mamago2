"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { MobileBottomBar } from "@/components/mobile/MobileBottomBar";
import { MyPlanWidget, MyPlanMobileWidget, MyPlanOverlay } from "@/features/my-plan";
import { PlanQuickAddHost } from "@/features/my-plan/components/PlanQuickAddHost";
import { MyPlanStateProvider } from "@/features/my-plan/hooks/useMyPlan";
import { appendMyPlanOpenToHref, MY_PLAN_OPEN_EVENT } from "@/lib/my-plan/myPlanOpenIntent";
import {
  isMyPlanShellExcludedPath,
  isPublicationDetailPath,
  shouldHideMyPlanWidget,
} from "@/lib/intent";
import { PlanOverlayProvider, usePlanOverlay } from "@/lib/my-plan/usePlanOverlay";

function isMyPlanFullPageRoute(pathname: string | null): boolean {
  if (!pathname) return true;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[0] === "me" && (segments[1] === "plan" || segments[1] === "day")) {
    return true;
  }
  if (
    segments.length >= 3 &&
    segments[1] === "me" &&
    (segments[2] === "plan" || segments[2] === "day")
  ) {
    return true;
  }
  // /{city}/my-plan/{date}/scenario (Task 7 Day Scenario) — a real standalone
  // page, not an overlay; must not render nested behind the My Plan overlay.
  if (segments.length >= 2 && segments[1] === "my-plan") {
    return true;
  }
  return false;
}

function MyPlanOverlayHost({ pathname }: { pathname: string }) {
  const hidePlanEntry = shouldHideMyPlanWidget(pathname);
  const router = useRouter();
  const { isLoading: authLoading } = useAuthMe();
  const { isOpen: planOpen, open: openPlan, close: closePlan } = usePlanOverlay();
  const hidePlanEntryEffective = hidePlanEntry;
  // На страницах деталей (events/activity/offers) внизу EventStickyActionBar —
  // у него приоритет, мобильную нижнюю панель (план + 🔔/👤) не рендерим.
  const hideMobileBottomBar = hidePlanEntryEffective || isPublicationDetailPath(pathname);

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
    <>
      {!hidePlanEntryEffective ? <MyPlanWidget /> : null}
      {!hideMobileBottomBar ? (
        <MobileBottomBar>
          <MyPlanMobileWidget />
        </MobileBottomBar>
      ) : null}
      <MyPlanOverlay open={planOpen} onOpenChange={handlePlanOpenChange} />
      <PlanQuickAddHost />
    </>
  );
}

export function MyPlanProvider() {
  const pathname = usePathname();
  if (isMyPlanShellExcludedPath(pathname)) {
    return null;
  }
  const isFullPageRoute = isMyPlanFullPageRoute(pathname);
  if (isFullPageRoute && !shouldHideMyPlanWidget(pathname) && !isPublicationDetailPath(pathname)) {
    // Полноэкранный план: виджет не нужен, но 🔔/👤 внизу остаются.
    return <MobileBottomBar />;
  }

  return (
    <PlanOverlayProvider>
      <MyPlanStateProvider>
        {!isFullPageRoute && pathname ? <MyPlanOverlayHost pathname={pathname} /> : null}
      </MyPlanStateProvider>
    </PlanOverlayProvider>
  );
}
