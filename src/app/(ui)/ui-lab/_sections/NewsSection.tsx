"use client";

import React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";

import { BreakingNewsRow } from "@/components/news/BreakingNewsRow";

export function NewsSection() {
  return (
    <DemoSection id="news" title="News Components" description="src/components/news">
      <InventoryGrid>
        <RenderSafe title="BreakingNewsRow" file="src/components/news/BreakingNewsRow.tsx">
           <BreakingNewsRow items={[{ 
             id: '1', 
             title: 'News', 
             imageUrl: 'https://picsum.photos/seed/news/200/200',
             timeAgo: '2h ago'
           }]} />
        </RenderSafe>
      </InventoryGrid>
    </DemoSection>
  );
}
