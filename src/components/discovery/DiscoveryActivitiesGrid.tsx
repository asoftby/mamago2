"use client";

import { useMemo } from "react";
import { ActivityCard } from "@/components/activity/ActivityCard";
import {
  useDiscoveryFilters,
  type DiscoveryFilters,
} from "@/features/filters/discovery/filters.store";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { filterMockActivitiesByDiscovery } from "@/lib/discovery/filterMockActivities";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import type { ActivityMock } from "@/mocks/activity.types";
import { cn } from "@/lib/utils";

type DiscoveryActivitiesGridProps = {
  activities: ActivityMock[];
  className?: string;
};

function filtersSignature(f: DiscoveryFilters): string {
  return JSON.stringify({
    df: f.dateFrom,
    dt: f.dateTo,
    wp: f.whenPreset,
    age: f.age,
    metro: f.metro,
    district: f.district,
    nearby: f.nearby,
  });
}

export function DiscoveryActivitiesGrid({
  activities,
  className,
}: DiscoveryActivitiesGridProps) {
  const { applied } = useDiscoveryFilters();
  const debounced = useDebouncedValue(applied, 400);
  const isPending = filtersSignature(applied) !== filtersSignature(debounced);

  const filtered = useMemo(
    () => filterMockActivitiesByDiscovery(debounced, activities),
    [debounced, activities],
  );

  return (
    <div className={cn("grid gap-6 grid-cols-2 md:grid-cols-4", className)}>
      {isPending
        ? Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded-2xl bg-neutral-100 animate-pulse"
              aria-hidden
            />
          ))
        : filtered.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              saveMeta={{
                title: activity.title,
                dateISO: activity.dateStart ?? null,
                dateLabel: activity.dateStart
                  ? formatRuShortDayMonth(activity.dateStart)
                  : null,
              }}
            />
          ))}
    </div>
  );
}
