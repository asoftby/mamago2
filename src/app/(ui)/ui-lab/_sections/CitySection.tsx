"use client";

import React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";

export function CitySection() {
  return (
    <DemoSection id="city" title="City Components" description="src/components/city">
      <InventoryGrid>
        <RenderSafe title="DiscoveryIntentTabs" file="src/components/city/DiscoveryIntentTabs.tsx" listedOnly />
        <RenderSafe title="CityDiscoveryShell" file="src/components/city/CityDiscoveryShell.tsx" listedOnly />
        <RenderSafe title="CityShell" file="src/components/city/CityShell.tsx" listedOnly />
      </InventoryGrid>
    </DemoSection>
  );
}
