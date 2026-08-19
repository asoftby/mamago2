"use client";

import { useMemo } from "react";
import { EventCard, activityMockToEventCard } from "@/components/events";
import { OfferCard } from "@/components/offers/OfferCard";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import {
  useDiscoveryFilters,
  type DiscoveryFilters,
} from "@/features/filters/discovery/filters.store";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBudgetFilter } from "@/features/filters/discovery/useBudgetFilter";
import { partitionDiscoveryFeed } from "@/lib/discovery/partitionDiscoveryFeed";
import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPriceFrom } from "@/lib/formatters/format-price";
import type { ActivityMock } from "@/types/activity";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { getActivityFormatLabel } from "@/domain/activities/activity-format";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
// NOTE: formatRuShortDayMonthRange, formatPriceFrom, getActivityFormatLabel, publicActivityPath
// are still used by the OfferCard branch below — do not remove.

type DiscoveryActivitiesGridProps = {
  activities: ActivityMock[];
  className?: string;
  /** Соотношение обложки `ActivityCard` (по умолчанию 4/5, для «Занятия» — 1/1) */
  coverRatio?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

function filtersSignature(f: DiscoveryFilters): string {
  return JSON.stringify({
    df: f.dateFrom,
    dt: f.dateTo,
    wp: f.whenPreset,
    age: f.age,
    format: f.format,
    metro: f.metro,
    district: f.district,
    nearby: f.nearby,
    free: f.free,
    adultOnly: f.adultOnly,
  });
}

function masonrySkeletonAspect(index: number): string {
  const variants = [
    "aspect-[4/5]",
    "aspect-[3/4]",
    "aspect-[5/7]",
    "aspect-[4/6]",
  ];
  return variants[index % variants.length] ?? "aspect-[4/5]";
}

export function DiscoveryActivitiesGrid({
  activities,
  className,
  coverRatio,
  emptyTitle = "Пока нет событий по вашему запросу",
  emptyDescription = "В этом городе пока нет подходящих опубликованных событий — или стоит ослабить фильтры.",
}: DiscoveryActivitiesGridProps) {
  const cityCtx = useOptionalCity();
  const citySlug = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;
  const ratio = coverRatio ?? "4/5";
  const { applied, actions, derived } = useDiscoveryFilters();
  const debounced = useDebouncedValue(applied, 400);
  const isPending = filtersSignature(applied) !== filtersSignature(debounced);

  const { budget } = useBudgetFilter();

  const { primary, secondary, secondaryHeading } = useMemo(
    () => partitionDiscoveryFeed(debounced, activities, budget),
    [debounced, activities, budget],
  );

  const renderCard = (activity: (typeof activities)[number]) => (
    <AnalyticsCardViewTracker
      key={activity.id}
      entityType={activity.analyticsEntityType ?? "EVENT"}
      entityId={activity.id}
      vertical="CITY"
      citySlug={citySlug}
      meta={{ section: activity.analyticsEntityType === "OFFER" ? "offers" : "afisha" }}
    >
      {activity.analyticsEntityType === "OFFER" ? (
        <OfferCard
          id={activity.id}
          title={activity.title}
          href={
            activity.href ??
            publicActivityPath(activity.id, activity.citySlug ?? citySlug, activity.slug)
          }
          imageUrl={activity.image}
          categoryLabel={[
            activity.badge || null,
            activity.format ? getActivityFormatLabel(activity.format) : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined}
          dateLabel={[
            activity.ageFrom != null ? `${activity.ageFrom}+` : null,
            activity.dateStart
              ? formatRuShortDayMonthRange(activity.dateStart, activity.dateEnd ?? null)
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined}
          priceLabel={
            activity.priceMin === 0
              ? "бесплатно"
              : activity.priceMin != null
                ? formatPriceFrom(activity.priceMin)
                : undefined
          }
          saveDateISO={activity.dateStart ?? null}
          saveDateEndISO={activity.dateEnd ?? null}
          className="h-full"
        />
      ) : (
        <EventCard
          {...activityMockToEventCard(activity, citySlug)}
          coverRatio={ratio}
          className="h-full"
        />
      )}
    </AnalyticsCardViewTracker>
  );

  const showEmpty = !isPending && primary.length === 0 && secondary.length === 0;

  return (
    <div className={cn("space-y-8", className)}>
      {showEmpty && (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/90 px-5 py-12 text-center sm:px-8">
          <p className="text-[15px] font-semibold text-neutral-900">
            {emptyTitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            {emptyDescription}
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
      <div
        className={cn(
          "grid grid-cols-2 gap-5 lg:grid-cols-4",
          className,
        )}
      >
        {isPending
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "overflow-hidden rounded-[28px] bg-neutral-100 animate-pulse",
                  ratio === "1/1" ? "aspect-square" : masonrySkeletonAspect(i),
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
          <div
            className="grid grid-cols-2 gap-5 lg:grid-cols-4"
          >
            {secondary.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
