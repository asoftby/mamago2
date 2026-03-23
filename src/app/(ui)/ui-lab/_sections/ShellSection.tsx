"use client";

import React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";

export function ShellSection() {
  return (
    <DemoSection id="shell" title="Shell Components" description="src/components/shell">
      <InventoryGrid>
        <RenderSafe title="PublicHeader" file="src/components/shell/PublicHeader.tsx" listedOnly />
        <RenderSafe title="PublicFooter" file="src/components/shell/PublicFooter.tsx" listedOnly />
      </InventoryGrid>
    </DemoSection>
  );
}
