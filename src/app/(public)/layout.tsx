import React, { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { PublicFooter } from "@/components/shell/PublicFooter";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { CityProvider } from "@/contexts/CityContext";
import { RefinementFiltersProvider } from "@/contexts/RefinementFiltersContext";
import { RefinementFiltersModalGlobal } from "@/components/discovery/RefinementFiltersModalGlobal";
import { AppliedFiltersChips } from "@/components/discovery/AppliedFiltersChips";
import { DiscoveryUrlDefaults } from "@/components/discovery/DiscoveryUrlDefaults";

export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RefinementFiltersProvider>
      <Suspense fallback={<div className="min-h-screen flex flex-col bg-white" />}>
        <CityProvider>
          <div className="min-h-screen flex flex-col">
            <Suspense fallback={<div className="h-16 bg-white" />}>
              <SiteHeader />
            </Suspense>

            <main className="flex-1 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0">
              <Suspense fallback={null}>
                <DiscoveryUrlDefaults />
                <AppliedFiltersChips />
              </Suspense>
              {children}
            </main>

            {/* Desktop Footer */}
            <div className="hidden lg:block">
              <PublicFooter />
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="block lg:hidden">
              <Suspense fallback={<div className="h-[5.75rem] shrink-0" aria-hidden />}>
                <MobileBottomNav />
              </Suspense>
            </div>

            {/* Global Refinement Modal */}
            <Suspense fallback={null}>
              <RefinementFiltersModalGlobal />
            </Suspense>
          </div>
        </CityProvider>
      </Suspense>
    </RefinementFiltersProvider>
  );
}
