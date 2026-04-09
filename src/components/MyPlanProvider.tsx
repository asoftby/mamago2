"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { MyPlanWidget, MyPlanOverlay, type MyPlanUnauthSurface } from "@/features/my-plan";
import { MyPlanStateProvider } from "@/features/my-plan/hooks/useMyPlan";
import { appendMyPlanOpenToHref, MY_PLAN_OPEN_EVENT } from "@/lib/my-plan/myPlanOpenIntent";
import { isMyPlanShellExcludedPath, shouldHideMyPlanWidget } from "@/lib/intent";
import { trackPostAuthEvent } from "@/lib/post-auth/analytics";

function MyPlanProviderInner() {
  const pathname = usePathname();
  const hidePlanEntry = shouldHideMyPlanWidget(pathname);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthMe();
  const [embeddedAuthCompleting, setEmbeddedAuthCompleting] = useState(false);
  const [postAuthCompletionActive, setPostAuthCompletionActive] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const unauthSurfaceRef = useRef<MyPlanUnauthSurface>("auth");

  const nextHref = appendMyPlanOpenToHref(pathname || "/");

  useEffect(() => {
    if (authLoading) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("myPlan") !== "open" || !isAuthenticated) return;
    setPlanOpen(true);
    params.delete("myPlan");
    const qs = params.toString();
    router.replace(`${pathname || "/"}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [authLoading, isAuthenticated, router, pathname]);

  useEffect(() => {
    if (isAuthenticated) setEmbeddedAuthCompleting(false);
  }, [isAuthenticated]);

  /** Закрыть overlay при переходе на страницу плана (после post-auth navigate). */
  useEffect(() => {
    if (pathname === "/me/plan" || pathname?.startsWith("/me/plan/")) {
      setPlanOpen(false);
    }
  }, [pathname]);

  const handleOpenMyPlan = useCallback(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      trackPostAuthEvent("my_plan_entry_opened", { source: "my_plan" });
      unauthSurfaceRef.current = "auth";
      setPlanOpen(true);
      return;
    }

    setPlanOpen(true);
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    const onOpenRequested = () => {
      handleOpenMyPlan();
    };
    window.addEventListener(MY_PLAN_OPEN_EVENT, onOpenRequested);
    return () => window.removeEventListener(MY_PLAN_OPEN_EVENT, onOpenRequested);
  }, [handleOpenMyPlan]);

  const handlePlanOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setEmbeddedAuthCompleting(false);
        setPostAuthCompletionActive(false);
        if (!isAuthenticated && unauthSurfaceRef.current === "auth") {
          trackPostAuthEvent("completion_abandoned", { source: "my_plan" });
        }
      }
      setPlanOpen(open);
    },
    [isAuthenticated],
  );

  const handleUnauthBeforeClose = useCallback((ctx: { surface: MyPlanUnauthSurface }) => {
    unauthSurfaceRef.current = ctx.surface;
  }, []);

  return (
    <MyPlanStateProvider>
      {!hidePlanEntry ? <MyPlanWidget onOpen={handleOpenMyPlan} /> : null}

      <MyPlanOverlay
        open={planOpen}
        onOpenChange={handlePlanOpenChange}
        isAuthenticated={
          (isAuthenticated || embeddedAuthCompleting) && !postAuthCompletionActive
        }
        authNextHref={nextHref}
        onUnauthBeforeClose={handleUnauthBeforeClose}
        onPostAuthCompletionPhase={setPostAuthCompletionActive}
        onGuestAuthSuccess={() => {
          setEmbeddedAuthCompleting(true);
          setPlanOpen(true);
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
  return <MyPlanProviderInner />;
}
