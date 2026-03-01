"use client";

import React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";

import { ActivityCard } from "@/components/activity/ActivityCard";

export function ActivitySection() {
  return (
    <DemoSection title="Activity Components" description="src/components/activity">
      <InventoryGrid>
        <RenderSafe title="ActivityCard (Feature)" file="src/components/activity/ActivityCard.tsx">
           <ActivityCard 
             activity={{
               id: 'demo-feature',
               title: 'Feature Activity',
               images: ['https://picsum.photos/seed/feat/400/300'],
               category: { id: 'c1', name: 'Cat', slug: 'cat' },
               ageRange: { min: 3, max: 10 },
               price: { amount: 10, currency: 'BYN' },
               location: { address: 'Minsk' }
             }} 
           />
        </RenderSafe>

        <RenderSafe title="ActivityGrid" file="src/components/activity/ActivityGrid.tsx" listedOnly />
        <RenderSafe title="CityFeedClient" file="src/components/activity/CityFeedClient.tsx" listedOnly />
      </InventoryGrid>
    </DemoSection>
  );
}
