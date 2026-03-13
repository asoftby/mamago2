"use client";

import { Container } from "@/components/ui/Container";
import { ActivityCard } from "@/components/activity/ActivityCard";
import { MINSK_ACTIVITIES } from "@/mocks/activities.minsk";
import { Intent } from "@/lib/intent";
import { H1 } from "@/components/ui/typography";
import { RefinementFiltersButton } from "@/components/discovery/RefinementFiltersButton";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { formatCityTitle } from "@/lib/city/cityDisplayNames";

interface CityDiscoveryShellProps {
  city: string;
  intent: Intent;
}

export function CityDiscoveryShell({ 
  city, 
  intent,
}: CityDiscoveryShellProps) {
  
  // Get intent configuration
  const intentConfig = DISCOVERY_INTENT_CONFIG[intent];
  
  // Generate dynamic title with city name
  const pageTitle = formatCityTitle(intentConfig.titleTemplate, city);
  
  // Filter activities based on intent (mock logic)
  const filteredActivities = MINSK_ACTIVITIES; // In real app, this is filtered on server

  return (
    <main className="min-h-screen bg-background pb-20">
      <Container className="pt-6 space-y-6">
        {/* Page Title */}
        <div className="space-y-4">
          <H1 className="px-1">
            {pageTitle}
          </H1>
          
          {/* Refinement Filters Button - only show on desktop */}
          {intentConfig.hasFilters && (
            <div className="py-2 hidden md:block">
              <RefinementFiltersButton intent={intent} />
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
          {filteredActivities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      </Container>
    </main>
  );
}