"use client";

import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { EventCard, EVENT_LISTING_IMAGE_SIZES, activityMockToEventCard } from "@/components/events";
import type { KudaListingItem } from "@/components/discovery/KudaMasonryListing";

/**
 * Uses the exact event card and visibility tracker as the canonical
 * «Куда пойти» listing. The server already supplies its ranked items,
 * commercial placement flags and exposure IDs.
 */
export function ArticleDynamicAfishaCards({
  items,
  citySlug,
  filterSummary,
}: {
  items: KudaListingItem[];
  citySlug: string;
  filterSummary: string;
}) {
  return (
    <div className="grid grid-cols-2 items-start gap-x-4 gap-y-6 sm:gap-x-6" aria-label="События афиши">
      {items.map((activity, index) => (
        <AnalyticsCardViewTracker
          key={activity.id}
          threshold={0.5}
          dwellMs={1000}
          entityType={activity.analyticsEntityType ?? "EVENT"}
          entityId={activity.id}
          vertical="CITY"
          citySlug={citySlug}
          meta={{
            isPromoted: activity.isPromoted ?? false,
            crossRegionReason: activity.crossRegionReason ?? null,
            exposureId: activity.exposureId ?? null,
            section: "afisha",
            placement: "article-dynamic-afisha",
            position: index + 1,
            filterSummary,
            feedBucket: activity.feedBucket,
            format: activity.format ?? null,
            ageFrom: activity.ageFrom,
            ageTo: activity.ageTo,
            priceMin: activity.priceMin ?? null,
            priceMax: activity.priceMax ?? null,
            discoveryIntent: activity.discoveryIntent ?? null,
          }}
        >
          <EventCard
            {...activityMockToEventCard(activity, citySlug)}
            framing="poster"
            imageSizes={EVENT_LISTING_IMAGE_SIZES}
            imagePriority={index < 2}
          />
        </AnalyticsCardViewTracker>
      ))}
    </div>
  );
}
