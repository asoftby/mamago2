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
               image: 'https://picsum.photos/seed/feat/400/300',
               ageFrom: 3,
               priceMin: 10,
               currency: 'BYN',
               badge: 'New',
               rating: 4.5
             }} 
           />
        </RenderSafe>

        <RenderSafe title="ActivityGrid" file="src/components/activity/ActivityGrid.tsx" listedOnly />
        <RenderSafe title="CityFeedClient" file="src/components/activity/CityFeedClient.tsx" listedOnly />
      </InventoryGrid>
    </DemoSection>
  );
}
