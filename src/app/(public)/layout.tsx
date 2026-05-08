import React, { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { PublicLayoutBody } from "./PublicLayoutBody";
import { PublicationIntentProvider } from "@/contexts/PublicationIntentContext";
import { RefinementFiltersProvider } from "@/contexts/RefinementFiltersContext";
import { RefinementFiltersModalGlobal } from "@/components/discovery/RefinementFiltersModalGlobal";
import { ReloadProbe } from "@/components/dev/ReloadProbe";

export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RefinementFiltersProvider>
      <ReloadProbe />
      <PublicationIntentProvider>
        <div className="flex min-h-screen flex-col bg-white">
          <SiteHeader />

          <PublicLayoutBody>{children}</PublicLayoutBody>

          {/* Global Refinement Modal */}
          <Suspense fallback={null}>
            <RefinementFiltersModalGlobal />
          </Suspense>
        </div>
      </PublicationIntentProvider>
    </RefinementFiltersProvider>
  );
}
