"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { MyPlanWidget, MyPlanSheet, MyPlanModal } from "@/features/my-plan";
import { MyPlanStateProvider } from "@/features/my-plan/hooks/useMyPlan";
import { MyPlanAuthModal } from "@/components/auth/MyPlanAuthModal";
import { appendMyPlanOpenToHref, MY_PLAN_OPEN_EVENT } from "@/lib/my-plan/myPlanOpenIntent";
import { isMyPlanShellExcludedPath, shouldHideMyPlanWidget } from "@/lib/intent";

function MyPlanProviderInner() {
  const pathname = usePathname();
  const hidePlanEntry = shouldHideMyPlanWidget(pathname);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthMe();
  const [planOpen, setPlanOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

  const handleOpenMyPlan = useCallback(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setAuthOpen(true);
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

  return (
    <MyPlanStateProvider>
      {!hidePlanEntry ? <MyPlanWidget onOpen={handleOpenMyPlan} /> : null}
      <MyPlanAuthModal open={authOpen} onOpenChange={setAuthOpen} nextHref={nextHref} />
      {isAuthenticated &&
        (isMobile ? (
          <MyPlanSheet open={planOpen} onOpenChange={setPlanOpen} />
        ) : (
          <MyPlanModal open={planOpen} onOpenChange={setPlanOpen} />
        ))}
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
