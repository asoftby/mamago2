import React, { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { PublicFooter } from "@/components/shell/PublicFooter";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { RefinementFiltersProvider } from "@/contexts/RefinementFiltersContext";
import { RefinementFiltersModalGlobal } from "@/components/discovery/RefinementFiltersModalGlobal";

export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RefinementFiltersProvider>
      <div className="min-h-screen flex flex-col">
        <Suspense fallback={<div className="h-16 bg-white" />}>
          <SiteHeader />
        </Suspense>

        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>

        {/* Desktop Footer */}
        <div className="hidden lg:block">
          <PublicFooter />
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="block lg:hidden">
          <Suspense fallback={<div className="h-16 bg-white" />}>
            <MobileBottomNav />
          </Suspense>
        </div>

        {/* Global Refinement Modal */}
        <Suspense fallback={null}>
          <RefinementFiltersModalGlobal />
        </Suspense>
      </div>
    </RefinementFiltersProvider>
  );
}
