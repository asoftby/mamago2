import React, { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { PublicLayoutBody } from "./PublicLayoutBody";
import { PublicationIntentProvider } from "@/contexts/PublicationIntentContext";
import { RefinementFiltersProvider } from "@/contexts/RefinementFiltersContext";
import { RefinementFiltersModalGlobal } from "@/components/discovery/RefinementFiltersModalGlobal";
import { ReloadProbe } from "@/components/dev/ReloadProbe";
import { PublicProviders } from "@/components/providers/PublicProviders";
import { FamilyDerivedAgeSync } from "@/components/family/FamilyDerivedAgeSync";
import { MyPlanProvider } from "@/components/MyPlanProvider";
import { GateFlowController } from "@/components/auth/GateFlowController";
import { MobileTapDiagnostics } from "@/components/dev/MobileTapDiagnostics";

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
          <div className="flex min-h-screen flex-col bg-white">
            <SiteHeader />

            <PublicLayoutBody>{children}</PublicLayoutBody>
            <FamilyDerivedAgeSync />
            <MyPlanProvider />
            <GateFlowController />
            <MobileTapDiagnostics />

            {/* Global Refinement Modal */}
            <Suspense fallback={null}>
              <RefinementFiltersModalGlobal />
            </Suspense>
          </div>
        </PublicationIntentProvider>
      </RefinementFiltersProvider>
    </PublicProviders>
  );
}
