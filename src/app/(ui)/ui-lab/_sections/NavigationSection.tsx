"use client";

import React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";

export function NavigationSection() {
  return (
    <DemoSection title="Navigation Components" description="src/components/navigation">
      <InventoryGrid>
        <RenderSafe title="IntentTabs" file="src/components/navigation/IntentTabs.tsx" listedOnly />
        <RenderSafe title="ContextFilters" file="src/components/navigation/ContextFilters.tsx" listedOnly />
      </InventoryGrid>
    </DemoSection>
  );
}
