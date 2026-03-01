"use client";

import React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";

export function CitySection() {
  return (
    <DemoSection title="City Components" description="src/components/city">
      <InventoryGrid>
        <RenderSafe title="IntentTabs" file="src/components/city/IntentTabs.tsx" listedOnly />
        <RenderSafe title="CityIntentShell" file="src/components/city/CityIntentShell.tsx" listedOnly />
        <RenderSafe title="CityShell" file="src/components/city/CityShell.tsx" listedOnly />
      </InventoryGrid>
    </DemoSection>
  );
}
