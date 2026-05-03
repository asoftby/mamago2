"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { PublicFooter } from "@/components/shell/PublicFooter";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { MobileBottomBarShell } from "@/components/layout/MobileBottomBarShell";
import { shouldHideMobileBottomNav } from "@/lib/intent";
import { cn } from "@/lib/utils";
import { useNavigationReloadDebug } from "@/hooks/useNavigationReloadDebug";

const MOBILE_MAIN_BOTTOM =
  "pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0";

/**
 * Обёртка (public): нижний бар только там, где не страница публикации;
 * иначе убираем отступ под бар и сам бар.
 */
export function PublicLayoutBody({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideBottomBar = shouldHideMobileBottomNav(pathname);
  useNavigationReloadDebug(process.env.NODE_ENV !== "production");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PUBLIC_LAYOUT_DEBUG === "true") {
      console.debug("[Home/PublicLayoutBody] mounted", { pathname });
    }
    return () => {
      if (process.env.NEXT_PUBLIC_PUBLIC_LAYOUT_DEBUG === "true") {
        console.debug("[Home/PublicLayoutBody] unmounted", { pathname });
      }
    };
  }, [pathname]);

  return (
    <>
      <main
        className={cn("flex-1", !hideBottomBar ? MOBILE_MAIN_BOTTOM : "lg:pb-0")}
      >
        {children}
      </main>

      <div
        className={cn(
          !hideBottomBar ? MOBILE_MAIN_BOTTOM : "pb-0 lg:pb-0",
        )}
      >
        <PublicFooter />
      </div>

      {!hideBottomBar ? (
        <MobileBottomBarShell>
          <Suspense
            fallback={<div className="h-[5.75rem] shrink-0" aria-hidden />}
          >
            <MobileBottomNav />
          </Suspense>
        </MobileBottomBarShell>
      ) : null}
    </>
  );
}
