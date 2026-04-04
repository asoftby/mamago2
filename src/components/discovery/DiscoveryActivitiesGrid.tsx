"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { ActivityCard } from "@/components/activity/ActivityCard";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import {
  useDiscoveryFilters,
  type DiscoveryFilters,
} from "@/features/filters/discovery/filters.store";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { partitionDiscoveryFeed } from "@/lib/discovery/partitionDiscoveryFeed";
import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import type { ActivityMock } from "@/mocks/activity.types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DiscoveryActivitiesGridProps = {
  activities: ActivityMock[];
  className?: string;
  /** Соотношение обложки `ActivityCard` (по умолчанию 4/5, для «Занятия» — 1/1) */
  coverRatio?: string;
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
  coverRatio,
}: DiscoveryActivitiesGridProps) {
  const params = useParams() as { city?: string };
  const citySlug =
    typeof params?.city === "string" && params.city.length > 0
      ? params.city
      : "minsk";
  const ratio = coverRatio ?? "4/5";
  const { applied, actions, derived } = useDiscoveryFilters();
  const debounced = useDebouncedValue(applied, 400);
  const isPending = filtersSignature(applied) !== filtersSignature(debounced);

  const { primary, secondary, secondaryHeading } = useMemo(
    () => partitionDiscoveryFeed(debounced, activities),
    [debounced, activities],
  );

  const renderCard = (activity: (typeof activities)[number]) => (
    <AnalyticsCardViewTracker
      key={activity.id}
      entityType="EVENT"
      entityId={activity.id}
      vertical="CITY"
      citySlug={citySlug}
      meta={{ section: "afisha" }}
    >
      <ActivityCard
        coverRatio={ratio}
        activity={activity}
        saveMeta={{
          title: activity.title,
          dateISO: activity.dateStart ?? null,
                  dateLabel: activity.dateStart
                    ? formatRuShortDayMonthRange(
                        activity.dateStart,
                        activity.dateEnd ?? null,
                      )
                    : null,
        }}
      />
    </AnalyticsCardViewTracker>
  );

  const showEmpty = !isPending && activities.length === 0;

  return (
    <div className={cn("space-y-8", className)}>
      {showEmpty && (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/90 px-5 py-12 text-center sm:px-8">
          <p className="text-[15px] font-semibold text-neutral-900">
            Пока нет событий по вашему запросу
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            В этом городе пока нет подходящих опубликованных событий — или стоит ослабить фильтры.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-5"
            onClick={() => actions.resetAll()}
          >
            {derived.isDirty ? "Сбросить фильтры" : "Показать все"}
          </Button>
        </div>
      )}

      {!showEmpty && (
      <div className={cn("grid gap-6 grid-cols-2 md:grid-cols-4")}>
        {isPending
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl bg-neutral-100 animate-pulse",
                  ratio === "1/1" ? "aspect-square" : "aspect-[4/5]",
                )}
                aria-hidden
              />
            ))
          : primary.map(renderCard)}
      </div>
      )}

      {!isPending && !showEmpty && secondary.length > 0 && secondaryHeading && (
        <div className="space-y-4">
          <h2 className="px-1 text-[15px] font-semibold text-muted-foreground">
            {secondaryHeading}
          </h2>
          <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
            {secondary.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
