"use client";

import {
  FilterSelect,
  type FilterSelectOption,
} from "@/components/ui/filter-select";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import { SEGMENT_KEYS, segmentTitle } from "@/lib/analytics/segmentCatalog";

const DATE_RANGE_OPTIONS: FilterSelectOption[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
];

const ENTITY_OPTIONS: FilterSelectOption[] = [
  { value: "all", label: "All" },
  { value: "event", label: "Event" },
  { value: "place", label: "Place" },
  { value: "offer", label: "Offer" },
  { value: "route", label: "Route" },
  { value: "article", label: "Article" },
];

const VERTICAL_OPTIONS: FilterSelectOption[] = [
  { value: "all", label: "All" },
  { value: "city", label: "City" },
  { value: "travel", label: "Travel" },
  { value: "birthday", label: "Birthday" },
  { value: "education", label: "Education" },
  { value: "weekend", label: "Weekend" },
  { value: "seasonal", label: "Seasonal" },
];

const CITY_OPTIONS: FilterSelectOption[] = [
  { value: "minsk", label: "Minsk" },
  { value: "gomel", label: "Gomel" },
  { value: "brest", label: "Brest" },
];

const SEGMENT_OPTIONS: FilterSelectOption[] = SEGMENT_KEYS.map((k) => ({
  value: k,
  label: segmentTitle(k),
}));

const CHILD_AGE_OPTIONS: FilterSelectOption[] = [
  { value: "0-3", label: "0–3" },
  { value: "3-6", label: "3–6" },
  { value: "6-10", label: "6–10" },
  { value: "10+", label: "10+" },
];

type AdminAnalyticsFiltersProps = {
  value: AnalyticsOverviewFilters;
  onChange: (next: AnalyticsOverviewFilters) => void;
};

/**
 * Панель фильтров аналитики (controlled; данные запрашивает родитель).
 */
export function AdminAnalyticsFilters({
  value,
  onChange,
}: AdminAnalyticsFiltersProps) {
  const patch = (partial: Partial<AnalyticsOverviewFilters>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="w-full min-w-0 md:flex-1 md:min-w-[140px] lg:max-w-[180px]">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Date range
          </label>
          <FilterSelect
            value={value.dateRange}
            options={DATE_RANGE_OPTIONS}
            onChange={(dateRange) => patch({ dateRange: dateRange as AnalyticsOverviewFilters["dateRange"] })}
          />
        </div>

        <div className="w-full min-w-0 md:flex-1 md:min-w-[140px] lg:max-w-[180px]">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Entity type
          </label>
          <FilterSelect
            value={value.entity}
            options={ENTITY_OPTIONS}
            onChange={(entity) => patch({ entity })}
          />
        </div>

        <div className="w-full min-w-0 md:flex-1 md:min-w-[160px] lg:max-w-[200px]">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Vertical
          </label>
          <FilterSelect
            value={value.vertical}
            options={VERTICAL_OPTIONS}
            onChange={(vertical) => patch({ vertical })}
          />
        </div>

        <div className="w-full min-w-0 md:flex-1 md:min-w-[140px] lg:max-w-[180px]">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            City
          </label>
          <FilterSelect
            value={value.city}
            placeholder="All cities"
            options={CITY_OPTIONS}
            onChange={(city) => patch({ city })}
          />
        </div>

        <div className="w-full min-w-0 md:flex-1 md:min-w-[140px] lg:max-w-[200px]">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Segment
          </label>
          <FilterSelect
            value={value.segment}
            placeholder="All segments"
            options={SEGMENT_OPTIONS}
            onChange={(segment) => patch({ segment })}
          />
        </div>

        <div className="w-full min-w-0 md:flex-1 md:min-w-[140px] lg:max-w-[180px]">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Child age
          </label>
          <FilterSelect
            value={value.childAgeBand}
            placeholder="All ages"
            options={CHILD_AGE_OPTIONS}
            onChange={(childAgeBand) => patch({ childAgeBand })}
          />
        </div>
      </div>
    </div>
  );
}
