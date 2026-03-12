import React from "react";
import { SiteHeader } from "@/components/site/header";
import { PublicFooter } from "@/components/shell/PublicFooter";
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
        <SiteHeader />
        <main className="flex-1">
          {children}
        </main>
        <PublicFooter />
        
        {/* Global Modal */}
        <RefinementFiltersModalGlobal />
      </div>
    </RefinementFiltersProvider>
  );
}
