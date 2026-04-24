import React, { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { PublicLayoutBody } from "./PublicLayoutBody";
import { CityProvider } from "@/contexts/CityContext";
import { PublicationIntentProvider } from "@/contexts/PublicationIntentContext";
import { RefinementFiltersProvider } from "@/contexts/RefinementFiltersContext";
import { RefinementFiltersModalGlobal } from "@/components/discovery/RefinementFiltersModalGlobal";

export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RefinementFiltersProvider>
      <CityProvider>
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
      </CityProvider>
    </RefinementFiltersProvider>
  );
}
