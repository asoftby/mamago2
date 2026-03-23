import React, { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { CityProvider } from "@/contexts/CityContext";
import { RefinementFiltersProvider } from "@/contexts/RefinementFiltersContext";
import { RefinementFiltersModalGlobal } from "@/components/discovery/RefinementFiltersModalGlobal";

/**
 * Тот же публичный chrome, что на маршрутах (public): мобильный хедер + нижняя панель на &lt; lg.
 */
export default function UiLabLayout({ children }: { children: React.ReactNode }) {
  return (
    <RefinementFiltersProvider>
      <Suspense fallback={<div className="min-h-screen flex flex-col bg-white" />}>
        <CityProvider>
          <div className="min-h-screen flex flex-col bg-background">
            <Suspense fallback={<div className="h-16 bg-white" />}>
              <SiteHeader />
            </Suspense>

            <main className="flex-1 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">
              {children}
            </main>

            <div className="block lg:hidden">
              <Suspense fallback={<div className="h-[5.75rem] shrink-0" aria-hidden />}>
                <MobileBottomNav />
              </Suspense>
            </div>

            <Suspense fallback={null}>
              <RefinementFiltersModalGlobal />
            </Suspense>
          </div>
        </CityProvider>
      </Suspense>
    </RefinementFiltersProvider>
  );
}
