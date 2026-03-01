"use client";

import React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";
import { DropdownChip } from "@/components/discovery/DropdownChip";
import { IntentTabs } from "@/components/discovery/IntentTabs";
import { FilterMasonryMenu } from "@/components/discovery/FilterMasonryMenu";

export function DiscoverySection() {
  return (
    <DemoSection title="Discovery Components" description="src/components/discovery">
      <InventoryGrid>
        <RenderSafe title="DropdownChip" file="src/components/discovery/DropdownChip.tsx" listedOnly />
        <RenderSafe title="IntentTabs" file="src/components/discovery/IntentTabs.tsx" listedOnly />
        <RenderSafe title="MobileFilterSheet" file="src/components/discovery/MobileFilterSheet.tsx" listedOnly />
        <RenderSafe title="FilterMasonryMenu" file="src/components/discovery/FilterMasonryMenu.tsx" listedOnly />
      </InventoryGrid>
    </DemoSection>
  );
}
