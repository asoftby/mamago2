import React, { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { PublicLayoutBody } from "./PublicLayoutBody";
import { HeaderDiscoveryFiltersProviderWrapper } from "./HeaderDiscoveryFiltersProviderWrapper";
import { PublicationIntentProvider } from "@/contexts/PublicationIntentContext";
import { RefinementFiltersProvider } from "@/contexts/RefinementFiltersContext";
import { RefinementFiltersModalGlobal } from "@/components/discovery/RefinementFiltersModalGlobal";
import { ReloadProbe } from "@/components/dev/ReloadProbe";
import { PublicProviders } from "@/components/providers/PublicProviders";
import { FamilyDerivedAgeSync } from "@/components/family/FamilyDerivedAgeSync";
import { MyPlanProvider } from "@/components/MyPlanProvider";

export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicProviders>
      <RefinementFiltersProvider>
        <ReloadProbe />
        <PublicationIntentProvider>
          <HeaderDiscoveryFiltersProviderWrapper>
            <div className="flex min-h-screen flex-col bg-white">
              <SiteHeader />

              <PublicLayoutBody>{children}</PublicLayoutBody>
              <FamilyDerivedAgeSync />
              <MyPlanProvider />

              {/* Global Refinement Modal */}
              <Suspense fallback={null}>
                <RefinementFiltersModalGlobal />
              </Suspense>
            </div>
          </HeaderDiscoveryFiltersProviderWrapper>
        </PublicationIntentProvider>
      </RefinementFiltersProvider>
    </PublicProviders>
  );
}
