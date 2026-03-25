"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { PublicFooter } from "@/components/shell/PublicFooter";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { shouldHideMobileBottomNav } from "@/lib/intent";
import { cn } from "@/lib/utils";

const MOBILE_MAIN_BOTTOM =
  "pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0";

/**
 * Обёртка (public): нижний бар только там, где не страница публикации;
 * иначе убираем отступ под бар и сам бар.
 */
export function PublicLayoutBody({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideBottomBar = shouldHideMobileBottomNav(pathname);

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
        <div className="block lg:hidden">
          <Suspense
            fallback={<div className="h-[5.75rem] shrink-0" aria-hidden />}
          >
            <MobileBottomNav />
          </Suspense>
        </div>
      ) : null}
    </>
  );
}
