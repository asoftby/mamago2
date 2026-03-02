"use client";

import React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";

import { FilterPill } from "@/features/filters/ui/FilterPill";
import { DiscoveryFilters } from "@/features/discovery/filters/DiscoveryFilters";
import { FilterBar } from "@/features/filters/components/FilterBar";
import { minskActivitiesFilters } from "@/features/filters/presets/minskActivitiesFilters";

export function FiltersSection() {
  return (
    <DemoSection title="Filters" description="Filter components and new Feature Filters">
      <InventoryGrid>
        <RenderSafe title="FilterPill" file="src/features/filters/ui/FilterPill.tsx">
          <div className="flex gap-2">
            <FilterPill label="Default" />
            <FilterPill label="Active" isActive />
            <FilterPill label="Value" valueText="3" isActive />
          </div>
        </RenderSafe>

        <RenderSafe title="DiscoveryFilters (Feature) - Desktop" file="src/features/discovery/filters/DiscoveryFilters.tsx">
          <div className="p-4 border rounded">
            <DiscoveryFilters variant="desktop" />
          </div>
        </RenderSafe>
        <RenderSafe title="DiscoveryFilters (Feature) - Mobile" file="src/features/discovery/filters/DiscoveryFilters.tsx">
          <div className="p-4 border rounded max-w-sm">
            <DiscoveryFilters variant="mobile" />
          </div>
        </RenderSafe>

        <RenderSafe title="FilterBar (Feature)" file="src/features/filters/components/FilterBar.tsx">
           <div className="p-4 border rounded">
             <FilterBar defs={minskActivitiesFilters} />
           </div>
        </RenderSafe>

        {/* Listed Only */}
        <RenderSafe title="FilterControl" file="src/features/filters/components/FilterControl.tsx" listedOnly />
        <RenderSafe title="MobileSelectSheet" file="src/components/filters/MobileSelectSheet.tsx" listedOnly />
        <RenderSafe title="MobileDateSheet" file="src/components/filters/MobileDateSheet.tsx" listedOnly />

      </InventoryGrid>
    </DemoSection>
  );
}
